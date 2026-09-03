// Deterministic logo background removal (PRD §8.9 "simple background removal
// when confidence is high"): if the image border is a near-uniform solid color,
// flood-fill from the border and make those pixels transparent. Enclosed
// counters (inside an O) are left alone. Returns null when not confident —
// already-transparent images or busy backgrounds.

export function removeUniformBackground(
  img: HTMLImageElement,
  tolerance = 40
): string | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w < 4 || h < 4 || w * h > 16_000_000) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // already meaningfully transparent → nothing to do
  let transparentSamples = 0;
  for (let i = 3; i < d.length; i += 4 * 499) {
    if (d[i] < 250) transparentSamples++;
    if (transparentSamples > 3) return null;
  }

  // border pixel indices
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + (w - 1));

  // mean border color
  let mr = 0, mg = 0, mb = 0;
  for (const p of border) {
    mr += d[p * 4];
    mg += d[p * 4 + 1];
    mb += d[p * 4 + 2];
  }
  mr /= border.length;
  mg /= border.length;
  mb /= border.length;

  const tol2 = tolerance * tolerance * 3;
  const matches = (p: number) => {
    const dr = d[p * 4] - mr;
    const dg = d[p * 4 + 1] - mg;
    const db = d[p * 4 + 2] - mb;
    return dr * dr + dg * dg + db * db <= tol2;
  };

  // confidence check: the border must be near-uniform
  let borderMatches = 0;
  for (const p of border) if (matches(p)) borderMatches++;
  if (borderMatches / border.length < 0.9) return null;

  // flood fill from matching border pixels
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const p of border) {
    if (matches(p) && !visited[p]) {
      visited[p] = 1;
      stack.push(p);
    }
  }
  let removed = 0;
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0;
    removed++;
    const x = p % w;
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x < w - 1 ? p + 1 : -1,
      p - w,
      p + w,
    ];
    for (const n of neighbors) {
      if (n >= 0 && n < w * h && !visited[n] && matches(n)) {
        visited[n] = 1;
        stack.push(n);
      }
    }
  }

  // sanity: a background should be a meaningful share of the image,
  // but not essentially all of it
  const frac = removed / (w * h);
  if (frac < 0.05 || frac > 0.98) return null;

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}
