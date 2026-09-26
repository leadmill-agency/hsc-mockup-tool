// Client half of "split into pieces": turn the extractor's spec into native
// TextElements plus crop jobs for non-text marks (emblems, rules). When the
// extractor supplies bounding boxes, the reference's own layout is preserved
// — small lines stay small and centered where they were, emblems keep their
// spot beside the text — scaled onto the storefront photo.
import {
  fontSizeForLetterHeight,
  invalidateCapHeight,
  measureTextWidth,
  TextElement,
} from "@/lib/types";
import { loadGoogleFont } from "@/lib/fonts";

export interface SpecLine {
  text?: string;
  fontStyle?: string;
  color?: string;
  trimColor?: string;
  lighting?: string;
  ledColor?: string;
  signStyle?: string;
  raceway?: boolean;
  heightRatio?: number;
  bbox?: number[];
}

export interface SpecMark {
  description?: string;
  bbox?: number[];
}

export interface RecreateSpec {
  lines?: SpecLine[];
  marks?: SpecMark[];
  notes?: string;
  scene?: string;
}

/** A non-text piece to crop out of the reference and place on the photo.
 *  bbox is fractional (reference image space); x/y/width/height are target
 *  placement in storefront-photo pixels. */
export interface MarkJob {
  bbox: [number, number, number, number];
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RecreateLayout {
  texts: TextElement[];
  marks: MarkJob[];
  /** marks the extractor mentioned but couldn't locate (no usable bbox) */
  unplacedMarks: string[];
}

const FONT_BY_STYLE: Record<string, { family: string; google?: string }> = {
  block: { family: "'Archivo', Arial, sans-serif", google: "Archivo" },
  condensed: { family: "'Oswald', 'Arial Narrow', sans-serif", google: "Oswald" },
  script: {
    family: "'Dancing Script', 'Brush Script MT', cursive",
    google: "Dancing Script",
  },
  serif: { family: "'Playfair Display', Georgia, serif", google: "Playfair Display" },
  rounded: {
    family: "'Arial Rounded MT Bold', 'Helvetica Neue', sans-serif",
  },
  clean: { family: "'Helvetica Neue', Arial, sans-serif" },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const hex = (v: string | undefined, fallback: string): string =>
  v && HEX_RE.test(v) ? v : fallback;

const validBox = (b: number[] | undefined): b is number[] =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every((v) => typeof v === "number" && v >= 0 && v <= 1.05) &&
  b[2] - b[0] > 0.005 &&
  b[3] - b[1] > 0.005;

function lineToElement(
  l: SpecLine,
  font: { family: string },
  fontSize: number,
  x: number,
  y: number,
  now: number,
  i: number
): TextElement {
  const lighting =
    l.lighting === "halo" || l.lighting === "none" ? l.lighting : "front";
  const signStyle =
    l.signStyle === "cabinet" || l.signStyle === "cloud" ? l.signStyle : "letters";
  return {
    id: `t${now + i}`,
    kind: "text",
    text: l.text!.trim(),
    x,
    y,
    fontSize,
    fill: hex(l.color, "#f5f5f5"),
    trimColor: hex(l.trimColor, "#26221f"),
    lighting,
    ledColor: hex(l.ledColor, lighting === "halo" ? "#fff3d6" : "#ffffff"),
    fontFamily: font.family,
    signStyle,
    raceway: signStyle === "letters" ? !!l.raceway : false,
    backerColor: signStyle === "letters" ? undefined : "#f7f5f0",
    rotation: 0,
  };
}

/** Build a faithful layout from an extraction spec.
 *  `refAspect` = reference image width / height (for bbox unit conversion). */
export async function specToLayout(
  spec: RecreateSpec,
  imageW: number,
  imageH: number,
  ipp: number,
  anchorY: number | undefined,
  refAspect: number,
  tallestInches = 18
): Promise<RecreateLayout> {
  const lines = (spec.lines ?? [])
    .filter((l) => typeof l.text === "string" && l.text.trim().length > 0)
    .slice(0, 6);
  if (!lines.length) return { texts: [], marks: [], unplacedMarks: [] };

  const prepared = lines.map((l) => ({
    l,
    font: FONT_BY_STYLE[l.fontStyle ?? ""] ?? FONT_BY_STYLE.block,
  }));
  await Promise.all(
    [...new Set(prepared.map((p) => p.font.google).filter(Boolean))].map(
      async (g) => {
        await loadGoogleFont(g!).catch(() => {});
      }
    )
  );
  for (const p of prepared) invalidateCapHeight(p.font.family);

  const allBoxed =
    prepared.every((p) => validBox(p.l.bbox)) && refAspect > 0;
  const now = Date.now();

  if (!allBoxed) {
    // fallback: centered stack using height ratios (pre-bbox behavior)
    const sized = prepared.map((p) => {
      const ratio = Math.min(1, Math.max(0.15, Number(p.l.heightRatio) || 1));
      const fontSize = fontSizeForLetterHeight(
        ratio * tallestInches,
        ipp,
        p.font.family
      );
      return { ...p, fontSize, w: measureTextWidth(p.l.text!.trim(), fontSize, p.font.family) };
    });
    const maxW = imageW * 0.7;
    const widest = Math.max(...sized.map((s) => s.w));
    const fit = widest > maxW ? maxW / widest : 1;
    const gap = Math.max(...sized.map((f) => f.fontSize)) * fit * 0.35;
    const totalH =
      sized.reduce((sum, f) => sum + f.fontSize * fit, 0) + gap * (sized.length - 1);
    const anchor = anchorY ?? imageH * 0.4;
    let y = Math.max(imageH * 0.02, anchor - imageH * 0.03 - totalH);
    const texts = sized.map((f, i) => {
      const el = lineToElement(
        f.l,
        f.font,
        f.fontSize * fit,
        Math.max(0, (imageW - f.w * fit) / 2),
        y,
        now,
        i
      );
      y += f.fontSize * fit + gap;
      return el;
    });
    return {
      texts,
      marks: [],
      unplacedMarks: (spec.marks ?? [])
        .map((m) => m.description)
        .filter(Boolean) as string[],
    };
  }

  // ---- bbox-faithful layout ----
  // Reference units: x in [0,1]×refAspect (so x and y share one scale), y in [0,1].
  const toU = (b: number[]) => ({
    x0: b[0] * refAspect,
    y0: b[1],
    x1: b[2] * refAspect,
    y1: b[3],
  });
  const lineU = prepared.map((p) => toU(p.l.bbox!));
  const markEntries = (spec.marks ?? []).filter((m) => validBox(m.bbox));
  const markU = markEntries.map((m) => toU(m.bbox!));
  const all = [...lineU, ...markU];
  const bx0 = Math.min(...all.map((u) => u.x0));
  const bx1 = Math.max(...all.map((u) => u.x1));
  const by0 = Math.min(...all.map((u) => u.y0));
  const by1 = Math.max(...all.map((u) => u.y1));

  // scale: tallest line's ink height ↦ tallestInches of capital letters
  const tallestU = Math.max(...lineU.map((u) => u.y1 - u.y0));
  let S = tallestInches / ipp / tallestU; // photo px per reference unit
  // fit the whole lockup within 80% of the storefront width
  const lockupW = (bx1 - bx0) * S;
  if (lockupW > imageW * 0.8) S *= (imageW * 0.8) / lockupW;

  const anchor = anchorY ?? imageH * 0.4;
  const lockupH = (by1 - by0) * S;
  const topY = Math.max(imageH * 0.02, anchor - imageH * 0.03 - lockupH);
  const leftX = Math.max(0, (imageW - (bx1 - bx0) * S) / 2);
  const mapX = (u: number) => leftX + (u - bx0) * S;
  const mapY = (u: number) => topY + (u - by0) * S;

  const texts = prepared.map((p, i) => {
    const u = lineU[i];
    const inkH = (u.y1 - u.y0) * S; // capital-letter height in photo px
    const fontSize = fontSizeForLetterHeight(inkH * ipp, ipp, p.font.family);
    const w = measureTextWidth(p.l.text!.trim(), fontSize, p.font.family);
    const cx = mapX((u.x0 + u.x1) / 2);
    const cy = mapY((u.y0 + u.y1) / 2);
    return lineToElement(
      p.l,
      p.font,
      fontSize,
      Math.max(0, cx - w / 2),
      Math.max(0, cy - fontSize / 2),
      now,
      i
    );
  });

  const marks: MarkJob[] = markEntries.map((m, i) => {
    const u = markU[i];
    return {
      bbox: m.bbox as [number, number, number, number],
      description: m.description ?? "mark",
      x: mapX(u.x0),
      y: mapY(u.y0),
      width: (u.x1 - u.x0) * S,
      height: (u.y1 - u.y0) * S,
    };
  });

  return {
    texts,
    marks,
    unplacedMarks: (spec.marks ?? [])
      .filter((m) => !validBox(m.bbox))
      .map((m) => m.description)
      .filter(Boolean) as string[],
  };
}
