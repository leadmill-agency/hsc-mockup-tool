// All coordinates are stored in corrected-image pixel space; the canvas
// stages apply a uniform display scale on top.

export type RefKind = "width" | "door" | "custom";

export interface RefLine {
  id: string;
  kind: RefKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  feet: number;
  inches: number;
  /** A preset (door: 7 ft) only counts once the user has positioned it —
   *  an untouched default must never silently drive pricing. */
  placed: boolean;
}

export interface Measurement {
  references: RefLine[];
}

/** Legacy single-line shape from older saved projects. */
export interface MeasurementState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  feet: number;
  inches: number;
}

export function migrateMeasurement(
  m: Measurement | MeasurementState | null
): Measurement | null {
  if (!m) return null;
  if ("references" in m) return m;
  return {
    references: [
      {
        id: "legacy",
        kind: "width",
        x1: m.x1,
        y1: m.y1,
        x2: m.x2,
        y2: m.y2,
        feet: m.feet,
        inches: m.inches,
        placed: true,
      },
    ],
  };
}

export type Lighting = "front" | "halo" | "none";

export interface TextElement {
  id: string;
  kind: "text";
  text: string;
  x: number;
  y: number;
  fontSize: number; // image px; cap height × capHeightRatio = letter height
  fill: string;
  rotation: number;
  fontFamily?: string; // one of FONTS; defaults to SIGN_FONT
  raceway?: boolean; // mounted on a raceway: drawn behind letters + priced
  racewayColor?: string; // painted to match the wall; sampled from the photo
  trimColor?: string; // trim cap + return color; default dark bronze
  lighting?: Lighting; // default "front"; drives night rendering + proposal
  ledColor?: string; // LED color: halo wash / front-lit glow at night
  signStyle?: "letters" | "cabinet" | "cloud"; // letters (default), box sign, or contour "cloud" backer
  backer?: boolean; // letters mounted on a backer panel (+$400 each)
  backerColor?: string; // backer panel color, or the cabinet face color
}

/** Cabinet face extends this far beyond the text, in inches. */
export const CABINET_PAD_IN = { x: 8, y: 5 };
/** Cloud (contour) backer margin around the lettering, in inches. */
export const CLOUD_PAD_IN = { x: 5, y: 3.5 };
/** Box-style signs price and render as one piece with a face plate. */
export function isBoxStyle(el: TextElement): boolean {
  return el.signStyle === "cabinet" || el.signStyle === "cloud";
}
/** Backer panel margin around the letters, in inches. */
export const BACKER_PAD_IN = { x: 6, y: 4 };

export function isCabinet(el: SignElement): el is TextElement {
  return (
    el.kind === "text" &&
    (el.signStyle === "cabinet" || el.signStyle === "cloud")
  );
}

/** Number of backer plates implied by the design (+$400 each): one per
 *  free-standing panel element. */
export function backerCount(elements: SignElement[]): number {
  return elements.filter((e) => e.kind === "panel").length;
}

/** Overall box/cloud height in inches (text + face margins). */
export function cabinetHeightInches(el: TextElement, ipp: number): number {
  const pad = el.signStyle === "cloud" ? CLOUD_PAD_IN : CABINET_PAD_IN;
  return el.fontSize * ipp + pad.y * 2;
}

export interface LogoElement {
  id: string;
  kind: "logo";
  src: string; // data URL currently displayed
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  originalSrc?: string; // as uploaded
  processedSrc?: string; // background removed, when confidently detected
  bgRemoved?: boolean;
  lighting?: Lighting;
  ledColor?: string;
  // branded lockups fabricated as channel letters price per letter, not as
  // one piece — staff enter the count and true letter height
  priceAsLetters?: boolean;
  letterCount?: number;
  letterHeightRatio?: number; // letter height ÷ logo height; scales with resize
}

/** Free-standing backer panel: sized and positioned independently, with
 *  text and logos layered on top. Prices as a backer plate (+$400 each). */
export interface PanelElement {
  id: string;
  kind: "panel";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill?: string; // painted aluminum color; default dark bronze
  round?: boolean; // pill shape: fully rounded ends (menu bars, badges)
}

export type SignElement = TextElement | LogoElement | PanelElement;

export function refPixelLength(r: RefLine): number {
  return Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
}

export function refKnownInches(r: RefLine): number {
  return r.feet * 12 + r.inches;
}

/** A reference contributes to the scale once it has a real value and, for
 *  presets like the 7-ft door, has been positioned by the user. */
export function refActive(r: RefLine): boolean {
  return refPixelLength(r) >= 10 && refKnownInches(r) > 0 && r.placed;
}

/** Combined inches-per-pixel: active references weighted by line length
 *  (total inches ÷ total pixels), or null when nothing is measurable. */
export function inchesPerPixel(m: Measurement | null): number | null {
  const active = m?.references.filter(refActive) ?? [];
  if (active.length === 0) return null;
  let totalInches = 0;
  let totalPx = 0;
  for (const r of active) {
    totalInches += refKnownInches(r);
    totalPx += refPixelLength(r);
  }
  return totalPx > 0 ? totalInches / totalPx : null;
}

/** Worst pairwise disagreement between active references (0.2 = 20%),
 *  or null with fewer than two. The built-in sanity check: a big mismatch
 *  means a wrong number or a reference on a different wall plane. */
