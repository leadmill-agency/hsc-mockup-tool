// Streams private blobs to the browser. Same-origin, so canvas exports of
// these images are never tainted, and the blob token stays server-side.
import { head } from "@vercel/blob";

type Ctx = { params: Promise<{ path: string[] }> };

const KEY_RE = /^projects\/[a-zA-Z0-9-]{1,64}\/[a-zA-Z0-9._-]{1,120}$/;

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const key = path.join("/");
  if (!KEY_RE.test(key)) return new Response("bad key", { status: 400 });
  try {
    const meta = await head(key);
    const upstream = await fetch(meta.url, {
      headers: { authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("unavailable", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "content-type": meta.contentType ?? "application/octet-stream",
        // keys are overwritten in place; clients cache-bust with ?v=
        "cache-control": "private, max-age=31536000",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
