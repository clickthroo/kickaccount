-- KickAccount's own database (separate Supabase project).
--
-- Supabase Auth handles identities and MFA. Everything else lives in the
-- `accounting` schema, which is not exposed through the Supabase Data API:
-- the app reads and writes it server-side over a direct Postgres connection.

create schema if not exists accounting;
revoke all on schema accounting from public, anon, authenticated;

-- Who may use KickAccount. Signing in to Supabase Auth is not enough: a user
-- must also have an active row here.
create table accounting.app_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  role        text not null check (role in ('owner', 'accountant', 'viewer')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id)
);

-- Landed-cost components per Kickio listing, per unit, in GBP.
-- Append-only: a mistake is voided and re-entered, never edited.
--   purchase          only used when Kickio has no cost_price_gbp for the listing
--   inbound_shipping  carriage/postage to get the item to Kickio
--   import_duty       customs duty paid on import
--   import_vat        recorded for reference; reclaimable, so not part of cost
--   other             other costs of bringing the item to saleable condition
create table accounting.stock_cost_components (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null,
  component    text not null check (component in
                 ('purchase', 'inbound_shipping', 'import_duty', 'import_vat', 'other')),
  amount_gbp   numeric(12, 2) not null check (amount_gbp >= 0),
  note         text,
  created_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id),
  void_reason  text
);
create index stock_cost_components_listing_idx
  on accounting.stock_cost_components (listing_id) where voided_at is null;

-- Frozen copies of the stock valuation, e.g. at each month or year end.
create table accounting.stock_valuation_snapshots (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  taken_by    uuid not null references auth.users (id),
  label       text not null,
  totals      jsonb not null
);

create table accounting.stock_valuation_snapshot_lines (
  snapshot_id        uuid not null references accounting.stock_valuation_snapshots (id) on delete restrict,
  listing_id         uuid not null,
  stock_code         text,
  title              text not null,
  status             text not null,
  quantity           integer not null,
  purchase_gbp       numeric(12, 2),
  shipping_gbp       numeric(12, 2) not null,
  duty_gbp           numeric(12, 2) not null,
  other_gbp          numeric(12, 2) not null,
  unit_cost_gbp      numeric(12, 2),
  value_at_cost_gbp  numeric(12, 2),
  list_price_gbp     numeric(12, 2),
  vat_treatment      text not null,
  acquired_on        date,
  primary key (snapshot_id, listing_id)
);

create table accounting.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  user_id     uuid references auth.users (id),
  action      text not null,
  detail      jsonb not null default '{}'::jsonb
);

-- Snapshots and the audit log are immutable once written.
create function accounting.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

create trigger audit_log_immutable before update or delete on accounting.audit_log
  for each row execute function accounting.forbid_change();
create trigger snapshots_immutable before update or delete on accounting.stock_valuation_snapshots
  for each row execute function accounting.forbid_change();
create trigger snapshot_lines_immutable before update or delete on accounting.stock_valuation_snapshot_lines
  for each row execute function accounting.forbid_change();

-- Cost components may only be voided, once.
create function accounting.cost_component_void_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'stock_cost_components rows cannot be deleted; void them instead';
  end if;
  if old.voided_at is not null
     or (new.id, new.listing_id, new.component, new.amount_gbp, new.note, new.created_by, new.created_at)
        is distinct from
        (old.id, old.listing_id, old.component, old.amount_gbp, old.note, old.created_by, old.created_at)
     or new.voided_at is null or new.voided_by is null then
    raise exception 'stock_cost_components rows can only be voided';
  end if;
  return new;
end $$;

create trigger cost_components_void_only before update or delete on accounting.stock_cost_components
  for each row execute function accounting.cost_component_void_only();

-- Belt and braces: RLS on with no policies, so the Data API roles see nothing
-- even if the schema were ever exposed.
alter table accounting.app_users enable row level security;
alter table accounting.stock_cost_components enable row level security;
alter table accounting.stock_valuation_snapshots enable row level security;
alter table accounting.stock_valuation_snapshot_lines enable row level security;
alter table accounting.audit_log enable row level security;

-- The app's own login role: read/write on accounting tables, no deletes, no
-- access to anything else. Password set from a SCRAM verifier (db/README.md).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'kickaccount_app') then
    create role kickaccount_app login noinherit;
  end if;
end $$;
alter role kickaccount_app set statement_timeout = '30s';
alter role kickaccount_app set search_path = accounting;

grant usage on schema accounting to kickaccount_app;
grant select, insert, update on all tables in schema accounting to kickaccount_app;
grant usage on all sequences in schema accounting to kickaccount_app;

create policy app_all on accounting.app_users to kickaccount_app using (true) with check (true);
create policy app_all on accounting.stock_cost_components to kickaccount_app using (true) with check (true);
create policy app_all on accounting.stock_valuation_snapshots to kickaccount_app using (true) with check (true);
create policy app_all on accounting.stock_valuation_snapshot_lines to kickaccount_app using (true) with check (true);
create policy app_all on accounting.audit_log to kickaccount_app using (true) with check (true);
