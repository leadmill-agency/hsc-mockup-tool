// Create a shareable proposal: stores the rendered HTML under an unguessable
// token (served publicly at /p/<token>) and, when a Zapier webhook is
// configured and a customer email given, fires the webhook so the user's own
// Zap sends the email (PRD §8.14).
import { ensureSchema, sql } from "@/lib/db";

const TOKEN_RE = /^[a-zA-Z0-9-]{16,64}$/;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    projectName?: string;
    html?: string;
    priceLow?: number;
    priceHigh?: number;
    toEmail?: string;
  } | null;
  if (
    !body ||
    !TOKEN_RE.test(body.token ?? "") ||
    typeof body.html !== "string" ||
    body.html.length === 0 ||
    body.html.length > 3_000_000
  ) {
    return new Response("bad request", { status: 400 });
  }
  await ensureSchema();
  const token = body.token!;
  const name = (body.projectName ?? "Sign proposal").slice(0, 200);
  await sql()`
    INSERT INTO proposals (token, project_name, price_low, price_high, to_email, html, created_at)
    VALUES (${token}, ${name}, ${Math.round(body.priceLow ?? 0)},
            ${Math.round(body.priceHigh ?? 0)}, ${body.toEmail ?? null},
            ${body.html}, ${Date.now()})
    ON CONFLICT (token) DO UPDATE SET
      project_name = EXCLUDED.project_name,
      price_low = EXCLUDED.price_low,
      price_high = EXCLUDED.price_high,
      to_email = EXCLUDED.to_email,
      html = EXCLUDED.html`;

  const origin = new URL(req.url).origin;
  const url = `${origin}/p/${token}`;

  let emailed = false;
  const hook = process.env.ZAPIER_PROPOSAL_HOOK;
  const to = (body.toEmail ?? "").trim();
  if (hook && /.+@.+\..+/.test(to)) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to,
          project_name: name,
          price_low: body.priceLow ?? 0,
          price_high: body.priceHigh ?? 0,
          proposal_url: url,
          day_image_url: `${origin}/api/assets/proposals/${token}/day.png`,
          night_image_url: `${origin}/api/assets/proposals/${token}/night.png`,
        }),
      });
      emailed = res.ok;
    } catch {
      emailed = false;
    }
  }

  return Response.json({ url, emailed, hookConfigured: !!hook });
}
