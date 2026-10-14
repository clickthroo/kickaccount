import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// A Postgres connection via Supabase's transaction pooler. Either a full URL,
// or host + user + password so the (non-secret) pooler host can be changed
// without touching the password.
function databaseUrl(prefix: "KICKIO" | "ACCOUNTS"): string {
  const url = process.env[`${prefix}_DATABASE_URL`];
  if (url) return url;
  const host = required(`${prefix}_DB_HOST`);
  const user = required(`${prefix}_DB_USER`);
  const password = required(`${prefix}_DB_PASSWORD`);
  const port = process.env[`${prefix}_DB_PORT`] ?? "6543";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/postgres?sslmode=require`;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  // KickAccount's own database, as the kickaccount_app role.
  get accountsDatabaseUrl() {
    return databaseUrl("ACCOUNTS");
  },
  // Kickio's database, as the read-only kickaccount_reader role.
  get kickioDatabaseUrl() {
    return databaseUrl("KICKIO");
  },
};
