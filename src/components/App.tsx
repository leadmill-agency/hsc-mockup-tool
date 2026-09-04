"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import UploadStep from "@/components/UploadStep";
import SquareUpStep from "@/components/SquareUpStep";
import PricePanel from "@/components/PricePanel";
import { DEFAULT_SQUARE, SquareParams } from "@/lib/warp";
import {
  backerCount,
  inchesPerPixel,
  Measurement,
  migrateMeasurement,
  SignElement,
} from "@/lib/types";
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
import {
  CustomerInfo,
  deleteProjectCloud,
  getProjectCloud,
  listProjectsCloud,
  saveProjectCloud,
  urlToImage,
} from "@/lib/cloud";

type ListedProject = ProjectSummary & { local?: boolean };

const MeasureStep = dynamic(() => import("@/components/MeasureStep"), { ssr: false });
const DesignStep = dynamic(() => import("@/components/DesignStep"), { ssr: false });

type Step = "upload" | "square" | "measure" | "design";

const STEPS: { key: Step; label: string; customerLabel: string }[] = [
  { key: "upload", label: "1 · Photo", customerLabel: "1 · Photo" },
  { key: "square", label: "2 · Square up", customerLabel: "2 · Straighten" },
  { key: "measure", label: "3 · Measure", customerLabel: "3 · Size" },
  { key: "design", label: "4 · Design & price", customerLabel: "4 · Design" },
];

