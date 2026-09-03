import { del, list } from "@vercel/blob";
import { ensureSchema, PROJECT_ID_RE, sql } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function validId(ctx: Ctx): Promise<string | null> {
  const { id } = await ctx.params;
  return PROJECT_ID_RE.test(id) ? id : null;
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const id = await validId(ctx);
  if (!id) return new Response("bad id", { status: 400 });
  await ensureSchema();
  const rows = await sql()`
    SELECT id, name, updated_at, thumbnail, state FROM projects WHERE id = ${id}`;
  const r = (rows as Record<string, unknown>[])[0];
  if (!r) return new Response("not found", { status: 404 });
  return Response.json({
    id: r.id,
    name: r.name,
    updatedAt: Number(r.updated_at),
    thumbnail: r.thumbnail ?? undefined,
    state: r.state,
  });
}

export async function PUT(req: Request, ctx: Ctx): Promise<Response> {
  const id = await validId(ctx);
  if (!id) return new Response("bad id", { status: 400 });
  const body = (await req.json()) as {
    name?: string;
    updatedAt?: number;
    thumbnail?: string;
    state?: unknown;
  };
  if (typeof body.state !== "object" || body.state === null) {
    return new Response("bad state", { status: 400 });
  }
  await ensureSchema();
  const name = (body.name ?? "Untitled project").slice(0, 200);
  const updatedAt = Number(body.updatedAt) || Date.now();
  const thumbnail =
    typeof body.thumbnail === "string" && body.thumbnail.length < 200_000
      ? body.thumbnail
      : null;
  await sql()`
    INSERT INTO projects (id, name, updated_at, thumbnail, state)
    VALUES (${id}, ${name}, ${updatedAt}, ${thumbnail}, ${JSON.stringify(body.state)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      updated_at = EXCLUDED.updated_at,
      thumbnail = EXCLUDED.thumbnail,
      state = EXCLUDED.state`;
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  const id = await validId(ctx);
  if (!id) return new Response("bad id", { status: 400 });
  await ensureSchema();
  await sql()`DELETE FROM projects WHERE id = ${id}`;
  // remove the project's photos from blob storage too
  try {
    const { blobs } = await list({ prefix: `projects/${id}/` });
    if (blobs.length) await del(blobs.map((b) => b.url));
  } catch {
    // blob cleanup is best-effort; the DB row is the source of truth
  }
  return Response.json({ ok: true });
}
