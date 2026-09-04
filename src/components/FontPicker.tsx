"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONTS } from "@/lib/types";
import { GOOGLE_FONTS, googleFamily, loadGoogleFont } from "@/lib/fonts";

interface Props {
  value: string; // css font-family string currently applied
  onPick: (family: string, googleName?: string) => void;
  /** Bright-showroom styling for the customer surface. */
  customerMode?: boolean;
}

/** Human label for a stored css family string. */
export function fontLabel(family: string): string {
  const preset = FONTS.find((f) => f.family === family);
  if (preset) return preset.label;
  const first = family.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return first;
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={className ?? "h-3.5 w-3.5"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={className ?? "h-4 w-4"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Two materials, one markup: staff cockpit dark, customer showroom light. */
function styles(customer: boolean) {
  return customer
    ? {
        trigger:
          "flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        chevron: "text-zinc-400",
        panel:
          "absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-zinc-200 bg-white shadow-[0_2px_8px_rgba(24,24,27,0.08),0_20px_48px_-16px_rgba(24,24,27,0.25)]",
        search:
          "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20",
        row: "block w-full px-3 py-2 text-left hover:bg-zinc-100",
        rowSelected: "bg-blue-50",
        rowName: "text-sm text-zinc-900",
        rowPreview: "truncate text-lg leading-6 text-zinc-500",
        quickRow: "block w-full px-3 py-1.5 text-left hover:bg-zinc-100",
        quickName: "text-sm text-zinc-700",
        quickPreview: "ml-3 text-lg text-zinc-500",
        heading:
          "px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500",
        count: "px-3 pb-1 pt-1 text-xs text-zinc-500",
        check: "text-blue-600",
      }
    : {
        trigger:
          "flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800",
        chevron: "text-zinc-500",
        panel:
          "absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl",
        search:
          "w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600",
        row: "block w-full px-3 py-2 text-left hover:bg-zinc-800",
        rowSelected: "bg-zinc-800",
        rowName: "text-sm text-zinc-100",
        rowPreview: "truncate text-lg leading-6 text-zinc-400",
        quickRow: "block w-full px-3 py-1.5 text-left hover:bg-zinc-800",
        quickName: "text-sm text-zinc-300",
        quickPreview: "ml-3 text-lg text-zinc-400",
        heading:
          "px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500",
        count: "px-3 pb-1 pt-1 text-xs text-zinc-500",
        check: "text-amber-400",
      };
}

function GoogleFontRow({
  name,
  selected,
  onPick,
  cls,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
  cls: ReturnType<typeof styles>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [loaded, setLoaded] = useState(false);

  // lazy-load the font when the row scrolls into view
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        obs.disconnect();
        loadGoogleFont(name).then(() => setLoaded(true));
      }
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [name]);

  return (
    <button
      ref={ref}
      onClick={onPick}
      className={`${cls.row} ${selected ? cls.rowSelected : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={cls.rowName}>{name}</span>
        {selected && <Check className={`h-4 w-4 ${cls.check}`} />}
      </div>
      <div
        className={cls.rowPreview}
        style={{ fontFamily: loaded ? googleFamily(name) : undefined }}
      >
        The quick brown fox
      </div>
    </button>
  );
}

export default function FontPicker({ value, onPick, customerMode }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const cls = styles(!!customerMode);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GOOGLE_FONTS;
    return GOOGLE_FONTS.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const pick = (family: string, googleName?: string) => {
    setOpen(false);
    setQuery("");
    onPick(family, googleName);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cls.trigger}
        style={{ fontFamily: value }}
        title="Font"
      >
        {fontLabel(value)}
        <Chevron className={`h-3.5 w-3.5 ${cls.chevron}`} />
      </button>
      {open && (
        <div className={cls.panel}>
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className={cls.search}
            />
          </div>
          <div className="max-h-96 overflow-y-auto pb-2">
            {!query && (
              <>
                <div className={cls.heading}>Quick picks</div>
                {FONTS.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => pick(f.family)}
                    className={`${cls.quickRow} ${
                      value === f.family ? cls.rowSelected : ""
                    }`}
                  >
                    <span className={cls.quickName}>{f.label}</span>
                    <span
                      className={cls.quickPreview}
                      style={{ fontFamily: f.family }}
                    >
                      Abc
                    </span>
                    {value === f.family && (
                      <span className={`float-right ${cls.check}`}>
                        <Check />
                      </span>
                    )}
                  </button>
                ))}
                <div className={cls.heading}>
                  Google Fonts · {GOOGLE_FONTS.length}
                </div>
              </>
            )}
            {query && (
              <div className={cls.count}>
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </div>
            )}
            {filtered.map((name) => (
              <GoogleFontRow
                key={name}
                name={name}
                selected={value === googleFamily(name)}
                onPick={() => pick(googleFamily(name), name)}
                cls={cls}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
