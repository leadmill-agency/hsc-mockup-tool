// Called by the booking Zap (Google Calendar → new event → webhook):
// creates a fresh project for the customer and returns their personal link,
// which the Zap's next step emails to them (Flow 1, PRD §7.0).
import { ensureSchema, sql } from "@/lib/db";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    start_time?: string;
  };
  const email = (body.email ?? "").trim().slice(0, 200);
  const name = (body.name ?? "").trim().slice(0, 120);

  let when = "";
  if (body.start_time) {
    const d = new Date(body.start_time);
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      });
    }
  }
  const label =
    [name || email || "Customer", when ? `· consult ${when}` : ""]
      .filter(Boolean)
      .join(" ")
      .slice(0, 200) || "Customer project";

  await ensureSchema();
  const id = crypto.randomUUID();
  const state = {
    squareParams: { rotate: 0, vPersp: 0, hPersp: 0 },
    measurement: null,
    elements: [],
    backerPlates: 0,
    step: "upload",
    customer: { email, name, startTime: body.start_time ?? null },
  };
  await sql()`
    INSERT INTO projects (id, name, updated_at, state)
    VALUES (${id}, ${label}, ${Date.now()}, ${JSON.stringify(state)}::jsonb)`;

  const origin = new URL(req.url).origin;
  return Response.json({
    project_id: id,
    project_url: `${origin}/?open=${id}`,
    customer_email: email,
    consult_time: when,
  });
}
