import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var _pgPool: Pool | undefined;
}

// Local Postgres has no TLS listener; hosted providers (Vercel Postgres /
// Neon) require it. `pg` doesn't reliably infer this from `sslmode=require`
// in the connection string, so it's set explicitly based on host.
const isLocalDb = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");

const pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

export const db = drizzle(pool, { schema });
