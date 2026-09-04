"use client";

import Konva from "konva";
import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KImage,
  Label,
  Line,
  Circle,
  Group,
  Tag,
  Text as KText,
} from "react-konva";
import {
  inchesPerPixel,
  Measurement,
  refActive,
  referenceMismatch,
  RefLine,
  refPixelLength,
} from "@/lib/types";
import { formatFeetInches } from "@/lib/pricing";

interface Props {
  image: HTMLImageElement;
  measurement: Measurement;
  onChange: (m: Measurement) => void;
  onNext: () => void;
  onBack: () => void;
  /** Friendlier copy and brand accents for the customer link. */
  customerMode?: boolean;
}

const MAX_W = 920;
const MAX_H = 560;

// Marker palettes: the staff cockpit keeps amber; the customer surface stays
// on-brand (blue width line) with white for extra references.
const REF_STYLES: Record<
  "staff" | "customer",
  Record<RefLine["kind"], { color: string; label: string; hint: string }>
> = {
  staff: {
    width: {
      color: "#fbbf24",
      label: "Storefront width",
      hint: "drag to each end of the storefront, then enter the width",
    },
    door: {
      color: "#4ade80",
      label: "Door (7 ft)",
      hint: "drag onto a standard door — most commercial doors are 7 ft",
    },
    custom: {
      color: "#60a5fa",
      label: "Custom",
      hint: "anything whose size you know",
    },
  },
  customer: {
    width: {
      color: "#3b82f6",
      label: "Storefront width",
      hint: "drag to each end of the storefront, then enter the width",
    },
    door: {
      color: "#4ade80",
      label: "Door (7 ft)",
      hint: "drag onto a standard door — most commercial doors are 7 ft",
    },
    custom: {
      color: "#fafafa",
      label: "Custom",
      hint: "anything whose size you know",
    },
  },
};

interface View {
  scale: number;
  x: number;
  y: number;
}

