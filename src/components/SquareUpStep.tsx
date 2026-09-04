"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bakeWarp, DEFAULT_SQUARE, projectCorners, SquareParams } from "@/lib/warp";

interface Props {
  image: HTMLImageElement;
  initialParams: SquareParams;
  onApply: (corrected: HTMLImageElement, params: SquareParams) => void;
  onReplacePhoto: () => void;
  /** Friendlier copy and brand accents for the customer link. */
  customerMode?: boolean;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SLIDERS: {
  key: keyof SquareParams;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  { key: "rotate", label: "Straighten", hint: "level the sign band", min: -15, max: 15 },
  { key: "vPersp", label: "Vertical perspective", hint: "make columns vertical", min: -25, max: 25 },
  { key: "hPersp", label: "Horizontal perspective", hint: "fix side-angle shots", min: -25, max: 25 },
];

const MIN_CROP = 48;

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

export default function SquareUpStep({
  image,
  initialParams,
  onApply,
  onReplacePhoto,
  customerMode,
}: Props) {
  const [params, setParams] = useState<SquareParams>(initialParams);
  const [baking, setBaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Box | null>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startCrop: Box;
  } | null>(null);

  /** Axis-aligned bounding box of the transformed image, in container coords. */
  const warpedBBox = useCallback((): Box | null => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || img.clientWidth === 0) return null;
    const corners = projectCorners(img.clientWidth, img.clientHeight, params);
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    // image element is flex-centered in the container; transform-origin center
    const cRect = container.getBoundingClientRect();
    const iRect = img.getBoundingClientRect(); // post-transform bbox, but use center
    const cx = iRect.left + iRect.width / 2 - cRect.left;
    const cy = iRect.top + iRect.height / 2 - cRect.top;
    return {
      x: cx + Math.min(...xs),
      y: cy + Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    };
  }, [params]);

  const initCrop = useCallback(() => {
    const b = warpedBBox();
    if (b) setCrop(b);
  }, [warpedBBox]);

  // initialize crop to the full photo once it has laid out
  useEffect(() => {
    const t = setTimeout(initCrop, 60);
    window.addEventListener("resize", initCrop);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", initCrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const s = d.startCrop;
      let next: Box = { ...s };
      if (d.mode === "move") {
        next = { ...s, x: s.x + dx, y: s.y + dy };
      } else if (d.mode === "nw") {
        next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
      } else if (d.mode === "ne") {
        next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy };
      } else if (d.mode === "sw") {
        next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy };
      } else if (d.mode === "se") {
        next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy };
      }
      if (next.w < MIN_CROP || next.h < MIN_CROP) return;
      setCrop(next);
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: crop,
    };
  };

  const apply = () => {
    setBaking(true);
    setTimeout(() => {
      try {
        const full = bakeWarp(image, params);
        let result = full;
        const bbox = warpedBBox();
        if (crop && bbox && bbox.w > 0 && bbox.h > 0) {
          const clamp = (v: number) => Math.min(1, Math.max(0, v));
          const fx = clamp((crop.x - bbox.x) / bbox.w);
          const fy = clamp((crop.y - bbox.y) / bbox.h);
          const fx2 = clamp((crop.x + crop.w - bbox.x) / bbox.w);
          const fy2 = clamp((crop.y + crop.h - bbox.y) / bbox.h);
          const sx = Math.round(fx * full.width);
          const sy = Math.round(fy * full.height);
          const sw = Math.max(16, Math.round((fx2 - fx) * full.width));
          const sh = Math.max(16, Math.round((fy2 - fy) * full.height));
          if (sw < full.width - 2 || sh < full.height - 2) {
            const c = document.createElement("canvas");
            c.width = sw;
            c.height = sh;
            c.getContext("2d")!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
            result = c;
          }
        }
        const corrected = new Image();
        corrected.onload = () => onApply(corrected, params);
        corrected.src = result.toDataURL("image/png");
      } finally {
        setBaking(false);
      }
    }, 30);
  };

  const handleClass =
    "absolute h-4 w-4 rounded-sm border-2 border-zinc-900 bg-white shadow";

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div
        ref={containerRef}
        className={`relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden ${
          customerMode
            ? "rounded-2xl bg-zinc-900 shadow-[0_2px_6px_rgba(24,24,27,0.08),0_20px_48px_-20px_rgba(24,24,27,0.35)]"
            : "rounded-xl bg-zinc-950"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={image.src}
          alt="Storefront"
          className="max-h-[62vh] max-w-full select-none"
          style={{
            transform: `perspective(${
              1.5 * Math.max(image.naturalWidth, image.naturalHeight)
            }px) rotateX(${params.vPersp}deg) rotateY(${params.hPersp}deg) rotate(${params.rotate}deg)`,
          }}
          draggable={false}
          onLoad={initCrop}
        />
        {/* Screen-aligned grid: align the photo to these lines */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: customerMode
              ? "repeating-linear-gradient(0deg, rgba(147,197,253,.4) 0 1px, transparent 1px 60px)," +
                "repeating-linear-gradient(90deg, rgba(147,197,253,.4) 0 1px, transparent 1px 60px)"
              : "repeating-linear-gradient(0deg, rgba(255,193,7,.35) 0 1px, transparent 1px 60px)," +
                "repeating-linear-gradient(90deg, rgba(255,193,7,.35) 0 1px, transparent 1px 60px)",
          }}
        />
        {crop && (
          <>
            {/* dim everything outside the crop */}
            {(
              [
                { left: 0, top: 0, right: 0, height: crop.y },
                { left: 0, top: crop.y + crop.h, right: 0, bottom: 0 },
                { left: 0, top: crop.y, width: crop.x, height: crop.h },
                {
                  left: crop.x + crop.w,
                  top: crop.y,
                  right: 0,
                  height: crop.h,
                },
              ] as React.CSSProperties[]
            ).map((style, i) => (
              <div
                key={i}
                className="pointer-events-none absolute bg-zinc-950/70"
                style={style}
              />
            ))}
            {/* crop frame: drag inside to move */}
            <div
              className="absolute cursor-move border-2 border-white/90"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              onPointerDown={startDrag("move")}
            >
              <div
                className={`${handleClass} -left-2 -top-2 cursor-nwse-resize`}
                onPointerDown={startDrag("nw")}
              />
              <div
                className={`${handleClass} -right-2 -top-2 cursor-nesw-resize`}
                onPointerDown={startDrag("ne")}
              />
              <div
                className={`${handleClass} -bottom-2 -left-2 cursor-nesw-resize`}
                onPointerDown={startDrag("sw")}
              />
              <div
                className={`${handleClass} -bottom-2 -right-2 cursor-nwse-resize`}
                onPointerDown={startDrag("se")}
              />
            </div>
          </>
        )}
      </div>

      <div className="w-full shrink-0 space-y-5 lg:w-80">
        <div>
          <h2
            className={
              customerMode
                ? "text-2xl font-extrabold tracking-tight text-zinc-900"
                : "text-lg font-semibold text-zinc-100"
            }
          >
            {customerMode ? "Does the photo look straight?" : "Square up the photo"}
          </h2>
          {customerMode ? (
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              If your building looks straight against the grid, just continue.
              Otherwise nudge the sliders until it lines up — close is good
              enough.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-400">
              Adjust until the sign band is horizontal and the storefront
              columns are vertical against the grid.
            </p>
          )}
          <p
            className={
              customerMode
                ? "mt-2 text-sm text-zinc-500"
                : "mt-2 text-xs text-zinc-500"
            }
          >
            Drag the white corners to crop in on the storefront — a tight crop
            makes measuring and placing the sign much easier.
          </p>
        </div>
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <div className="flex items-baseline justify-between text-sm">
              <span
                className={
                  customerMode
                    ? "font-semibold text-zinc-900"
                    : "font-medium text-zinc-200"
                }
              >
                {s.label}
              </span>
              <span
                className={
                  customerMode
                    ? "tabular-nums text-zinc-500"
                    : "tabular-nums text-zinc-400"
                }
              >
                {params[s.key].toFixed(1)}°
              </span>
            </div>
            <div className="text-xs text-zinc-500">{s.hint}</div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={0.1}
              value={params[s.key]}
              onChange={(e) =>
                setParams((p) => ({ ...p, [s.key]: Number(e.target.value) }))
              }
              className={`mt-1 w-full ${customerMode ? "accent-blue-600" : "accent-amber-400"}`}
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={apply}
            disabled={baking}
            className={`font-semibold disabled:opacity-50 ${
              customerMode
                ? "rounded-xl bg-blue-600 px-6 py-2.5 text-white shadow-[0_2px_6px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                : "rounded-lg bg-amber-400 px-5 py-2 text-zinc-950 hover:bg-amber-300"
            }`}
          >
            {baking
              ? "Applying…"
              : customerMode
                ? "Looks good — continue"
                : "Apply"}
          </button>
          <button
            onClick={() => {
              setParams(DEFAULT_SQUARE);
              setTimeout(initCrop, 60);
            }}
            className={
              customerMode
                ? "rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                : "rounded-lg border border-zinc-600 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
            }
          >
            Reset
          </button>
          <button
            onClick={onReplacePhoto}
            className={
              customerMode
                ? "rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                : "rounded-lg border border-zinc-600 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
            }
          >
            Replace photo
          </button>
        </div>
        <p className={customerMode ? "text-sm text-zinc-500" : "text-xs text-zinc-500"}>
          The original photo is never modified — corrections are stored as
          parameters and can be re-applied.
        </p>
      </div>
    </div>
  );
}
