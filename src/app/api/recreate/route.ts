// Decompose a customer's reference/AI sign image into buildable pieces:
// Claude vision reads the image and returns one entry per text line (style,
// colors, lighting, relative height) plus any non-text marks. The client
// instantiates native elements from this, so every piece gets a real letter
// height and exact per-piece pricing — the reference stops being "one blob".
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const PROMPT = `You are decomposing a storefront sign (from a customer's reference or AI-generated image) into buildable channel-letter pieces for a sign fabricator. Identify ONLY the sign itself — ignore the building, surrounding photo, email chrome, cars, or people.

Reply with ONLY a JSON object, no prose, no code fences:
{
  "lines": [
    {
      "text": "exact lettering of this line",
      "fontStyle": "block|condensed|script|serif|rounded|clean",
      "color": "#hex of the letter faces",
      "trimColor": "#hex of the letter edges/trim",
      "lighting": "front|halo|none",
      "ledColor": "#hex of the glow, if lit",
      "signStyle": "letters|cabinet|cloud",
      "raceway": false,
      "heightRatio": 1.0
    }
  ],
  "marks": [
    { "description": "short description of any non-text emblem/logo and where it sits relative to the text" }
  ],
  "notes": "one sentence about the overall arrangement"
}

Rules: one entry per visually distinct line of text, in top-to-bottom order. heightRatio is each line's capital-letter height relative to the TALLEST line (tallest = 1.0). signStyle "letters" = individual channel letters; "cabinet" = rectangular lit box behind the whole line; "cloud" = a shaped backer plate hugging the letter outlines. lighting "halo" = letters glow from behind; "front" = the faces themselves glow. raceway = true only if the letters visibly sit on a horizontal mounting box. Use best-judgment hex colors.`;

const DATA_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/;

/** Defensive parse: strip fences, take the outermost JSON object. */
function parseSpec(text: string): Response {
  const jsonText = text.replace(/```(?:json)?/g, "").trim();
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return Response.json(
      { error: "could not read the sign from this image" },
      { status: 422 }
    );
  }
  try {
    return Response.json(JSON.parse(jsonText.slice(start, end + 1)));
  } catch {
    return Response.json(
      { error: "could not read the sign from this image" },
      { status: 422 }
    );
  }
}

async function viaAnthropic(
  mediaType: string,
  data: string
): Promise<Response> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/png"
                | "image/jpeg"
                | "image/webp"
                | "image/gif",
              data,
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
  }
  return parseSpec(text);
}

async function viaOpenAI(imageDataUrl: string): Promise<Response> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json(
      { error: `OpenAI request failed (${res.status}): ${detail.slice(0, 200)}` },
      { status: 502 }
    );
  }
  const out = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseSpec(out.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { image?: string } | null;
  const m = body?.image?.match(DATA_RE);
  if (!m) return Response.json({ error: "send { image: dataURL }" }, { status: 400 });

  // whichever key is configured wins; Anthropic first when both exist
  if (process.env.ANTHROPIC_API_KEY) return viaAnthropic(m[1], m[2]);
  if (process.env.OPENAI_API_KEY) return viaOpenAI(body!.image!);
  return Response.json(
    {
      error:
        "AI splitting is not configured yet — add ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel → hsc-mockup-tool → Settings → Environment Variables.",
    },
    { status: 503 }
  );
}
