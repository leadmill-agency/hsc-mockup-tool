"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import UploadStep from "@/components/UploadStep";
import SquareUpStep from "@/components/SquareUpStep";
import PricePanel from "@/components/PricePanel";
import { DEFAULT_SQUARE, SquareParams } from "@/lib/warp";
import { inchesPerPixel, MeasurementState, SignElement } from "@/lib/types";
import { DEFAULT_PRICING, PricingConfig } from "@/lib/pricing";
import {
  blobToImage,
  dataUrlToBlob,
  deleteProject,
  getProject,
  listProjects,
  makeThumbnail,
  ProjectSummary,
  saveProject,
} from "@/lib/store";

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
  const [screen, setScreen] = useState<"home" | "work">("home");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loadingProject, setLoadingProject] = useState(false);

  const [step, setStep] = useState<Step>("upload");
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [corrected, setCorrected] = useState<HTMLImageElement | null>(null);
  const [squareParams, setSquareParams] = useState<SquareParams>(DEFAULT_SQUARE);
  const [measurement, setMeasurement] = useState<MeasurementState | null>(null);
  const [elements, setElementsState] = useState<SignElement[]>([]);
  const [backerPlates, setBackerPlates] = useState(0);
  const [pricingCfg, setPricingCfg] = useState<PricingConfig>(DEFAULT_PRICING);

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

  const refreshProjects = useCallback(() => {
    listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // ---- autosave (debounced) ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (screen !== "work" || !projectId || !original || loadingProject) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const [originalBlob, correctedBlob] = await Promise.all([
          dataUrlToBlob(original.src),
          corrected ? dataUrlToBlob(corrected.src) : Promise.resolve(undefined),
        ]);
        await saveProject({
          id: projectId,
          name: projectName || "Untitled project",
          updatedAt: Date.now(),
          thumbnail: makeThumbnail(corrected ?? original),
          originalBlob,
          correctedBlob: correctedBlob ?? undefined,
          squareParams,
          measurement,
          elements,
          backerPlates,
          step,
        });
        refreshProjects();
      } catch {
        // autosave must never break the editor
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    screen,
    projectId,
    projectName,
    original,
    corrected,
    squareParams,
    measurement,
    elements,
    backerPlates,
    step,
    loadingProject,
    refreshProjects,
  ]);

  const newProject = () => {
    setProjectId(crypto.randomUUID());
    setProjectName(
      `Project ${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`
    );
    setOriginal(null);
    setCorrected(null);
    setMeasurement(null);
    setElementsState([]);
    setBackerPlates(0);
    setSquareParams(DEFAULT_SQUARE);
    resetHistory();
    setStep("upload");
    setScreen("work");
  };

  const openProject = async (id: string) => {
    setLoadingProject(true);
    try {
      const p = await getProject(id);
      if (!p) return;
      const [orig, corr] = await Promise.all([
        p.originalBlob ? blobToImage(p.originalBlob) : Promise.resolve(null),
        p.correctedBlob ? blobToImage(p.correctedBlob) : Promise.resolve(null),
      ]);
      // Konva reads image.src for exports; ensure data URLs, not object URLs,
      // survive re-saves — blobToImage uses object URLs which work for canvas.
      setProjectId(p.id);
      setProjectName(p.name);
      setOriginal(orig);
      setCorrected(corr);
      setSquareParams(p.squareParams);
      setMeasurement(p.measurement);
      setElementsState(p.elements);
      setBackerPlates(p.backerPlates);
      resetHistory();
      const s = (["upload", "square", "measure", "design"] as Step[]).includes(
        p.step as Step
      )
        ? (p.step as Step)
        : "upload";
      setStep(orig ? s : "upload");
      setScreen("work");
    } finally {
      setLoadingProject(false);
    }
  };

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

  if (screen === "home") {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <h1 className="text-lg font-bold tracking-tight">
              <span className="text-amber-400">HSC</span> Sign Mockup Tool
            </h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Projects</h2>
            <button
              onClick={newProject}
              className="rounded-lg bg-amber-400 px-5 py-2 font-semibold text-zinc-950 hover:bg-amber-300"
            >
              + New project
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="mt-10 text-center text-zinc-500">
              No saved projects yet — start one and it will autosave here.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 transition-colors hover:border-amber-400/60"
                >
                  <button
                    onClick={() => openProject(p.id)}
                    className="block w-full text-left"
                  >
                    {p.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbnail}
                        alt=""
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-3xl">
                        🪧
                      </div>
                    )}
                    <div className="p-3">
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {p.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(p.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete “${p.name}”? This cannot be undone.`))
                        deleteProject(p.id).then(refreshProjects);
                    }}
                    className="w-full border-t border-zinc-800 py-1.5 text-xs text-zinc-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button
            onClick={() => {
              setScreen("home");
              refreshProjects();
            }}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
            title="Back to projects (work is autosaved)"
          >
            ← Projects
          </button>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-amber-400">HSC</span>
          </h1>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-56 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
            title="Project name"
          />
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
              resetHistory();
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
            projectName={projectName}
            backerPlates={backerPlates}
            pricingCfg={pricingCfg}
            onBack={() => setStep("measure")}
            sidebar={
              <PricePanel
                elements={elements}
                ipp={ipp}
                backerPlates={backerPlates}
                setBackerPlates={setBackerPlates}
                cfg={pricingCfg}
                setCfg={(updater) => setPricingCfg((c) => updater(c))}
              />
            }
          />
        )}
      </main>
    </div>
  );
}
