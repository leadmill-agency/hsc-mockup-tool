import { ensureSchema, sql } from "@/lib/db";

export async function GET(): Promise<Response> {
  await ensureSchema();
  const rows = await sql()`
    SELECT id, name, updated_at, thumbnail
    FROM projects ORDER BY updated_at DESC`;
  return Response.json(
    (rows as { id: string; name: string; updated_at: string; thumbnail: string | null }[]).map(
      (r) => ({
        id: r.id,
        name: r.name,
        updatedAt: Number(r.updated_at),
        thumbnail: r.thumbnail ?? undefined,
      })
    )
  );
}
