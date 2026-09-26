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

export const validBox = (b: number[] | undefined): b is number[] =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every((v) => typeof v === "number" && v >= 0 && v <= 1.05) &&
  b[2] - b[0] > 0.005 &&
  b[3] - b[1] > 0.005;

/** Tighten a sloppy AI bounding box to the actual ink inside it: expand the
 *  seed, estimate the background from the border ring, and shrink to the
 *  pixels that differ from it. Vision models locate marks only roughly;
 *  the sign band behind them is usually uniform, which makes this reliable. */
export function refineBbox(
  img: HTMLImageElement,
  seed: number[],
  expand = 0.35
): number[] | null {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const bw = (seed[2] - seed[0]) * expand;
  const bh = (seed[3] - seed[1]) * expand;
  const x0 = Math.max(0, (seed[0] - bw) * W);
  const y0 = Math.max(0, (seed[1] - bh) * H);
  const x1 = Math.min(W, (seed[2] + bw) * W);
  const y1 = Math.min(H, (seed[3] + bh) * H);
  const rw = x1 - x0;
  const rh = y1 - y0;
  if (rw < 8 || rh < 8) return null;
  const scale = Math.min(1, 480 / Math.max(rw, rh));
  const cw = Math.max(8, Math.round(rw * scale));
  const ch = Math.max(8, Math.round(rh * scale));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, x0, y0, rw, rh, 0, 0, cw, ch);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cw, ch).data;
  } catch {
    return null;
  }
  // background = trimmed mean of the border ring
  const ring = Math.max(2, Math.round(Math.min(cw, ch) * 0.06));
  const border: number[][] = [];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (x >= ring && x < cw - ring && y >= ring && y < ch - ring) continue;
      const i = (y * cw + x) * 4;
      border.push([data[i], data[i + 1], data[i + 2]]);
    }
  }
  const mean = (px: number[][]) => {
    const m = [0, 0, 0];
    for (const p of px) {
      m[0] += p[0];
      m[1] += p[1];
      m[2] += p[2];
    }
    return m.map((v) => v / Math.max(1, px.length));
  };
  const d2 = (a: number[], b: number[]) =>
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  let bg = mean(border);
  bg = mean(border.filter((p) => d2(p, bg) < 60 * 60)) as number[];
  // foreground mask → row/col ink counts
  const TOL2 = 46 * 46;
  const rows = new Array<number>(ch).fill(0);
  const cols = new Array<number>(cw).fill(0);
  let fg = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (d2([data[i], data[i + 1], data[i + 2]], bg) > TOL2) {
        rows[y]++;
        cols[x]++;
        fg++;
      }
    }
  }
  if (fg < cw * ch * 0.005 || fg > cw * ch * 0.92) return null;
  const rowMin = Math.max(2, cw * 0.01);
  const colMin = Math.max(2, ch * 0.01);
  let ty0 = rows.findIndex((v) => v > rowMin);
  let ty1 = ch - 1 - [...rows].reverse().findIndex((v) => v > rowMin);
  let tx0 = cols.findIndex((v) => v > colMin);
  let tx1 = cw - 1 - [...cols].reverse().findIndex((v) => v > colMin);
  if (ty0 < 0 || tx0 < 0 || ty1 <= ty0 || tx1 <= tx0) return null;
  // small padding so glow/edges survive
  const pad = Math.round(Math.min(cw, ch) * 0.02);
  ty0 = Math.max(0, ty0 - pad);
  tx0 = Math.max(0, tx0 - pad);
  ty1 = Math.min(ch - 1, ty1 + pad);
  tx1 = Math.min(cw - 1, tx1 + pad);
  return [
    (x0 + tx0 / scale) / W,
    (y0 + ty0 / scale) / H,
    (x0 + (tx1 + 1) / scale) / W,
    (y0 + (ty1 + 1) / scale) / H,
  ];
}

/** Merge line entries that share a row (vertical overlap > 50%): vision
 *  models sometimes split one line of text into per-word entries, which
 *  would render as overlapping elements. */
