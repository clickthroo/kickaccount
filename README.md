# KickAccount

The accounting suite for Kickio: UK VAT (standard, margin scheme, Global
Accounting Scheme), stock valuation, profit & loss, duties and IOSS
reporting. It's a separate app with its own login. It reads Kickio's database
through a narrow, read-only interface and keeps its own records (landed costs,
snapshots, audit log) in a separate database.

## Architecture

```
Browser ──► KickAccount (Next.js on Vercel)
              │  auth: Supabase Auth (KickAccount project), password + TOTP, AAL2 enforced
              ├─► KickAccount DB  (accounting schema, role kickaccount_app)
              └─► Kickio DB       (kickaccount views only, role kickaccount_reader, read-only)
```

- **Authentication.** Invite-only. Every request checks the Supabase session
  with the Auth server, requires a passed TOTP challenge (AAL2), and requires
  an active row in `accounting.app_users`. Roles are `owner` (everything,
  including users), `accountant` (enter costs, take snapshots) and `viewer`
  (read-only). Owners create one-time invite and reset links on the Users
  page.
- **Kickio access.** `kickaccount_reader` can only `SELECT` from views in
  Kickio's `kickaccount` schema. Every transaction is read-only, with a 30s
  statement timeout. See `db/README.md`.
- **Audit.** Sign-ins, exports, cost entries, snapshots and user changes go to
  `accounting.audit_log`, which can't be updated or deleted.

## Reports

### Stock valuation at cost (live)

Kickio Direct listings with status `draft`, `active`, `pending` or `reserved`
and quantity > 0, valued at landed cost:

> unit cost = purchase price + inbound shipping + import duty + other costs

- Purchase price comes from Kickio's `listing_costs`. For older stock with no
  Kickio cost, an accountant can enter one in KickAccount; Kickio's figure
  always wins when both exist.
- Shipping, duty and other costs are per-unit entries in KickAccount's cost
  ledger (append-only; wrong entries are voided, not edited).
- Import VAT is recorded but **excluded** from cost, because Kickio is VAT
  registered and reclaims it.
- Uncosted stock is counted and listed, but never silently valued at zero.
- Items listed below cost are flagged (lower of cost and net realisable value).
- Expected VAT treatment per item: retailer purchases → standard-rated;
  second-hand items with purchase price ≤ £500 → Global Accounting Scheme;
  > £500 → item-by-item margin scheme. For the margin calculation HMRC uses
  the purchase price only, not shipping or duty.
- Snapshots freeze the valuation (e.g. month end) and can be exported as CSV.

## Development

```sh
cp .env.example .env.local   # fill in
npm install
npm run dev
npm test          # valuation logic
npm run typecheck
npm run lint
```

First owner: `node scripts/bootstrap-owner.mjs you@example.com` (needs the env
vars it lists) prints a one-time invite link.
