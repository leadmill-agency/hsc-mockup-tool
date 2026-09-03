// All coordinates are stored in corrected-image pixel space; the canvas
// stages apply a uniform display scale on top.

export interface MeasurementState {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  feet: number;
  inches: number;
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
  // branded lockups fabricated as channel letters price per letter, not as
  // one piece — staff enter the count and true letter height
  priceAsLetters?: boolean;
  letterCount?: number;
  letterHeightRatio?: number; // letter height ÷ logo height; scales with resize
}

export type SignElement = TextElement | LogoElement;

export function measurementPixelLength(m: MeasurementState): number {
  return Math.hypot(m.x2 - m.x1, m.y2 - m.y1);
}

export function measurementKnownInches(m: MeasurementState): number {
  return m.feet * 12 + m.inches;
}

/** Inches per corrected-image pixel, or null if not measurable yet. */
export function inchesPerPixel(m: MeasurementState | null): number | null {
  if (!m) return null;
  const px = measurementPixelLength(m);
  const inches = measurementKnownInches(m);
  if (px < 10 || inches <= 0) return null;
  return inches / px;
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
  return elements.filter((e) => e.kind === "text" && e.raceway).length;
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