export function mergeRowLines(spec: RecreateSpec): RecreateSpec {
  const lines = [...(spec.lines ?? [])];
  if (lines.length < 2 || !lines.every((l) => validBox(l.bbox))) return spec;
  lines.sort((a, b) => a.bbox![1] - b.bbox![1]);
  const merged: SpecLine[] = [];
  for (const l of lines) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const [, ay0, , ay1] = prev.bbox!;
      const [, by0, , by1] = l.bbox!;
      const overlap = Math.min(ay1, by1) - Math.max(ay0, by0);
      const hA = ay1 - ay0;
      const hB = by1 - by0;
      const minH = Math.min(hA, hB);
      // Same row means same size AND a shared baseline — a small "THE"
      // stacked over the main name can overlap vertically without being
      // part of that row, and must stay its own priced piece.
      const sameSize = minH / Math.max(hA, hB) >= 0.6;
      const sharedBaseline = Math.abs(ay1 - by1) <= 0.4 * minH;
      if (minH > 0 && overlap / minH > 0.5 && sameSize && sharedBaseline) {
        const first = prev.bbox![0] <= l.bbox![0] ? prev : l;
        const second = first === prev ? l : prev;
        prev.text = `${first.text?.trim() ?? ""} ${second.text?.trim() ?? ""}`.trim();
        prev.bbox = [
          Math.min(prev.bbox![0], l.bbox![0]),
          Math.min(prev.bbox![1], l.bbox![1]),
          Math.max(prev.bbox![2], l.bbox![2]),
          Math.max(prev.bbox![3], l.bbox![3]),
        ];
        continue;
      }
    }
    merged.push({ ...l });
  }
  return { ...spec, lines: merged };
}

/** Load an image element from a src/data URL; null on failure. */
export function loadRefImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Cut the located sign band out of the reference for the decompose pass.
 * Vision boxes come back quantized (often to tenths of the image), which is
 * a huge error on a full screenshot but nearly exact inside a tight crop —
 * so we locate first, crop with a margin, and decompose the crop. Returns
 * the crop as a JPEG data URL plus the padded box actually cut, in
 * full-image fractions, so crop-space boxes can be mapped back. */
export function cropForDecompose(
  img: HTMLImageElement,
  bbox: number[],
  padFrac = 0.08
): { dataUrl: string; box: [number, number, number, number] } | null {
  if (!validBox(bbox)) return null;
  const padX = (bbox[2] - bbox[0]) * padFrac;
  const padY = (bbox[3] - bbox[1]) * padFrac;
  const box: [number, number, number, number] = [
    Math.max(0, bbox[0] - padX),
    Math.max(0, bbox[1] - padY),
    Math.min(1, bbox[2] + padX),
    Math.min(1, bbox[3] + padY),
  ];
  const sx = box[0] * img.naturalWidth;
  const sy = box[1] * img.naturalHeight;
  const sw = (box[2] - box[0]) * img.naturalWidth;
  const sh = (box[3] - box[1]) * img.naturalHeight;
  if (sw < 8 || sh < 8) return null;
  // keep the upload light; detail is plenty at ~1400px
  const scale = Math.min(1, 1400 / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(sw * scale));
  c.height = Math.max(2, Math.round(sh * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL("image/jpeg", 0.92), box };
}

/** Map a spec whose bboxes are fractions of a crop back to fractions of the
 * full reference image, so everything downstream (mark crops at native
 * resolution, layout) keeps working against the original. */
export function specFromCrop(
  spec: RecreateSpec,
  box: [number, number, number, number]
): RecreateSpec {
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  const map = (b?: number[]) =>
    validBox(b)
      ? [
          box[0] + b![0] * w,
          box[1] + b![1] * h,
          box[0] + b![2] * w,
          box[1] + b![3] * h,
        ]
      : b;
  return {
    ...spec,
    lines: spec.lines?.map((l) => ({ ...l, bbox: map(l.bbox) })),
    marks: spec.marks?.map((m) => ({ ...m, bbox: map(m.bbox) })),
  };
}

/** Pin down one mark with a zoomed vision pass: cut a generous region
 * around its coarse decompose box, ask the model for a tight box of just
 * that element inside the region, and map the answer back to full-image
 * fractions. Box precision scales with how much of the frame the subject
 * fills, so this is what makes emblem crops tight. Falls back to the
 * original mark on any failure. */
async function zoomRegion(
  img: HTMLImageElement,
  region: [number, number, number, number],
  subject: string
): Promise<number[] | null> {
  const crop = cropForDecompose(img, region, 0);
  if (!crop) return null;
  try {
    const res = await fetch("/api/recreate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image: crop.dataUrl,
        stage: "mark",
        subject,
      }),
    });
    const out = (await res.json()) as { bbox?: number[] | null };
    if (res.ok && out.bbox && validBox(out.bbox)) {
      const [x0, y0, x1, y1] = crop.box;
      const cw = x1 - x0;
      const ch = y1 - y0;
      return [
        x0 + out.bbox[0] * cw,
        y0 + out.bbox[1] * ch,
        x0 + out.bbox[2] * cw,
        y0 + out.bbox[3] * ch,
      ];
    }
  } catch {
    // fall through to the unrefined box
  }
  return null;
}

