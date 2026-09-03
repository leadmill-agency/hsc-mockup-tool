"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FONTS } from "@/lib/types";
import { GOOGLE_FONTS, googleFamily, loadGoogleFont } from "@/lib/fonts";

interface Props {
  value: string; // css font-family string currently applied
  onPick: (family: string, googleName?: string) => void;
}

/** Human label for a stored css family string. */
export function fontLabel(family: string): string {
  const preset = FONTS.find((f) => f.family === family);
  if (preset) return preset.label;
  const first = family.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return first;
}

function GoogleFontRow({
  name,
  selected,
  onPick,
}: {
  name: string;
  selected: boolean;
  onPick: () => void;
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
      className={`block w-full px-3 py-2 text-left hover:bg-zinc-800 ${
        selected ? "bg-zinc-800" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-100">{name}</span>
        {selected && <span className="text-amber-400">✓</span>}
      </div>
      <div
        className="truncate text-lg leading-6 text-zinc-400"
        style={{ fontFamily: loaded ? googleFamily(name) : undefined }}
      >
        The quick brown fox
      </div>
    </button>
  );
}

export default function FontPicker({ value, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

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
        className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
        style={{ fontFamily: value }}
        title="Font"
      >
        {fontLabel(value)}
        <span className="text-zinc-500">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          <div className="p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search fonts…"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="max-h-96 overflow-y-auto pb-2">
            {!query && (
              <>
                <div className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Quick picks
                </div>
                {FONTS.map((f) => (
                  <button
                    key={f.label}
                    onClick={() => pick(f.family)}
                    className={`block w-full px-3 py-1.5 text-left hover:bg-zinc-800 ${
                      value === f.family ? "bg-zinc-800" : ""
                    }`}
                  >
                    <span className="text-sm text-zinc-300">{f.label}</span>
                    <span
                      className="ml-3 text-lg text-zinc-400"
                      style={{ fontFamily: f.family }}
                    >
                      Abc
                    </span>
                    {value === f.family && (
                      <span className="float-right text-amber-400">✓</span>
                    )}
                  </button>
                ))}
                <div className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Google Fonts · {GOOGLE_FONTS.length}
                </div>
              </>
            )}
            {query && (
              <div className="px-3 pb-1 pt-1 text-xs text-zinc-500">
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
              </div>
            )}
            {filtered.map((name) => (
              <GoogleFontRow
                key={name}
                name={name}
                selected={value === googleFamily(name)}
                onPick={() => pick(googleFamily(name), name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
