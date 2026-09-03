// Dev-only helper: accepts a data-URL PNG and writes it to .dev-snaps/ so
// automated tooling can inspect canvas renders. No-op in production builds.
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") {
    return new Response("disabled", { status: 404 });
  }
  const { name, dataUrl } = (await req.json()) as {
    name?: string;
    dataUrl?: string;
  };
  if (!dataUrl?.startsWith("data:image/")) {
    return new Response("bad request", { status: 400 });
  }
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const safe = (name ?? "snap").replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
  const dir = path.join(process.cwd(), ".dev-snaps");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${safe}.png`), Buffer.from(b64, "base64"));
  return Response.json({ ok: true, file: `.dev-snaps/${safe}.png` });
}