export function locateBoxViaZoom(
  img: HTMLImageElement,
  b: number[] | undefined,
  subject: string
): Promise<number[] | null> {
  if (!validBox(b)) return Promise.resolve(null);
  // generous context: seed boxes can be a whole box-width off, so the zoom
  // region must still contain the real element when the seed misses
  const ex = Math.max((b![2] - b![0]) * 1.5, 0.12);
  const ey = Math.max((b![3] - b![1]) * 1.5, 0.12);
  return zoomRegion(
    img,
    [
      Math.max(0, b![0] - ex),
      Math.max(0, b![1] - ey),
      Math.min(1, b![2] + ex),
      Math.min(1, b![3] + ey),
    ],
    subject
  );
}

/** Show the model what a box would actually crop and ask whether it is the
 * described element. True on any transport failure — the verify pass only
 * exists to catch confidently-wrong boxes, not to add a failure mode. */
async function verifyBox(
  img: HTMLImageElement,
  bbox: number[],
  subject: string
): Promise<boolean> {
  const crop = cropForDecompose(img, bbox, 0.15);
  if (!crop) return true;
  try {
    const res = await fetch("/api/recreate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: crop.dataUrl, stage: "verify", subject }),
    });
    const out = (await res.json()) as { match?: boolean };
    if (res.ok && typeof out.match === "boolean") return out.match;
  } catch {
    // transport noise — keep the mark
  }
  return true;
}

export async function locateMarkBox(
  img: HTMLImageElement,
  mark: SpecMark,
  signRegion?: [number, number, number, number] | null
): Promise<SpecMark> {
  const subject = mark.description ?? "the emblem";
  const bbox = (await locateBoxViaZoom(img, mark.bbox, subject)) ?? mark.bbox;
  // a wrong emblem crop placed on the canvas is worse than a missing one
  if (validBox(bbox) && (await verifyBox(img, bbox!, subject)))
    return { ...mark, bbox };
  // seed was off — retry against the whole located sign band, which is
  // guaranteed to contain the element if it exists at all
  if (signRegion) {
    const retry = await zoomRegion(img, signRegion, subject);
    if (retry && (await verifyBox(img, retry, subject)))
      return { ...mark, bbox: retry };
  }
  return { ...mark, bbox: undefined };
}

/** A zoom pass can re-box a small word onto the wrong row. The decompose
 * spec's top-to-bottom row order is reliable, so wherever zoomed boxes
 * break that order, revert the line that drifted farther from its seed. */
export function enforceLineOrder(
  seeds: SpecLine[],
  zoomed: SpecLine[]
): SpecLine[] {
  const out = [...zoomed];
  const cy = (b?: number[]) => (validBox(b) ? (b![1] + b![3]) / 2 : NaN);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const s = cy(seeds[i]?.bbox) - cy(seeds[j]?.bbox);
      const z = cy(out[i].bbox) - cy(out[j].bbox);
      if (Number.isNaN(s) || Number.isNaN(z) || Math.sign(s) === Math.sign(z))
        continue;
      const di = Math.abs(cy(out[i].bbox) - cy(seeds[i].bbox));
      const dj = Math.abs(cy(out[j].bbox) - cy(seeds[j].bbox));
      if (di > dj) out[i] = { ...out[i], bbox: seeds[i].bbox };
      else out[j] = { ...out[j], bbox: seeds[j].bbox };
    }
  }
  return out;
}

export async function locateLineBox(
  img: HTMLImageElement,
  line: SpecLine
): Promise<SpecLine> {
  const bbox = await locateBoxViaZoom(
    img,
    line.bbox,
    `the words "${line.text ?? ""}" (box the WHOLE phrase, every word of it — but ONLY the lettering, never any decorative lines, rules, or symbols near it)`
  );
  return bbox ? { ...line, bbox } : line;
}

/** Refine mark bboxes in a spec against the reference image. Lines keep the
 * model's raw boxes: text is re-rendered natively, so only the stacking
 * order and relative heights matter there — and contrast-refining a text
 * box on a busy photo can drift it onto a neighboring row, which is far
 * worse than a loose box. Marks get cropped pixel-for-pixel, so their boxes
 * are worth tightening. */
