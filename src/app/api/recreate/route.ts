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
      "heightRatio": 1.0,
      "bbox": [0.0, 0.0, 1.0, 1.0]
    }
  ],
  "marks": [
    {
      "description": "short description of any non-text element: emblem, logo, icon, decorative rule/line, flourish",
      "bbox": [0.0, 0.0, 1.0, 1.0]
    }
  ],
  "notes": "one sentence about the overall arrangement",
  "scene": "day|dusk|night"
}

Rules: "scene" is the lighting of the reference photo itself (is the sign shown lit at night/dusk, or unlit daytime?). Every "bbox" is [x0, y0, x1, y1] as FRACTIONS (0-1) of the full image, drawn tightly around that element's ink — be as precise as you can, these drive placement. Include decorative rules/lines and every emblem as marks — each separate symbol is its OWN mark with its own tight bbox (an emblem left of the text and a symbol right of it are TWO marks, never one). One text entry per visual ROW of text, top-to-bottom: words sharing one baseline at the SAME size are ONE entry ("PRAYER HEAVEN" is one line, never two words) — but a smaller word stacked above or below the main name (a small "THE" over it) is its OWN entry with its own smaller bbox. heightRatio is each line's capital-letter height relative to the TALLEST line (tallest = 1.0). signStyle "letters" = individual channel letters; "cabinet" = rectangular lit box behind the whole line; "cloud" = a shaped backer plate hugging the letter outlines. lighting "halo" = letters glow from behind; "front" = the faces themselves glow. raceway = true only if the letters visibly sit on a horizontal mounting box. Use best-judgment hex colors.`;

// Stage 1 of the two-pass split: find the sign band first, so the client
// can crop it out and decompose the crop. Vision models return coarse
// fractional boxes (often quantized to tenths) — on a full screenshot that
// is a ~150px error, but inside a tight sign crop it's nearly exact.
const LOCATE_PROMPT = `Find the storefront sign this image is about — the sign band carrying the business name (the image may be a photo, an AI mockup, or a screenshot/email containing one; if several storefront signs are visible, pick the prominent one that is the subject).

Reply with ONLY a JSON object, no prose, no code fences:
{ "bbox": [x0, y0, x1, y1] }

"bbox" is in FRACTIONS (0-1) of the full image, drawn around the ENTIRE sign — every word AND every emblem/symbol beside the words — with a small margin so nothing is clipped.`;

// Stage 3: pin down ONE mark inside a small zoomed region. Box precision
// scales with how much of the frame the subject fills, so per-mark zoom
// passes are what finally make the crops tight.
const markPrompt = (subject: string) =>
  `This is a small crop of a storefront sign. Find this element: ${subject}.

Reply with ONLY a JSON object, no prose, no code fences:
{ "bbox": [x0, y0, x1, y1] }

"bbox" is in FRACTIONS (0-1) of THIS image, drawn TIGHTLY around just that element's ink — no wall, no neighboring letters or other elements. If the element is not visible in this image, reply { "bbox": null }.`;

// Final gate: a wrong crop placed on the canvas is worse than a missing
// one (the rep can always use "Crop from reference" by hand), so every
// mark crop is shown back to the model before it's placed.
const verifyPrompt = (subject: string) =>
  `Does this image clearly show: ${subject}? It counts if that element is the main thing in frame, even when slightly cropped — but NOT if the frame mostly shows a wall, a different sign, or other elements.

Reply with ONLY a JSON object, no prose, no code fences:
{ "match": true } or { "match": false }`;

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
  data: string,
  prompt: string
): Promise<Response> {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    temperature: 0,
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
          { type: "text", text: prompt },
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

async function viaOpenAI(
  imageDataUrl: string,
  prompt: string
): Promise<Response> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: prompt },
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
  const body = (await req.json().catch(() => null)) as {
    image?: string;
    stage?: string;
    subject?: string;
  } | null;
  const m = body?.image?.match(DATA_RE);
  if (!m) return Response.json({ error: "send { image: dataURL }" }, { status: 400 });
  const subject = String(body?.subject ?? "the emblem")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  const prompt =
    body?.stage === "locate"
      ? LOCATE_PROMPT
      : body?.stage === "mark"
        ? markPrompt(subject)
        : body?.stage === "verify"
          ? verifyPrompt(subject)
          : PROMPT;

  // whichever key is configured wins; Anthropic first when both exist
  if (process.env.ANTHROPIC_API_KEY) return viaAnthropic(m[1], m[2], prompt);
  if (process.env.OPENAI_API_KEY) return viaOpenAI(body!.image!, prompt);
  return Response.json(
    {
      error:
        "AI splitting is not configured yet — add ANTHROPIC_API_KEY or OPENAI_API_KEY in Vercel → hsc-mockup-tool → Settings → Environment Variables.",
    },
    { status: 503 }
  );
}