export default function App({
  customerProjectId,
  publicMode,
}: {
  customerProjectId?: string;
  /** Root-URL visitors: customer experience with a fresh project created on
   *  the spot; proposal is email-gated; completion points at booking a call. */
  publicMode?: boolean;
}) {
  const customerMode = !!customerProjectId;
  // customer-style UX (welcome screen, looks, blue chrome, no internals) —
  // booked customers AND anonymous public visitors
  const customerUX = customerMode || !!publicMode;
  const [screen, setScreen] = useState<"home" | "work">(
    customerUX ? "work" : "home"
  );
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [welcomeDone, setWelcomeDone] = useState(false);
  // asked on the welcome screen; seeds the auto-placed sign in DesignStep
  const [businessName, setBusinessName] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [projects, setProjects] = useState<ListedProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loadingProject, setLoadingProject] = useState(false);

  const [step, setStep] = useState<Step>("upload");
  const [original, setOriginal] = useState<HTMLImageElement | null>(null);
  const [corrected, setCorrected] = useState<HTMLImageElement | null>(null);
  const [squareParams, setSquareParams] = useState<SquareParams>(DEFAULT_SQUARE);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [elements, setElementsState] = useState<SignElement[]>([]);
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

  // Cloud list is the shared truth; local IndexedDB projects that haven't
  // reached the cloud yet appear with a "this device" badge.
  const refreshProjects = useCallback(async () => {
    const [cloud, local] = await Promise.all([
      listProjectsCloud().catch(() => null),
      listProjects().catch(() => [] as ProjectSummary[]),
    ]);
    const cloudList: ListedProject[] = cloud ?? [];
    const cloudIds = new Set(cloudList.map((p) => p.id));
    const localOnly: ListedProject[] = local
      .filter((p) => !cloudIds.has(p.id))
      .map((p) => ({ ...p, local: true }));
    setProjects(
      [...cloudList, ...localOnly].sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }, []);

  useEffect(() => {
    if (!customerUX) refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshProjects]);

  // customer links open exactly one project
  const customerOpened = useRef(false);
  useEffect(() => {
    if (!customerMode || customerOpened.current) return;
    customerOpened.current = true;
    void openProject(customerProjectId!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerMode]);

  // Legacy emailed links land as /?open=<projectId>. On the public root that
  // is a customer's project — send them to their personal /c/ link; on /staff
  // open it in place.
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current) return;
    openedFromLink.current = true;
    const id = new URLSearchParams(window.location.search).get("open");
    if (id && /^[a-zA-Z0-9-]{8,64}$/.test(id)) {
      if (publicMode) {
        window.location.replace(`/c/${id}`);
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);
      void openProject(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- autosave (debounced) ----
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (screen !== "work" || !projectId || !original || loadingProject) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const base = {
        id: projectId,
        name: projectName || "Untitled project",
        updatedAt: Date.now(),
        thumbnail: makeThumbnail(corrected ?? original),
        squareParams,
        measurement,
        elements,
        backerPlates: backerCount(elements),
        step,
        customer: customer ?? undefined,
      };
      try {
        // cloud first — projects follow the user across devices
        await saveProjectCloud({
          ...base,
          originalSrc: original.src,
          correctedSrc: corrected?.src,
        });
        refreshProjects();
      } catch {
        // offline / backend unavailable: keep the work safe locally
        try {
          const [originalBlob, correctedBlob] = await Promise.all([
            dataUrlToBlob(original.src),
            corrected ? dataUrlToBlob(corrected.src) : Promise.resolve(undefined),
          ]);
          await saveProject({
            ...base,
            originalBlob,
            correctedBlob: correctedBlob ?? undefined,
          });
          refreshProjects();
        } catch {
          // autosave must never break the editor
        }
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
    step,
    customer,
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
    setSquareParams(DEFAULT_SQUARE);
    resetHistory();
    setStep("upload");
    setScreen("work");
  };

  const applyLoaded = (loaded: {
    id: string;
    name: string;
    original: HTMLImageElement | null;
    corrected: HTMLImageElement | null;
    squareParams: SquareParams;
    measurement: ReturnType<typeof migrateMeasurement>;
    elements: SignElement[];
    step: string;
    customer?: CustomerInfo | null;
  }) => {
    setCustomer(loaded.customer ?? null);
    setProjectId(loaded.id);
    setProjectName(loaded.name);
    setOriginal(loaded.original);
    setCorrected(loaded.corrected);
    setSquareParams(loaded.squareParams);
    setMeasurement(loaded.measurement);
    setElementsState(loaded.elements);
    resetHistory();
    const s = (["upload", "square", "measure", "design"] as Step[]).includes(
      loaded.step as Step
    )
      ? (loaded.step as Step)
      : "upload";
    setStep(loaded.original ? s : "upload");
    setScreen("work");
  };

  const openProject = async (id: string) => {
    setLoadingProject(true);
    try {
      // cloud first
      const c = await getProjectCloud(id).catch(() => null);
      if (c) {
        const [orig, corr] = await Promise.all([
          c.state.originalUrl ? urlToImage(c.state.originalUrl) : Promise.resolve(null),
          c.state.correctedUrl ? urlToImage(c.state.correctedUrl) : Promise.resolve(null),
        ]);
        applyLoaded({
          id: c.id,
          name: c.name,
          original: orig,
          corrected: corr,
          squareParams: c.state.squareParams,
          measurement: migrateMeasurement(c.state.measurement),
          elements: c.state.elements ?? [],
          step: c.state.step,
          customer: c.state.customer ?? null,
        });
        return;
      }
      // fall back to this device's IndexedDB copy
      const p = await getProject(id);
      if (!p) return;
      const [orig, corr] = await Promise.all([
        p.originalBlob ? blobToImage(p.originalBlob) : Promise.resolve(null),
        p.correctedBlob ? blobToImage(p.correctedBlob) : Promise.resolve(null),
      ]);
      applyLoaded({
        id: p.id,
        name: p.name,
        original: orig,
        corrected: corr,
        squareParams: p.squareParams,
        measurement: migrateMeasurement(p.measurement),
        elements: p.elements,
        step: p.step,
      });
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

  // Two starting references: a horizontal storefront-width line (value blank —
  // a guessed default must never silently drive pricing) and a 7-ft door line
  // that only counts once the user drags it onto an actual door.
  const defaultMeasurement = (img: HTMLImageElement): Measurement => ({
    references: [
      {
        id: "width",
        kind: "width",
        x1: img.naturalWidth * 0.12,
        y1: img.naturalHeight * 0.55,
        x2: img.naturalWidth * 0.88,
        y2: img.naturalHeight * 0.55,
        feet: 0,
        inches: 0,
        placed: true,
      },
      {
        id: "door",
        kind: "door",
        x1: img.naturalWidth * 0.32,
        y1: img.naturalHeight * 0.72,
        x2: img.naturalWidth * 0.32,
        y2: img.naturalHeight * 0.45,
        feet: 7,
        inches: 0,
        placed: false,
      },
    ],
  });

  const consultTime = customer?.startTime
    ? new Date(customer.startTime).toLocaleString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
      })
    : null;

  // public visitors get a fresh project the moment they start designing
  const startDesign = () => {
    if (publicMode && !projectId) {
      setProjectId(crypto.randomUUID());
      setProjectName(
        businessName.trim() ? `${businessName.trim()} · website` : "Website visitor"
      );
    }
    setWelcomeDone(true);
  };

  // customer welcome screen (PRD §8.4) before the first photo
  if (customerUX && !welcomeDone && !original && !loadingProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="text-lg font-bold">
            <span className="text-blue-400">Houston</span> Sign Crafters
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            {publicMode
              ? "See your new sign on your building — in 5 minutes"
              : "See your new sign on your building — before our call"}
          </h1>
          {consultTime && (
            <p className="mt-2 text-sm text-blue-300">
              Your consult: {consultTime}
            </p>
          )}
          <p className="mt-4 text-sm leading-6 text-zinc-300">
            {publicMode
              ? "Snap a photo of your storefront and we'll put a finished sign right on it — day and night — with a realistic budget range. Free, no signup needed."
              : "This takes about 5 minutes. Snap a photo of your storefront and we'll put a finished sign right on it — day and night — with a realistic budget range. We'll fine-tune it together on the call."}
          </p>
          <label className="mt-5 block">
            <span className="text-sm font-medium text-zinc-100">
              What&apos;s your business name?
            </span>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startDesign()}
              placeholder="e.g. Peach Cobbler Co"
              className="mt-2 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              We&apos;ll design your first sign for you — you just tweak it.
            </span>
          </label>
          <button
            onClick={startDesign}
            className="mt-5 w-full rounded-lg bg-blue-500 py-3 font-semibold text-white hover:bg-blue-400"
          >
            Start my design
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Nothing here is final — play around. Measurements and pricing are
            confirmed on your consultation.
          </p>
        </div>
      </div>
    );
  }

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
                        {p.local && (
                          <span className="ml-2 rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">
                            this device
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {new Date(p.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete “${p.name}”? This cannot be undone.`))
                        Promise.allSettled([
                          deleteProjectCloud(p.id),
                          deleteProject(p.id),
                        ]).then(refreshProjects);
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
          {!customerUX && (
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
          )}
          <h1 className="text-lg font-bold tracking-tight">
            <span className={customerUX ? "text-blue-400" : "text-amber-400"}>
              {customerUX ? "Houston" : "HSC"}
            </span>
            {customerUX ? " Sign Crafters" : ""}
          </h1>
          {customerUX ? (
            consultTime && (
              <span className="text-xs text-zinc-400">
                Consult: {consultTime}
              </span>
            )
          ) : (
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-56 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-zinc-100 hover:border-zinc-700 focus:border-zinc-600 focus:outline-none"
              title="Project name"
            />
          )}
          <nav className="flex gap-1 text-sm">
            {STEPS.map((s) => (
              <button
                key={s.key}
                onClick={() => reached(s.key) && setStep(s.key)}
                disabled={!reached(s.key)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  step === s.key
                    ? customerUX
                      ? "bg-blue-500 font-semibold text-white"
                      : "bg-amber-400 font-semibold text-zinc-950"
                    : reached(s.key)
                      ? "text-zinc-300 hover:bg-zinc-800"
                      : "text-zinc-600"
                }`}
              >
                {customerUX ? s.customerLabel : s.label}
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
            customerMode={customerUX}
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
            customerMode={customerUX}
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
            pricingCfg={pricingCfg}
            customerMode={customerUX}
            customerEmail={customer?.email}
            onCustomerEmail={(email) =>
              setCustomer((c) => ({
                email,
                name: c?.name || businessName.trim(),
                startTime: c?.startTime ?? null,
              }))
            }
            businessName={businessName}
            signAnchorY={(() => {
              const w = measurement?.references.find((r) => r.kind === "width");
              return w ? Math.min(w.y1, w.y2) : undefined;
            })()}
            onProposalSent={(to) => setSentTo(to)}
            onBack={() => setStep("measure")}
            sidebar={
              <PricePanel
                elements={elements}
                ipp={ipp}
                cfg={pricingCfg}
                setCfg={(updater) => setPricingCfg((c) => updater(c))}
                customer={customerUX}
              />
            }
          />
        )}
      </main>

      {sentTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center">
            <div className="text-4xl">📬</div>
            <h2 className="mt-3 text-xl font-bold text-zinc-100">
              Proposal sent!
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              Check <b>{sentTo}</b> for your mockup and budget estimate.
            </p>
            {consultTime ? (
              <p className="mt-2 text-sm text-blue-300">
                We&apos;ll review it together on {consultTime}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-300">
                Want exact pricing, permits, and a timeline? Grab a free
                15-minute call — we&apos;ll pull up your design together.
              </p>
            )}
            <p className="mt-3 text-xs text-zinc-500">
              Didn&apos;t get it? Check spam, or close this and press
              &ldquo;Email my proposal&rdquo; again.
            </p>
            {!consultTime && (
              <a
                href="https://houstonsigncrafters.com/book"
                className="mt-5 block w-full rounded-lg bg-blue-500 py-3 font-semibold text-white hover:bg-blue-400"
              >
                Book my free call
              </a>
            )}
            <button
              onClick={() => setSentTo(null)}
              className={`rounded-lg border border-zinc-600 px-5 py-2 text-sm text-zinc-200 hover:bg-zinc-800 ${
                consultTime ? "mt-5" : "mt-3"
              }`}
            >
              Back to my design
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
