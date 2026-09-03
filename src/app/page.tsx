"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import UploadStep from "@/components/UploadStep";
import SquareUpStep from "@/components/SquareUpStep";
import PricePanel from "@/components/PricePanel";
import { DEFAULT_SQUARE, SquareParams } from "@/lib/warp";
import { inchesPerPixel, MeasurementState, SignElement } from "@/lib/types";

const MeasureStep = dynamic(() => import("@/components/MeasureStep"), { ssr: false });
const DesignStep = dynamic(() => import("@/components/DesignStep"), { ssr: false });

type Step = "upload" | "square" | "measure" | "design";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "1 · Photo" },
  { key: "square", label: "2 · Square up" },
  { key: "measure", label: "3 · Measure" },
  { key: "design", label: "4 · Design & price" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [corrected, setCorrected] = useState<HTMLImageElement | null>(null);
  const [squareParams, setSquareParams] = useState<SquareParams>(DEFAULT_SQUARE);
  const [measurement, setMeasurement] = useState<MeasurementState | null>(null);
  const [elements, setElementsState] = useState<SignElement[]>([]);
  const [backerPlates, setBackerPlates] = useState(0);

  // Undo history: beginAction() snapshots the current design before a discrete
  // change (drag start, transform start, add, delete, property edit).
  const pastRef = useRef<SignElement[][]>([]);
  const futureRef = useRef<SignElement[][]>([]);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const [, bumpHistory] = useState(0);

  const beginAction = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-49), elementsRef.current];
    futureRef.current = [];
    bumpHistory((t) => t + 1);
  }, []);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return;
    futureRef.current = [...futureRef.current, elementsRef.current];
    pastRef.current = past.slice(0, -1);
    setElementsState(past[past.length - 1]);
    bumpHistory((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (!future.length) return;
    pastRef.current = [...pastRef.current, elementsRef.current];
    futureRef.current = future.slice(0, -1);
    setElementsState(future[future.length - 1]);
    bumpHistory((t) => t + 1);
  }, []);

  const resetHistory = () => {
    pastRef.current = [];
    futureRef.current = [];
  };

  const ipp = inchesPerPixel(measurement);

  const reached = (s: Step): boolean => {
    switch (s) {
      case "upload":
        return true;
      case "square":
        return original !== null;
      case "measure":
        return corrected !== null;
      case "design":
        return corrected !== null && ipp !== null;
    }
  };

  // Horizontal storefront-width line; width intentionally starts empty so a
  // guessed default can never silently drive the pricing.
  const defaultMeasurement = (img: HTMLImageElement): MeasurementState => ({
    x1: img.naturalWidth * 0.12,
    y1: img.naturalHeight * 0.55,
    x2: img.naturalWidth * 0.88,
    y2: img.naturalHeight * 0.55,
    feet: 0,
    inches: 0,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-6">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-amber-400">HSC</span> Sign Mockup Tool
            <span className="ml-2 rounded bg-zinc-800 px-2 py-0.5 text-xs font-normal text-zinc-400">
              internal · milestone 1
            </span>
          </h1>
          <nav className="flex gap-1 text-sm">
            {STEPS.map((s) => (
              <button
                key={s.key}
                onClick={() => reached(s.key) && setStep(s.key)}
                disabled={!reached(s.key)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  step === s.key
                    ? "bg-amber-400 font-semibold text-zinc-950"
                    : reached(s.key)
                      ? "text-zinc-300 hover:bg-zinc-800"
                      : "text-zinc-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {step === "upload" && (
          <UploadStep
            onImage={(img) => {
              setOriginal(img);
              setCorrected(null);
              setMeasurement(null);
              setElementsState([]);
              setSquareParams(DEFAULT_SQUARE);
              setStep("square");
            }}
          />
        )}

        {step === "square" && original && (
          <SquareUpStep
            image={original}
            initialParams={squareParams}
            onApply={(img, params) => {
              setSquareParams(params);
              setCorrected(img);
              // Placement/measurement coordinates live in corrected-image space,
              // so a re-applied transform invalidates them (PRD §8.7).
              setMeasurement(defaultMeasurement(img));
              setElementsState([]);
              resetHistory();
              setStep("measure");
            }}
            onReplacePhoto={() => setStep("upload")}
          />
        )}

        {step === "measure" && corrected && measurement && (
          <MeasureStep
            image={corrected}
            measurement={measurement}
            onChange={setMeasurement}
            onBack={() => setStep("square")}
            onNext={() => setStep("design")}
          />
        )}

        {step === "design" && corrected && ipp && (
          <DesignStep
            image={corrected}
            ipp={ipp}
            elements={elements}
            setElements={(updater) => setElementsState((els) => updater(els))}
            beginAction={beginAction}
            undo={undo}
            redo={redo}
            canUndo={pastRef.current.length > 0}
            canRedo={futureRef.current.length > 0}
            onBack={() => setStep("measure")}
            sidebar={
              <PricePanel
                elements={elements}
                ipp={ipp}
                backerPlates={backerPlates}
                setBackerPlates={setBackerPlates}
              />
            }
          />
        )}
      </main>
    </div>
  );
}
