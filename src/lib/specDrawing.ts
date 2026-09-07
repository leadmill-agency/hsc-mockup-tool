// Dimensioned spec drawing for proposals (HSC house style): the sign lockup
// on a neutral ground with dimension lines — overall width/height in ink,
// per-line letter heights and wireway lengths in brand blue. Rendered on a
// plain 2D canvas from the same element data that drives the photo mockup,
// so the numbers always match what was priced.

import {
  CABINET_PAD_IN,
  cabinetHeightInches,
  CLOUD_PAD_IN,
  isBoxStyle,
  measureTextWidth,
  SignElement,
  SIGN_FONT,
  TextElement,
  textLetterHeightInches,
} from "@/lib/types";
import { formatFeetInches } from "@/lib/pricing";

const INK = "#18181b";
const BLUE = "#1d4ed8";
const GROUND = "#ededec";
const LABEL_FONT = "700 15px ui-monospace, Menlo, monospace";

const RW_PAD_IN = 2; // raceway side margin (matches the canvas render)
const RW_H_IN = 8; // standard raceway height

interface Ext {
  el: SignElement;
  x1: number; // image-px extents (including raceway overhang)
  y1: number;
  x2: number;
  y2: number;
}

function textExtent(el: TextElement, ipp: number): Ext {
  const family = el.fontFamily ?? SIGN_FONT;
  const w = measureTextWidth(el.text, el.fontSize, family);
  if (isBoxStyle(el)) {
    const pad = el.signStyle === "cloud" ? CLOUD_PAD_IN : CABINET_PAD_IN;
    const padX = pad.x / ipp;
    const padY = pad.y / ipp;
    return {
      el,
      x1: el.x - padX,
      y1: el.y - padY,
      x2: el.x + w + padX,
      y2: el.y + el.fontSize + padY,
    };
  }
  const rw = el.raceway ? RW_PAD_IN / ipp : 0;
  return {
    el,
    x1: el.x - rw,
    y1: el.y,
    x2: el.x + w + rw,
    y2: el.y + el.fontSize,
  };
}

/** Horizontal dimension: end ticks, line, centered label on a ground patch. */
function hDim(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  label: string,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.moveTo(x1, y - 7);
  ctx.lineTo(x1, y + 7);
  ctx.moveTo(x2, y - 7);
  ctx.lineTo(x2, y + 7);
  ctx.stroke();
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const m = ctx.measureText(label);
  ctx.fillStyle = GROUND;
  ctx.fillRect((x1 + x2) / 2 - m.width / 2 - 8, y - 11, m.width + 16, 22);
  ctx.fillStyle = color;
  ctx.fillText(label, (x1 + x2) / 2, y + 1);
}

