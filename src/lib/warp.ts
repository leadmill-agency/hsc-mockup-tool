// Perspective square-up: preview uses CSS 3D transforms; Apply bakes the same
// transform into a corrected raster via a WebGL homography warp (PRD §8.7 —
// transforms are stored as parameters and applied non-destructively).

export interface SquareParams {
  rotate: number; // straighten, degrees
  vPersp: number; // vertical perspective (rotateX), degrees
  hPersp: number; // horizontal perspective (rotateY), degrees
}

export const DEFAULT_SQUARE: SquareParams = { rotate: 0, vPersp: 0, hPersp: 0 };

type Mat4 = number[]; // 16 values, row-major
type Pt = { x: number; y: number };

const PERSPECTIVE_FACTOR = 1.5; // perspective distance = 1.5 × max dimension

function mul4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) out[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return out;
}

function rotZ(deg: number): Mat4 {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function rotX(deg: number): Mat4 {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
}

function rotY(deg: number): Mat4 {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
}

function perspective(d: number): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / d, 1];
}

/** Where the image's four corners (TL, TR, BR, BL) land after the transform,
 *  in image-plane coordinates centered on the image center. */
export function projectCorners(w: number, h: number, p: SquareParams): Pt[] {
  const d = PERSPECTIVE_FACTOR * Math.max(w, h);
  // CSS order: perspective(d) rotateX rotateY rotateZ
  const M = mul4(perspective(d), mul4(rotX(p.vPersp), mul4(rotY(p.hPersp), rotZ(p.rotate))));
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ];
  return corners.map(([x, y]) => {
    const tx = M[0] * x + M[1] * y + M[3];
    const ty = M[4] * x + M[5] * y + M[7];
    const tw = M[12] * x + M[13] * y + M[15];
    return { x: tx / tw, y: ty / tw };
  });
}

/** Gaussian elimination with partial pivoting. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++)
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) throw new Error("Degenerate homography");
    for (let c = col; c <= n; c++) M[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/** 3×3 homography (row-major) mapping src points to dst points. */
export function solveHomography(src: Pt[], dst: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -sx * dx, -sy * dx]);
    b.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -sx * dy, -sy * dy]);
    b.push(dy);
  }
  const h = solveLinear(A, b);
  return [...h, 1];
}

const VERT = `
attribute vec2 aPos;
uniform vec2 uOutSize;
varying vec2 vDest;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vDest = vec2((aPos.x + 1.0) * 0.5 * uOutSize.x, (1.0 - aPos.y) * 0.5 * uOutSize.y);
}`;

const FRAG = `
precision highp float;
uniform mat3 uH;
uniform vec2 uSrcSize;
uniform sampler2D uTex;
varying vec2 vDest;
void main() {
  vec3 s = uH * vec3(vDest, 1.0);
  vec2 src = s.xy / s.z;
  vec2 uv = src / uSrcSize;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    gl_FragColor = texture2D(uTex, uv);
  }
}`;

/** Render the corrected (squared-up) image to a canvas. */
export function bakeWarp(
  img: HTMLImageElement,
  p: SquareParams,
  maxDim = 2400
): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const projected = projectCorners(w, h, p);
  const xs = projected.map((c) => c.x);
  const ys = projected.map((c) => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(1, maxDim / Math.max(maxX - minX, maxY - minY));
  const outW = Math.max(2, Math.round((maxX - minX) * scale));
  const outH = Math.max(2, Math.round((maxY - minY) * scale));
  const dest = projected.map((c) => ({
    x: (c.x - minX) * scale,
    y: (c.y - minY) * scale,
  }));
  const srcCorners = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const H = solveHomography(dest, srcCorners); // dest px -> source px

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL is unavailable");

  const compile = (type: number, source: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  gl.uniform2f(gl.getUniformLocation(prog, "uOutSize"), outW, outH);
  gl.uniform2f(gl.getUniformLocation(prog, "uSrcSize"), w, h);
  // uniformMatrix3fv expects column-major; H is row-major.
  gl.uniformMatrix3fv(gl.getUniformLocation(prog, "uH"), false, [
    H[0], H[3], H[6],
    H[1], H[4], H[7],
    H[2], H[5], H[8],
  ]);

  gl.viewport(0, 0, outW, outH);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return canvas;
}