export function refineSpecBoxes(
  spec: RecreateSpec,
  img: HTMLImageElement
): RecreateSpec {
  const fix = (b?: number[]) =>
    validBox(b) ? (refineBbox(img, b) ?? b) : b;
  return {
    ...spec,
    lines: spec.lines?.map((l) => {
      if (!validBox(l.bbox)) return l;
      // small expansion + center-must-stay guard: tighten to the ink
      // without letting the box wander onto a neighboring row
      const r = refineBbox(img, l.bbox!, 0.15);
      if (!r) return l;
      const cx = (r[0] + r[2]) / 2;
      const cy = (r[1] + r[3]) / 2;
      const inside =
        cx > l.bbox![0] && cx < l.bbox![2] && cy > l.bbox![1] && cy < l.bbox![3];
      return inside ? { ...l, bbox: r } : l;
    }),
    marks: spec.marks?.map((m) => ({ ...m, bbox: fix(m.bbox) })),
  };
}

/** A line box that reaches over a flanking emblem drags the centered text
 * into that emblem. Marks get located precisely (zoom pass), so wherever a
 * mark vertically shares a row with a line, clip the line box to stop at
 * the mark's edge. */
export function clipLinesAroundMarks(spec: RecreateSpec): RecreateSpec {
  if (!spec.lines?.length || !spec.marks?.length) return spec;
  const lines = spec.lines.map((l) => ({ ...l, bbox: l.bbox && [...l.bbox] }));
  for (const l of lines) {
    if (!validBox(l.bbox)) continue;
    for (const m of spec.marks) {
      if (!validBox(m.bbox)) continue;
      const [lx0, ly0, lx1, ly1] = l.bbox!;
      const [mx0, my0, mx1, my1] = m.bbox!;
      const vOverlap = Math.min(ly1, my1) - Math.max(ly0, my0);
      if (vOverlap <= 0.5 * Math.min(ly1 - ly0, my1 - my0)) continue;
      const lineCx = (lx0 + lx1) / 2;
      const markCx = (mx0 + mx1) / 2;
      if (markCx < lineCx && mx1 > lx0 && mx1 < lx1) l.bbox![0] = mx1;
      else if (markCx >= lineCx && mx0 < lx1 && mx0 > lx0) l.bbox![2] = mx0;
    }
  }
  return { ...spec, lines };
}

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

  const textRects: { x: number; y: number; w: number; h: number }[] = [];
  const texts = prepared.map((p, i) => {
    const u = lineU[i];
    const inkH = (u.y1 - u.y0) * S; // capital-letter height in photo px
    const fontSize = fontSizeForLetterHeight(inkH * ipp, ipp, p.font.family);
    const w = measureTextWidth(p.l.text!.trim(), fontSize, p.font.family);
    const cx = mapX((u.x0 + u.x1) / 2);
    const cy = mapY((u.y0 + u.y1) / 2);
    const x = Math.max(0, cx - w / 2);
    const y = Math.max(0, cy - fontSize / 2);
    textRects.push({ x, y, w, h: fontSize });
    return lineToElement(p.l, p.font, fontSize, x, y, now, i);
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

  // Rendered text width comes from cap height, not from the reference box,
  // so lettering can spill over a flanking emblem even when the boxes were
  // right. Emblems never sit ON the lettering on a real sign — push any
  // mark that lands on a text row out to the nearest side of that text.
  for (const mk of marks) {
    for (let pass = 0; pass < 2; pass++) {
      for (const t of textRects) {
        const vOverlap =
          Math.min(mk.y + mk.height, t.y + t.h) - Math.max(mk.y, t.y);
        if (vOverlap <= 0.3 * Math.min(mk.height, t.h)) continue;
        if (mk.x + mk.width <= t.x || mk.x >= t.x + t.w) continue;
        const gap = t.h * 0.25;
        if (mk.x + mk.width / 2 < t.x + t.w / 2)
          mk.x = Math.max(0, t.x - gap - mk.width);
        else mk.x = Math.min(imageW - mk.width, t.x + t.w + gap);
      }
    }
  }

  return {
    texts,
    marks,
    unplacedMarks: (spec.marks ?? [])
      .filter((m) => !validBox(m.bbox))
      .map((m) => m.description)
      .filter(Boolean) as string[],
  };
}