export default function MeasureStep({
  image,
  measurement,
  onChange,
  onNext,
  onBack,
  customerMode,
}: Props) {
  // The stage shrinks with its column so phones never scroll sideways.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [colW, setColW] = useState(MAX_W);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setColW(Math.min(MAX_W, el.clientWidth || MAX_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const fitScale = Math.min(
    colW / image.naturalWidth,
    MAX_H / image.naturalHeight,
    1
  );
  const stageW = image.naturalWidth * fitScale;
  const stageH = image.naturalHeight * fitScale;

  const [view, setView] = useState<View>({ scale: fitScale, x: 0, y: 0 });
  useEffect(() => {
    setView({ scale: fitScale, x: 0, y: 0 });
  }, [image, fitScale]);

  const minScale = fitScale * 0.8;
  const maxScale = fitScale * 12;

  const zoomTo = (newScale: number, center: { x: number; y: number }) => {
    const clamped = Math.min(maxScale, Math.max(minScale, newScale));
    const pt = {
      x: (center.x - view.x) / view.scale,
      y: (center.y - view.y) / view.scale,
    };
    setView({
      scale: clamped,
      x: center.x - pt.x * clamped,
      y: center.y - pt.y * clamped,
    });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    zoomTo(view.scale * (e.evt.deltaY > 0 ? 1 / 1.15 : 1.15), pointer);
  };

  const updateRef = (id: string, patch: Partial<RefLine>) =>
    onChange({
      references: measurement.references.map((r) =>
        r.id === id ? { ...r, ...patch } : r
      ),
    });

  const removeRef = (id: string) =>
    onChange({
      references: measurement.references.filter((r) => r.id !== id),
    });

  const addCustom = () => {
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    onChange({
      references: [
        ...measurement.references,
        {
          id: `c${Date.now()}`,
          kind: "custom",
          x1: w * 0.35,
          y1: h * 0.4,
          x2: w * 0.65,
          y2: h * 0.4,
          feet: 0,
          inches: 0,
          placed: true, // customs need a typed value anyway to become active
        },
      ],
    });
  };

  const REF_STYLE = REF_STYLES[customerMode ? "customer" : "staff"];
  const ipp = inchesPerPixel(measurement);
  const mismatch = referenceMismatch(measurement);
  const zoomX = view.scale / fitScale;
  const s = 1 / view.scale; // screen-constant sizing inside the scaled stage
  const shortActive = measurement.references.some(
    (r) => refActive(r) && refPixelLength(r) * fitScale < 60
  );

  const endpoint = (r: RefLine, key: "1" | "2") => (
    <Circle
      key={`${r.id}-${key}`}
      x={r[`x${key}`]}
      y={r[`y${key}`]}
      radius={9 * s}
      fill={REF_STYLE[r.kind].color}
      stroke="#18181b"
      strokeWidth={2 * s}
      draggable
      onDragMove={(e) =>
        updateRef(r.id, {
          [`x${key}`]: e.target.x(),
          [`y${key}`]: e.target.y(),
          placed: true,
        })
      }
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "grab";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "default";
      }}
    />
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div ref={wrapRef} className="flex min-w-0 flex-1 items-start justify-center">
        <div className="relative">
        <Stage
          width={stageW}
          height={stageH}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable
          onDragEnd={(e) => {
            if (e.target === e.target.getStage())
              setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onWheel={onWheel}
          className={
            customerMode
              ? "overflow-hidden rounded-2xl bg-zinc-900 shadow-[0_2px_6px_rgba(24,24,27,0.08),0_20px_48px_-20px_rgba(24,24,27,0.35)]"
              : "overflow-hidden rounded-xl bg-zinc-950"
          }
        >
          <Layer>
            <KImage
              image={image}
              width={image.naturalWidth}
              height={image.naturalHeight}
            />
            {measurement.references.map((r) => {
              const style = REF_STYLE[r.kind];
              const active = refActive(r);
              return (
                <Group key={r.id}>
                  <Line
                    points={[r.x1, r.y1, r.x2, r.y2]}
                    stroke={style.color}
                    strokeWidth={3 * s}
                    dash={[8 * s, 6 * s]}
                    opacity={active || r.kind !== "door" || r.placed ? 1 : 0.55}
                  />
                  <Label
                    x={(r.x1 + r.x2) / 2}
                    y={(r.y1 + r.y2) / 2 - 26 * s}
                    listening={false}
                    scaleX={s}
                    scaleY={s}
                    opacity={0.95}
                  >
                    <Tag fill={style.color} cornerRadius={3} />
                    <KText
                      text={
                        r.kind === "door" && !r.placed
                          ? "Door — drag onto a door"
                          : `${style.label.split(" (")[0]}${
                              active
                                ? ` · ${formatFeetInches(r.feet * 12 + r.inches)}`
                                : ""
                            }`
                      }
                      fontSize={11}
                      fontStyle="bold"
                      fill="#18181b"
                      padding={3}
                    />
                  </Label>
                  {endpoint(r, "1")}
                  {endpoint(r, "2")}
                </Group>
              );
            })}
          </Layer>
        </Stage>
        <div
          className={`absolute bottom-3 left-3 flex items-center gap-1 rounded-lg p-1 text-sm shadow ${
            customerMode ? "bg-zinc-800/90" : "bg-zinc-900/90"
          }`}
        >
          <button
            onClick={() => zoomTo(view.scale / 1.4, { x: stageW / 2, y: stageH / 2 })}
            className="h-8 w-8 rounded text-zinc-200 hover:bg-zinc-700"
            title="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center tabular-nums text-zinc-300">
            {zoomX.toFixed(1)}×
          </span>
          <button
            onClick={() => zoomTo(view.scale * 1.4, { x: stageW / 2, y: stageH / 2 })}
            className="h-8 w-8 rounded text-zinc-200 hover:bg-zinc-700"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setView({ scale: fitScale, x: 0, y: 0 })}
            className="h-8 rounded px-2 text-zinc-200 hover:bg-zinc-700"
            title="Fit photo"
          >
            Fit
          </button>
        </div>
        </div>
      </div>

      <div className="w-full shrink-0 space-y-4 lg:w-80">
        <div>
          <h2
            className={
              customerMode
                ? "text-2xl font-extrabold tracking-tight text-zinc-900"
                : "text-lg font-semibold text-zinc-100"
            }
          >
            {customerMode
              ? "About how wide is this storefront?"
              : "Mark what you know"}
          </h2>
          {customerMode ? (
            <>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Drag the blue dots to each end of your building and type your
                best guess in feet. Not sure? Drag the green line onto your
                door — most doors are 7 ft, and we&apos;ll work it out from
                there.
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                A rough guess is fine — we confirm exact measurements before
                anything is built.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-zinc-400">
                Drag the amber dots across the storefront and enter its width.
                Drag the green line onto a door for a free second check — more
                references, better accuracy.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Scroll to zoom, drag the photo to pan. References must be on
                the same wall as the sign.
              </p>
            </>
          )}
        </div>

        {measurement.references.map((r) => {
          const style = REF_STYLE[r.kind];
          return (
            <div
              key={r.id}
              className={
                customerMode
                  ? "rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                  : "rounded-lg border border-zinc-700 bg-zinc-900 p-3"
              }
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex items-center gap-2 text-sm font-medium ${
                    customerMode ? "text-zinc-900" : "text-zinc-200"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: style.color }}
                  />
                  {style.label}
                </span>
                {r.kind !== "width" && (
                  <button
                    onClick={() => removeRef(r.id)}
                    className={customerMode ? "text-xs font-medium text-zinc-500 hover:text-zinc-900" : "text-xs text-zinc-500 hover:text-red-400"}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-end gap-3">
                <label className="block">
                  <span className={`text-xs ${customerMode ? "font-medium text-zinc-600" : "text-zinc-400"}`}>
                    Feet
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    placeholder={r.kind === "width" ? "e.g. 24" : "0"}
                    value={r.feet || (r.kind === "door" ? r.feet : "") || ""}
                    onChange={(e) =>
                      updateRef(r.id, { feet: Number(e.target.value) })
                    }
                    className={
                      customerMode
                        ? "mt-1 w-20 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        : "mt-1 w-20 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-1.5 text-zinc-100 placeholder:text-zinc-600"
                    }
                  />
                </label>
                <label className="block">
                  <span className={`text-xs ${customerMode ? "font-medium text-zinc-600" : "text-zinc-400"}`}>
                    Inches
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={11}
                    placeholder="0"
                    value={r.inches || ""}
                    onChange={(e) =>
                      updateRef(r.id, { inches: Number(e.target.value) })
                    }
                    className={
                      customerMode
                        ? "mt-1 w-16 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        : "mt-1 w-16 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-1.5 text-zinc-100 placeholder:text-zinc-600"
                    }
                  />
                </label>
                {r.kind === "door" && !r.placed && (
                  <span className="pb-1.5 text-xs text-zinc-500">
                    not placed yet
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <button
          onClick={addCustom}
          className={
            customerMode
              ? "w-full rounded-xl border border-dashed border-zinc-300 py-2 text-sm font-medium text-zinc-500 transition-colors hover:border-blue-500 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              : "w-full rounded-lg border border-dashed border-zinc-600 py-2 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
          }
        >
          + Add another reference
        </button>

        {mismatch !== null && mismatch > 0.15 && (
          <p
            className={
              customerMode
                ? "rounded-xl border border-zinc-300 bg-white p-3 text-sm font-medium leading-6 text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05)]"
                : "rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-sm text-amber-300"
            }
          >
            Your references disagree by {(mismatch * 100).toFixed(0)}%.
            Double-check the width, and make sure the door is on the same wall
            as the sign (not recessed).
          </p>
        )}
        {mismatch !== null && mismatch <= 0.15 && (
          <p
            className={
              customerMode
                ? "text-sm font-medium text-emerald-700"
                : "text-sm text-emerald-400"
            }
          >
            References agree within {(mismatch * 100).toFixed(0)}% — good scale
            confidence.
          </p>
        )}
        {shortActive && (
          <p className={customerMode ? "text-sm font-medium text-zinc-900" : "text-sm text-amber-400"}>
            A reference line is very short — stretch it or zoom in for
            accuracy.
          </p>
        )}
        {!ipp && (
          <p className={customerMode ? "text-sm text-zinc-500" : "text-sm text-zinc-400"}>
            Enter the storefront width (or place the door line) to continue.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onBack}
            className={
              customerMode
                ? "rounded-xl border border-zinc-300 bg-white px-4 py-2.5 font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                : "rounded-lg border border-zinc-600 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
            }
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!ipp}
            className={`font-semibold disabled:opacity-50 ${
              customerMode
                ? "rounded-xl bg-blue-600 px-6 py-2.5 text-white shadow-[0_2px_6px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                : "rounded-lg bg-amber-400 px-5 py-2 text-zinc-950 hover:bg-amber-300"
            }`}
          >
            Continue to design
          </button>
        </div>
      </div>
    </div>
  );
}
