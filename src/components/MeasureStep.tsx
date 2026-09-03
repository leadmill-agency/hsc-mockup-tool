"use client";

import Konva from "konva";
import { useEffect, useState } from "react";
import { Stage, Layer, Image as KImage, Line, Circle, Group } from "react-konva";
import {
  MeasurementState,
  inchesPerPixel,
  measurementPixelLength,
} from "@/lib/types";

interface Props {
  image: HTMLImageElement;
  measurement: MeasurementState;
  onChange: (m: MeasurementState) => void;
  onNext: () => void;
  onBack: () => void;
}

const MAX_W = 920;
const MAX_H = 560;

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
}: Props) {
  const fitScale = Math.min(
    MAX_W / image.naturalWidth,
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
    // keep the given stage point fixed while scaling
    const imagePt = {
      x: (center.x - view.x) / view.scale,
      y: (center.y - view.y) / view.scale,
    };
    setView({
      scale: clamped,
      x: center.x - imagePt.x * clamped,
      y: center.y - imagePt.y * clamped,
    });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / 1.15 : 1.15;
    zoomTo(view.scale * factor, pointer);
  };

  const zoomButtons = (factor: number) =>
    zoomTo(view.scale * factor, { x: stageW / 2, y: stageH / 2 });

  const ipp = inchesPerPixel(measurement);
  const px = measurementPixelLength(measurement);
  const zoomX = view.scale / fitScale;

  // Screen-constant sizes regardless of zoom
  const s = 1 / view.scale;

  const endpoint = (key: "1" | "2") => (
    <Circle
      x={measurement[`x${key}`]}
      y={measurement[`y${key}`]}
      radius={9 * s}
      fill="#fbbf24"
      stroke="#18181b"
      strokeWidth={2 * s}
      draggable
      onDragMove={(e) =>
        onChange({
          ...measurement,
          [`x${key}`]: e.target.x(),
          [`y${key}`]: e.target.y(),
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
      <div className="relative flex flex-1 items-start justify-center">
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
          className="overflow-hidden rounded-xl bg-zinc-950"
        >
          <Layer>
            <KImage
              image={image}
              width={image.naturalWidth}
              height={image.naturalHeight}
            />
            <Group>
              <Line
                points={[
                  measurement.x1,
                  measurement.y1,
                  measurement.x2,
                  measurement.y2,
                ]}
                stroke="#fbbf24"
                strokeWidth={3 * s}
                dash={[8 * s, 6 * s]}
              />
              {endpoint("1")}
              {endpoint("2")}
            </Group>
          </Layer>
        </Stage>
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-zinc-900/90 p-1 text-sm shadow">
          <button
            onClick={() => zoomButtons(1 / 1.4)}
            className="h-8 w-8 rounded text-zinc-200 hover:bg-zinc-700"
            title="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center tabular-nums text-zinc-300">
            {zoomX.toFixed(1)}×
          </span>
          <button
            onClick={() => zoomButtons(1.4)}
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

      <div className="w-full shrink-0 space-y-5 lg:w-80">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            How wide is the storefront?
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Drag the two dots to the left and right ends of the storefront —
            the same wall the sign goes on. Then enter the width.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Scroll to zoom in for precise placement. Drag the photo to pan.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <label className="block">
            <span className="text-sm font-medium text-zinc-200">Width — feet</span>
            <input
              type="number"
              min={0}
              max={300}
              placeholder="e.g. 24"
              value={measurement.feet || ""}
              onChange={(e) =>
                onChange({ ...measurement, feet: Number(e.target.value) })
              }
              className="mt-1 w-24 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-200">Inches</span>
            <input
              type="number"
              min={0}
              max={11}
              value={measurement.inches || ""}
              placeholder="0"
              onChange={(e) =>
                onChange({ ...measurement, inches: Number(e.target.value) })
              }
              className="mt-1 w-20 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
        </div>
        {!ipp && (
          <p className="text-sm text-zinc-400">
            Enter the storefront width to continue — a tape measure across the
            front, or the frontage from your lease or plans.
          </p>
        )}
        {ipp !== null && px < 100 && (
          <p className="text-sm text-amber-400">
            The line is very short — stretch it across the full storefront for
            accurate sizes.
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onBack}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={!ipp}
            className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
          >
            Continue to design
          </button>
        </div>
      </div>
    </div>
  );
}
