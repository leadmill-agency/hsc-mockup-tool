// Public proposal page: unguessable token is the access control, matching
// the PRD's no-password proposal-link model (§8.3, §8.13).
import { ensureSchema, sql } from "@/lib/db";

type Ctx = { params: Promise<{ token: string }> };

const TOKEN_RE = /^[a-zA-Z0-9-]{16,64}$/;

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { token } = await ctx.params;
  if (!TOKEN_RE.test(token)) return new Response("not found", { status: 404 });
  await ensureSchema();
  const rows = await sql()`SELECT html FROM proposals WHERE token = ${token}`;
  const row = (rows as { html: string }[])[0];
  if (!row) return new Response("not found", { status: 404 });
  return new Response(row.html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
