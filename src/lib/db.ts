import "server-only";
import postgres from "postgres";
import { env } from "./env";

// Both URLs point at Supabase's transaction pooler, which doesn't support
// prepared statements.
const options = { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 } as const;

const globalForDb = globalThis as unknown as {
  kickioSql?: postgres.Sql;
  accountsSql?: postgres.Sql;
};

// Read-only: the kickaccount_reader role can only SELECT from the
// `kickaccount` views, and every transaction is read-only.
export function kickio(): postgres.Sql {
  return (globalForDb.kickioSql ??= postgres(env.kickioDatabaseUrl, options));
}

export function accounts(): postgres.Sql {
  return (globalForDb.accountsSql ??= postgres(env.accountsDatabaseUrl, options));
}
