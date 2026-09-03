import { AUTH_COOKIE, sha256Hex } from "@/lib/auth";

export async function POST(req: Request): Promise<Response> {
  const passcode = process.env.STAFF_PASSCODE;
  if (!passcode) return Response.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { passcode?: string };
  if (typeof body.passcode !== "string" || body.passcode !== passcode) {
    // small delay blunts brute-force guessing
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "wrong passcode" }, { status: 401 });
  }
  const hash = await sha256Hex(passcode);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${AUTH_COOKIE}=${hash}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 60}`,
    },
  });
}
