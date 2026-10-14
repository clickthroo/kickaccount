# Database migrations

KickAccount touches two Postgres databases. Migrations are applied by hand
(Supabase SQL editor or the Supabase MCP `apply_migration`), in file order.

| Folder | Database | What it does |
|---|---|---|
| `kickio/` | Kickio (`rlveellvebfzgyobceru`) | Read-only interface: the `kickaccount` schema of views, and the `kickaccount_reader` role that can only read them. **Additive only. Never alters Kickio tables.** |
| `accounting/` | KickAccount (its own Supabase project) | The `accounting` schema: users/roles, landed-cost ledger, valuation snapshots, audit log, and the `kickaccount_app` role. |

## Role passwords

Both login roles are created without a password. Set one from a
SCRAM-SHA-256 verifier so the plaintext never appears in SQL history:

```sh
python3 - <<'PY'
import base64, hashlib, hmac, os, secrets
pw = secrets.token_urlsafe(32); salt = os.urandom(16); i = 4096
k = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, i)
ck = hmac.new(k, b"Client Key", hashlib.sha256).digest()
sk = hmac.new(k, b"Server Key", hashlib.sha256).digest()
b = lambda x: base64.b64encode(x).decode()
print("password:", pw)
print(f"verifier: SCRAM-SHA-256${i}:{b(salt)}${b(hashlib.sha256(ck).digest())}:{b(sk)}")
PY
```

```sql
alter role kickaccount_reader password '<verifier>';
```

Put the plaintext password only in Vercel (`KICKIO_DB_PASSWORD` /
`ACCOUNTS_DB_PASSWORD`, type *sensitive*).

## Adding Kickio data for a new report

Add a new view to `kickaccount` in a new `kickio/000N_*.sql` migration,
exposing only the rows and columns the report needs, then
`grant select on kickaccount.<view> to kickaccount_reader;`. Don't grant the
reader anything outside the `kickaccount` schema.
