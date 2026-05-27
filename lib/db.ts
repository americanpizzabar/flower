import { Pool, neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

function connectionString(): string {
  const cs =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!cs) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not set. Add a Postgres database in Vercel Storage tab, or set the connection string locally.",
    );
  }
  return cs;
}

let _pool: Pool | null = null;
export function pool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: connectionString() });
  return _pool;
}

let _sql: ReturnType<typeof neon> | null = null;
export function sql(): ReturnType<typeof neon> {
  if (!_sql) _sql = neon(connectionString());
  return _sql;
}

export function currentSeason(date = new Date()): "spring" | "early_summer" | "summer" | "autumn" | "winter" {
  const m = date.getMonth() + 1;
  if (m === 3 || m === 4 || m === 5) return "spring";
  if (m === 6) return "early_summer";
  if (m === 7 || m === 8) return "summer";
  if (m === 9 || m === 10 || m === 11) return "autumn";
  return "winter";
}

export function todayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
