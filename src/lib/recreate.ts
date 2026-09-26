// Client half of "split into pieces": turn the extractor's spec into native
// TextElements — real fonts, real letter heights, stacked and centered — so
// the recreated sign prices per piece exactly like a hand-built one.
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
}

export interface RecreateSpec {
  lines?: SpecLine[];
  marks?: { description?: string }[];
  notes?: string;
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

/** Build stacked, centered TextElements from an extraction spec.
 *  `tallestInches` anchors the scale; lines keep the spec's height ratios. */
export async function specToElements(
  spec: RecreateSpec,
  imageW: number,
  imageH: number,
  ipp: number,
  anchorY: number | undefined,
  tallestInches = 18
): Promise<TextElement[]> {
  const lines = (spec.lines ?? [])
    .filter((l) => typeof l.text === "string" && l.text.trim().length > 0)
    .slice(0, 6);
  if (!lines.length) return [];

  const prepared = lines.map((l) => {
    const font = FONT_BY_STYLE[l.fontStyle ?? ""] ?? FONT_BY_STYLE.block;
    const ratio = Math.min(1, Math.max(0.15, Number(l.heightRatio) || 1));
    return { l, font, inches: ratio * tallestInches };
  });

  // real glyph metrics need the webfonts loaded first
  await Promise.all(
    [...new Set(prepared.map((p) => p.font.google).filter(Boolean))].map(
      async (g) => {
        await loadGoogleFont(g!).catch(() => {});
      }
    )
  );
  for (const p of prepared) invalidateCapHeight(p.font.family);

  // scale the whole lockup down together if the widest line overflows
  const sized = prepared.map((p) => {
    const fontSize = fontSizeForLetterHeight(p.inches, ipp, p.font.family);
    return { ...p, fontSize, w: measureTextWidth(p.l.text!.trim(), fontSize, p.font.family) };
  });
  const maxW = imageW * 0.7;
  const widest = Math.max(...sized.map((s) => s.w));
  const fit = widest > maxW ? maxW / widest : 1;

  const final = sized.map((s) => {
    const fontSize = s.fontSize * fit;
    return {
      ...s,
      fontSize,
      w: s.w * fit,
    };
  });

  const gap = Math.max(...final.map((f) => f.fontSize)) * 0.35;
  const totalH =
    final.reduce((sum, f) => sum + f.fontSize, 0) + gap * (final.length - 1);
  const anchor = anchorY ?? imageH * 0.4;
  let y = Math.max(imageH * 0.02, anchor - imageH * 0.03 - totalH);

  const now = Date.now();
  return final.map((f, i) => {
    const l = f.l;
    const lighting =
      l.lighting === "halo" || l.lighting === "none" ? l.lighting : "front";
    const signStyle =
      l.signStyle === "cabinet" || l.signStyle === "cloud"
        ? l.signStyle
        : "letters";
    const el: TextElement = {
      id: `t${now + i}`,
      kind: "text",
      text: l.text!.trim(),
      x: Math.max(0, (imageW - f.w) / 2),
      y,
      fontSize: f.fontSize,
      fill: hex(l.color, "#f5f5f5"),
      trimColor: hex(l.trimColor, "#26221f"),
      lighting,
      ledColor: hex(l.ledColor, lighting === "halo" ? "#fff3d6" : "#ffffff"),
      fontFamily: f.font.family,
      signStyle,
      raceway: signStyle === "letters" ? !!l.raceway : false,
      backerColor: signStyle === "letters" ? undefined : "#f7f5f0",
      rotation: 0,
    };
    y += f.fontSize + gap;
    return el;
  });
}