/** Vertical dimension with a rotated label beside the line. */
function vDim(
  ctx: CanvasRenderingContext2D,
  y1: number,
  y2: number,
  x: number,
  label: string,
  color: string,
  labelSide: "left" | "right"
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.moveTo(x - 7, y1);
  ctx.lineTo(x + 7, y1);
  ctx.moveTo(x - 7, y2);
  ctx.lineTo(x + 7, y2);
  ctx.stroke();
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(x + (labelSide === "left" ? -16 : 16), (y1 + y2) / 2);
  ctx.rotate(-Math.PI / 2);
  const m = ctx.measureText(label);
  ctx.fillStyle = GROUND;
  ctx.fillRect(-m.width / 2 - 8, -11, m.width + 16, 22);
  ctx.fillStyle = color;
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Render the dimensioned drawing; null when there is nothing to draw. */
export async function renderSpecDrawing(
  elements: SignElement[],
  ipp: number
): Promise<string | null> {
  const parts = elements.filter((e) => e.kind !== "panel" || e.width > 0);
  if (!parts.length) return null;
  try {
    await document.fonts.ready;
  } catch {
    // draw with whatever is loaded
  }

  const exts: Ext[] = parts.map((el) =>
    el.kind === "text"
      ? textExtent(el, ipp)
      : { el, x1: el.x, y1: el.y, x2: el.x + el.width, y2: el.y + el.height }
  );
  const minX = Math.min(...exts.map((e) => e.x1));
  const maxX = Math.max(...exts.map((e) => e.x2));
  const minY = Math.min(...exts.map((e) => e.y1));
  const maxY = Math.max(...exts.map((e) => e.y2));
  const wPx = maxX - minX;
  const hPx = maxY - minY;
  if (wPx <= 0 || hPx <= 0) return null;

  // content scaled to a fixed drawing width; margins hold the dimension lines
  const CONTENT_W = 1160;
  const scale = CONTENT_W / wPx;
  const contentH = hPx * scale;
  const M = { left: 120, right: 120, top: 96, bottom: 96 };
  const W = CONTENT_W + M.left + M.right;
  const H = Math.round(contentH + M.top + M.bottom);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, 0, W, H);

  const X = (v: number) => M.left + (v - minX) * scale;
  const Y = (v: number) => M.top + (v - minY) * scale;

  // ---- raceway bars behind everything ----
  const texts = parts.filter(
    (e): e is TextElement => e.kind === "text"
  );
  for (const el of texts) {
    if (isBoxStyle(el) || !el.raceway) continue;
    const family = el.fontFamily ?? SIGN_FONT;
    const w = measureTextWidth(el.text, el.fontSize, family);
    const rwH = (RW_H_IN / ipp) * scale;
    ctx.fillStyle = el.racewayColor ?? "#b99f4f";
    ctx.fillRect(
      X(el.x - RW_PAD_IN / ipp),
      Y(el.y + el.fontSize / 2) - rwH / 2,
      (w + (RW_PAD_IN / ipp) * 2) * scale,
      rwH
    );
  }

  // ---- panels, logos, lettering ----
  for (const e of exts) {
    const el = e.el;
    if (el.kind === "panel") {
      ctx.fillStyle = el.fill ?? "#3a2f28";
      const pw = el.width * scale;
      const ph = el.height * scale;
      ctx.beginPath();
      ctx.roundRect(
        X(el.x),
        Y(el.y),
        pw,
        ph,
        el.round ? Math.min(pw, ph) / 2 : 3
      );
      ctx.fill();
    } else if (el.kind === "logo") {
      const img = await loadImg(el.src);
      if (img)
        ctx.drawImage(img, X(el.x), Y(el.y), el.width * scale, el.height * scale);
    } else {
      const family = el.fontFamily ?? SIGN_FONT;
      const fs = el.fontSize * scale;
      if (el.signStyle === "cabinet") {
        ctx.fillStyle = el.backerColor ?? "#f7f5f0";
        ctx.fillRect(
          X(e.x1),
          Y(e.y1),
          (e.x2 - e.x1) * scale,
          (e.y2 - e.y1) * scale
        );
      } else if (el.signStyle === "cloud") {
        // contour plate: the lettering stroked fat with round joins
        ctx.font = `bold ${fs}px ${family}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.strokeStyle = el.backerColor ?? "#f7f5f0";
        ctx.fillStyle = el.backerColor ?? "#f7f5f0";
        ctx.lineWidth = (CLOUD_PAD_IN.x / ipp) * scale * 2;
        ctx.lineJoin = "round";
        ctx.strokeText(el.text, X(el.x), Y(el.y));
        ctx.fillText(el.text, X(el.x), Y(el.y));
      }
      ctx.font = `bold ${fs}px ${family}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      if (!isBoxStyle(el)) {
        // trim-cap outline keeps light faces legible on the light ground
        ctx.strokeStyle = el.trimColor ?? "#26221f";
        ctx.lineWidth = Math.max(1.25, (0.5 / ipp) * scale);
        ctx.lineJoin = "round";
        ctx.strokeText(el.text, X(el.x), Y(el.y));
      }
      ctx.fillStyle = el.fill;
      ctx.fillText(el.text, X(el.x), Y(el.y));
    }
  }

  // ---- dimensions ----
  // overall width (ink, above) and height (ink, right)
  hDim(
    ctx,
    X(minX),
    X(maxX),
    M.top - 56,
    formatFeetInches(wPx * ipp),
    INK
  );
  vDim(
    ctx,
    Y(minY),
    Y(maxY),
    W - M.right + 64,
    formatFeetInches(hPx * ipp),
    INK,
    "right"
  );

  // per-line letter heights (blue, alternating sides) + wireway spans (blue)
  let rwIndex = 0;
  texts.forEach((el, i) => {
    const family = el.fontFamily ?? SIGN_FONT;
    const fs = el.fontSize * scale;
    ctx.font = `bold ${fs}px ${family}`;
    const m = ctx.measureText(el.text);
    // with textBaseline "top", the glyph box sits below the draw point
    const topY = Y(el.y) + (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent);
    const botY = Y(el.y) + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent;
    const cabinet = isBoxStyle(el);
    const inches = cabinet
      ? cabinetHeightInches(el, ipp)
      : textLetterHeightInches(el, ipp);
    const ext = exts.find((x) => x.el === el)!;
    const left = i % 2 === 0;
    vDim(
      ctx,
      cabinet ? Y(ext.y1) : topY,
      cabinet ? Y(ext.y2) : botY,
      left ? M.left - 56 : W - M.right + 24,
      formatFeetInches(inches),
      BLUE,
      left ? "left" : "right"
    );
    if (!isBoxStyle(el) && el.raceway) {
      const w = measureTextWidth(el.text, el.fontSize, family);
      const rwWIn = w * ipp + RW_PAD_IN * 2;
      const yLine =
        rwIndex % 2 === 0 ? M.top - 20 : H - M.bottom + 44;
      hDim(
        ctx,
        X(el.x - RW_PAD_IN / ipp),
        X(el.x + w + RW_PAD_IN / ipp),
        yLine,
        `Wireway ${formatFeetInches(rwWIn)}`,
        BLUE
      );
      rwIndex++;
    }
  });

  return canvas.toDataURL("image/png");
}
