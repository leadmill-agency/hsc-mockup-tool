// Nearest-Pantone lookup for proposals: production and customers speak PMS,
// not hex. The table is a curated set of common PMS Solid Coated colors
// (approximate sRGB values); matches are labeled as approximations and the
// hex stays alongside in fine print, with physical samples confirming before
// production (the proposal already says so).

interface Pms {
  code: string;
  hex: string;
}

const PMS: Pms[] = [
  // whites / blacks / grays
  { code: "White", hex: "#f5f5f2" },
  { code: "PMS Black C", hex: "#2d2926" },
  { code: "PMS Black 6 C", hex: "#101820" },
  { code: "PMS Cool Gray 1 C", hex: "#d9d9d6" },
  { code: "PMS Cool Gray 4 C", hex: "#bbbcbc" },
  { code: "PMS Cool Gray 7 C", hex: "#97999b" },
  { code: "PMS Cool Gray 9 C", hex: "#75787b" },
  { code: "PMS Cool Gray 11 C", hex: "#53565a" },
  { code: "PMS Warm Gray 1 C", hex: "#d7d2cb" },
  { code: "PMS Warm Gray 6 C", hex: "#a59c94" },
  { code: "PMS Warm Gray 11 C", hex: "#6e6259" },
  // reds / burgundy
  { code: "PMS 485 C", hex: "#da291c" },
  { code: "PMS 186 C", hex: "#c8102e" },
  { code: "PMS 199 C", hex: "#d50032" },
  { code: "PMS 1795 C", hex: "#d22630" },
  { code: "PMS 188 C", hex: "#76232f" },
  { code: "PMS 7421 C", hex: "#651d32" },
  // oranges
  { code: "PMS 021 C", hex: "#fe5000" },
  { code: "PMS 165 C", hex: "#ff671f" },
  { code: "PMS 1585 C", hex: "#ff6a13" },
  { code: "PMS 715 C", hex: "#f68d2e" },
  { code: "PMS 7578 C", hex: "#dc6b2f" },
  // yellows / golds / tans
  { code: "PMS 109 C", hex: "#ffd100" },
  { code: "PMS 116 C", hex: "#ffcd00" },
  { code: "PMS 123 C", hex: "#ffc72c" },
  { code: "PMS 7548 C", hex: "#ffc600" },
  { code: "PMS 7407 C", hex: "#cba052" },
  { code: "PMS 871 C (metallic gold)", hex: "#85714d" },
  { code: "PMS 7502 C", hex: "#ceb888" },
  { code: "PMS 468 C", hex: "#ddcba4" },
  { code: "PMS 4525 C", hex: "#c5b783" },
  { code: "PMS 7531 C", hex: "#7a6855" },
  { code: "PMS 4625 C", hex: "#4f2c1d" },
  { code: "PMS 469 C", hex: "#693f23" },
  { code: "PMS 476 C", hex: "#4e3629" },
  // greens
  { code: "PMS 347 C", hex: "#009a44" },
  { code: "PMS 354 C", hex: "#00b140" },
  { code: "PMS 355 C", hex: "#009639" },
  { code: "PMS 7739 C", hex: "#319b42" },
  { code: "PMS 341 C", hex: "#007a53" },
  { code: "PMS 3425 C", hex: "#006341" },
  { code: "PMS 376 C", hex: "#84bd00" },
  { code: "PMS 382 C", hex: "#c4d600" },
  { code: "PMS 5535 C", hex: "#183028" },
  // teals / cyans
  { code: "PMS 3262 C", hex: "#00bfb3" },
  { code: "PMS 3282 C", hex: "#008578" },
  { code: "PMS 320 C", hex: "#009ca6" },
  { code: "PMS 306 C", hex: "#00b5e2" },
  { code: "PMS 299 C", hex: "#00a3e0" },
  // blues
  { code: "PMS 2925 C", hex: "#009cde" },
  { code: "PMS 300 C", hex: "#005eb8" },
  { code: "PMS 286 C", hex: "#0032a0" },
  { code: "PMS 293 C", hex: "#003da5" },
  { code: "PMS 2935 C", hex: "#0057b8" },
  { code: "PMS Process Blue C", hex: "#0085ca" },
  { code: "PMS Reflex Blue C", hex: "#001489" },
  { code: "PMS 281 C", hex: "#00205b" },
  { code: "PMS 282 C", hex: "#041e42" },
  { code: "PMS 289 C", hex: "#0c2340" },
  { code: "PMS 532 C", hex: "#1c2b39" },
  { code: "PMS 7686 C", hex: "#1d4f91" },
  // purples / pinks
  { code: "PMS 2685 C", hex: "#330072" },
  { code: "PMS 266 C", hex: "#753bbd" },
  { code: "PMS 527 C", hex: "#8031a7" },
  { code: "PMS 7679 C", hex: "#563d82" },
  { code: "PMS Rhodamine Red C", hex: "#e10098" },
  { code: "PMS 213 C", hex: "#e31c79" },
  { code: "PMS 225 C", hex: "#df1683" },
  { code: "PMS 238 C", hex: "#e45dbf" },
  // warm whites / creams (sign faces, halo washes)
  { code: "PMS 7499 C (warm white)", hex: "#f1e6b2" },
  { code: "PMS 7401 C (cream)", hex: "#f5e1a4" },
  { code: "PMS 9060 C (soft white)", hex: "#f8f3e1" },
];

function dist(a: string, b: string): number {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const dr = p(a, 1) - p(b, 1);
  const dg = p(a, 3) - p(b, 3);
  const db = p(a, 5) - p(b, 5);
  // weighted RGB — cheap but decent perceptual approximation
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Nearest PMS code for a hex color, e.g. "PMS 286 C". */
export function nearestPantone(hex: string): string {
  if (!HEX_RE.test(hex)) return hex;
  let best = PMS[0];
  let bestD = Infinity;
  for (const p of PMS) {
    const d = dist(hex.toLowerCase(), p.hex);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.code;
}

/** "PMS 286 C (#0032a0)" — the label production reads, hex as fine print. */
export function pantoneLabel(hex: string): string {
  if (!HEX_RE.test(hex)) return hex;
  return `${nearestPantone(hex)} (${hex.toLowerCase()})`;
}