export function referenceMismatch(m: Measurement | null): number | null {
  const active = m?.references.filter(refActive) ?? [];
  if (active.length < 2) return null;
  const ipps = active.map((r) => refKnownInches(r) / refPixelLength(r));
  const min = Math.min(...ipps);
  const max = Math.max(...ipps);
  return min > 0 ? max / min - 1 : null;
}

export const SIGN_FONT = "'Arial Black', Arial, sans-serif";

/** Curated sign-appropriate font presets (bold weight, widely installed). */
export const FONTS: { label: string; family: string }[] = [
  { label: "Block", family: SIGN_FONT },
  { label: "Clean", family: "'Helvetica Neue', Arial, sans-serif" },
  { label: "Rounded", family: "'Arial Rounded MT Bold', 'Helvetica Neue', sans-serif" },
  { label: "Condensed", family: "'Arial Narrow', Arial, sans-serif" },
  { label: "Slab", family: "Rockwell, 'Courier New', serif" },
  { label: "Serif", family: "Georgia, 'Times New Roman', serif" },
  { label: "Script", family: "'Snell Roundhand', 'Brush Script MT', cursive" },
];

// Sign-industry "letter height" is the CAPITAL letter height, not the font's
// em size. Cap height varies per font, so measure and cache per family.
const _capRatios = new Map<string, number>();
/** Drop a cached cap ratio — call after a webfont finishes loading. */
export function invalidateCapHeight(family: string): void {
  _capRatios.delete(family);
  for (const key of _glyphRatios.keys()) {
    if (key.startsWith(family + "|")) _glyphRatios.delete(key);
  }
}
export function capHeightRatio(family: string = SIGN_FONT): number {
  const cached = _capRatios.get(family);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return 0.72;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0.72;
  ctx.font = `bold 100px ${family}`;
  const m = ctx.measureText("H");
  const ratio = m.actualBoundingBoxAscent ? m.actualBoundingBoxAscent / 100 : 0.72;
  _capRatios.set(family, ratio);
  return ratio;
}

// Per-glyph ink heights: an apostrophe is a small fabricated piece, not a
// full-height letter, and pricing should reflect that (owner rule).
const _glyphRatios = new Map<string, number>();
export function glyphHeightRatio(
  ch: string,
  family: string = SIGN_FONT
): number {
  const key = family + "|" + ch;
  const cached = _glyphRatios.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return 0.72;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0.72;
  ctx.font = `bold 100px ${family}`;
  const m = ctx.measureText(ch);
  const h = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 100;
  const ratio = h > 0.04 ? h : capHeightRatio(family);
  _glyphRatios.set(key, ratio);
  return ratio;
}

export interface TextPieceGroup {
  heightInches: number;
  count: number;
}

/** Pieces of a channel-letter run grouped by measured glyph height (rounded
 *  to the inch): "DICKEY'S" is 7 letters at cap height plus one small
 *  apostrophe piece, priced at its own height. */
export function textPieceGroups(
  el: TextElement,
  ipp: number
): TextPieceGroup[] {
  const family = el.fontFamily ?? SIGN_FONT;
  const heights = [...el.text.replace(/\s/g, "")]
    .map((ch) => el.fontSize * glyphHeightRatio(ch, family) * ipp)
    .sort((a, b) => b - a);
  if (!heights.length) return [];
  // cluster with tolerance so measurement noise doesn't split same-size
  // letters; a genuinely small piece (apostrophe, period) forms its own group
  const groups: { rep: number; count: number }[] = [];
  for (const h of heights) {
    const g = groups[groups.length - 1];
    if (g && g.rep - h < Math.max(1.5, g.rep * 0.15)) {
      g.count++;
    } else {
      groups.push({ rep: h, count: 1 });
    }
  }
  // the main letter group displays as the element's nominal letter height
  const capH = textLetterHeightInches(el, ipp);
  return groups.map((g) => ({
    heightInches:
      Math.abs(g.rep - capH) / capH < 0.12
        ? capH
        : Math.max(1, Math.round(g.rep)),
    count: g.count,
  }));
}

/** True capital-letter height of a text element, in inches. */
export function textLetterHeightInches(el: TextElement, ipp: number): number {
  return el.fontSize * capHeightRatio(el.fontFamily) * ipp;
}

/** Rendered width of a text run in image pixels. */
export function measureTextWidth(
  text: string,
  fontSize: number,
  family: string = SIGN_FONT
): number {
  if (typeof document === "undefined") return text.length * fontSize * 0.6;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * fontSize * 0.6;
  ctx.font = `bold ${fontSize}px ${family}`;
  return ctx.measureText(text).width;
}

/** Number of wireways/raceways implied by the design. */
export function racewayCount(elements: SignElement[]): number {
  return elements.filter(
    (e) =>
      e.kind === "text" && (e.signStyle ?? "letters") === "letters" && e.raceway
  ).length;
}

/** Font size that renders the given capital-letter height. */
export function fontSizeForLetterHeight(
  inches: number,
  ipp: number,
  family: string = SIGN_FONT
): number {
  return inches / (capHeightRatio(family) * ipp);
}

/** Rendered width of a text element, in inches. */
export function textWidthInches(el: TextElement, ipp: number): number {
  return measureTextWidth(el.text, el.fontSize, el.fontFamily) * ipp;
}
