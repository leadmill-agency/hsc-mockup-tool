// Neon Postgres over HTTP — serverless-friendly, one shared projects table.
import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export function sql(): ReturnType<typeof neon> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    _sql = neon(url);
  }
  return _sql;
}

let ensured = false;
export async function ensureSchema(): Promise<void> {
  if (ensured) return;
  await sql()`CREATE TABLE IF NOT EXISTS projects (
    id text PRIMARY KEY,
    name text NOT NULL DEFAULT 'Untitled project',
    updated_at bigint NOT NULL,
    thumbnail text,
    state jsonb NOT NULL DEFAULT '{}'::jsonb
  )`;
  ensured = true;
}

export const PROJECT_ID_RE = /^[a-zA-Z0-9-]{1,64}$/;
