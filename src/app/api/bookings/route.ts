// Called by the booking Zap (Google Calendar → new event → webhook):
// creates a fresh project for the customer and returns their personal link,
// which the Zap's next step emails to them (Flow 1, PRD §7.0).
import { ensureSchema, sql } from "@/lib/db";

interface RawAttendee {
  email?: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
  resource?: boolean;
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    start_time?: string;
    // raw Google Calendar event shape (Zapier "Data Pass-Through")
    attendees?: RawAttendee[];
    start?: { dateTime?: string; date?: string };
    organizer?: { email?: string };
  };

  // prefer explicit fields; fall back to parsing a raw calendar event
  let email = (body.email ?? "").trim().slice(0, 200);
  let name = (body.name ?? "").trim().slice(0, 120);
  if (!email && Array.isArray(body.attendees)) {
    const customer = body.attendees.find(
      (a) =>
        a.email &&
        !a.organizer &&
        !a.self &&
        !a.resource &&
        a.email !== body.organizer?.email
    );
    email = (customer?.email ?? "").trim().slice(0, 200);
    name = (customer?.displayName ?? "").trim().slice(0, 120);
  }
  if (!body.start_time && body.start?.dateTime) {
    body.start_time = body.start.dateTime;
  }

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
