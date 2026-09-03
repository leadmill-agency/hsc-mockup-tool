import { put } from "@vercel/blob";

const KEY_RE = /^(?:projects|proposals)\/[a-zA-Z0-9-]{1,64}\/[a-zA-Z0-9._-]{1,120}$/;
const MAX_BYTES = 30 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const contentType = url.searchParams.get("contentType") ?? "image/png";
  if (!KEY_RE.test(key)) return new Response("bad key", { status: 400 });
  if (!/^image\/[a-z+.-]+$/.test(contentType)) {
    return new Response("bad content type", { status: 400 });
  }
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return new Response("bad size", { status: 400 });
  }
  await put(key, body, {
    access: "private",
    contentType,
    allowOverwrite: true,
  });
  return Response.json({ path: `/api/assets/${key}` });
}
