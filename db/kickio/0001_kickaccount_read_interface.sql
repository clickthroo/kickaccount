-- KickAccount read interface on the Kickio database.
--
-- KickAccount never reads Kickio tables directly. It connects as
-- `kickaccount_reader`, which can only SELECT from the views in the
-- `kickaccount` schema below. The views are owned by `postgres`, so they read
-- the underlying RLS-protected tables with owner rights, and they expose only
-- the rows and columns accounting needs (no buyer PII).
--
-- The role is created without a password; the password is set separately
-- from a SCRAM-SHA-256 verifier so the plaintext never appears in migration
-- history (see db/README.md).

create schema if not exists kickaccount;
revoke all on schema kickaccount from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'kickaccount_reader') then
    create role kickaccount_reader login noinherit;
  end if;
end $$;

alter role kickaccount_reader set default_transaction_read_only = on;
alter role kickaccount_reader set statement_timeout = '30s';
alter role kickaccount_reader set search_path = kickaccount;

-- The seller account that holds Kickio's own stock ("Kickio Direct").
create or replace view kickaccount.house_sellers as
select p.id as seller_id, p.username, p.display_name
from public.profiles p
where p.id = 'ee2ce3bb-30d8-4f94-8cfd-a575866af57e';

-- Every Kickio Direct listing with its recorded purchase cost and check-in.
-- One row per listing; quantity and status decide whether it is in stock.
create or replace view kickaccount.house_stock_items as
select
  l.id                 as listing_id,
  l.seller_id,
  l.product_id,
  l.title,
  l.team,
  l.season,
  l.player_name,
  l.manufacturer,
  l.size,
  l.condition,
  l.category,
  l.status::text       as status,
  l.stock_quantity,
  l.price_cents,
  l.currency,
  l.created_at,
  l.updated_at,
  l.deleted_at,
  l.removed_at,
  l.removed_reason,
  c.cost_price_gbp,
  c.purchase_date,
  c.purchase_source,
  c.updated_at         as cost_updated_at,
  ci.stock_code,
  ci.checked_in_at,
  ci.location
from public.listings l
join kickaccount.house_sellers s on s.seller_id = l.seller_id
left join public.listing_costs c on c.listing_id = l.id
left join public.listing_check_ins ci on ci.listing_id = l.id;

grant usage on schema kickaccount to kickaccount_reader;
grant select on all tables in schema kickaccount to kickaccount_reader;
alter default privileges in schema kickaccount grant select on tables to kickaccount_reader;
