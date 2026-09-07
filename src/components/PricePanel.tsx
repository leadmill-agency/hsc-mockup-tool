"use client";

import {
  calculatePricing,
  formatFeetInches,
  formatUsd,
  PieceGroup,
  PricingConfig,
} from "@/lib/pricing";
import {
  backerCount,
  cabinetHeightInches,
  isBoxStyle,
  racewayCount,
  SignElement,
  textPieceGroups,
} from "@/lib/types";

interface Props {
  elements: SignElement[];
  ipp: number;
  cfg: PricingConfig;
  setCfg: (updater: (c: PricingConfig) => PricingConfig) => void;
  /** Customer mode: show only sizes and the investment range — no internal
   *  cost breakdown, add-on counts, or pricing settings. */
  customer?: boolean;
}

function letterCount(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function elementsToPieces(elements: SignElement[], ipp: number): PieceGroup[] {
  return elements.flatMap((el) =>
    el.kind === "panel"
      ? [] // panels price as backer-plate add-ons, not pieces
      : el.kind === "text"
      ? isBoxStyle(el)
        ? {
            // box-style signs price as one piece at overall face height
            label: `“${el.text}” — ${
              el.signStyle === "cloud" ? "cloud sign" : "cabinet sign"
            }`,
            heightInches: cabinetHeightInches(el, ipp),
            count: 1,
          }
        : // letters price per piece at each piece's measured height, so an
          // apostrophe is a small piece, not a full-height letter
          textPieceGroups(el, ipp).map((g, gi) => ({
            label:
              gi === 0
                ? `“${el.text}” — ${g.count} letter${g.count === 1 ? "" : "s"}`
                : `“${el.text}” — ${g.count} small piece${g.count === 1 ? "" : "s"}`,
            heightInches: g.heightInches,
            count: g.count,
          }))
      : el.priceAsLetters
        ? {
            label: `Logo — ${el.letterCount ?? 10} letters`,
            heightInches: (el.letterHeightRatio ?? 0.6) * el.height * ipp,
            count: el.letterCount ?? 10,
          }
        : {
            label: "Logo piece",
            heightInches: el.height * ipp,
            count: 1,
          }
  );
}

export default function PricePanel({ elements, ipp, cfg, setCfg, customer }: Props) {
  const pieces = elementsToPieces(elements, ipp);
  const wireways = racewayCount(elements);
  const backers = backerCount(elements);
  const pricing = calculatePricing(pieces, backers, wireways, cfg);

  const cfgField = (
    key: keyof PricingConfig,
    label: string,
    step: number,
    pct = false
  ) => (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-600">{label}</span>
      <input
        type="number"
        step={step}
        value={pct ? Math.round(cfg[key] * 100) : cfg[key]}
        onChange={(e) =>
          setCfg((c) => ({
            ...c,
            [key]: pct ? Number(e.target.value) / 100 : Number(e.target.value),
          }))
        }
        className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-right tabular-nums text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
      />
    </label>
  );

  return (
    <div className="w-full shrink-0 space-y-4 lg:w-80">
      <div
        className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_12px_32px_-16px_rgba(24,24,27,0.18)] ring-1 ring-zinc-200"
      >
        <h3
          className="text-lg font-bold tracking-tight text-zinc-900"
        >
          Your sign
        </h3>

        <div className="mt-3 space-y-2 text-sm">
          {pieces.length === 0 && (
            <p className="text-zinc-500">
              Add sign text or a logo to see your estimate.
            </p>
          )}
          {pieces.map((p, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate text-zinc-600">
                {p.label}
              </span>
              <span
                className="whitespace-nowrap font-medium tabular-nums text-zinc-900"
              >
                {formatFeetInches(p.heightInches)} tall
              </span>
            </div>
          ))}
        </div>

        {pieces.length > 0 && (
            <div className="mt-4 rounded-xl bg-blue-600 p-4 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]">
              <div className="text-sm font-medium text-blue-100">
                Estimated investment
              </div>
              <div className="mt-0.5 text-[26px] font-extrabold leading-tight tracking-tight tabular-nums">
                {formatUsd(pricing.low)} – {formatUsd(pricing.high)}
              </div>
              <div className="mt-1.5 text-sm leading-snug text-blue-100">
                Final pricing is confirmed with a real person on your
                consultation.
              </div>
            </div>
        )}

        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Preliminary estimate from photographic measurement. Final pricing
          requires site verification.
        </p>
      </div>

      {/* internal-only: truly absent in customer mode, collapsed for staff */}
      {!customer && (
      <details className="rounded-2xl bg-white p-4 opacity-80 shadow-[0_1px_2px_rgba(24,24,27,0.05),0_8px_24px_-16px_rgba(24,24,27,0.15)] ring-1 ring-zinc-200 transition-opacity open:opacity-100 hover:opacity-100">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500">
          Internal · staff only
        </summary>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Backer plates (+$400 each)</span>
            <span className="tabular-nums text-zinc-900">{backers}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-600">Wireway (+$400 flat)</span>
            <span className="tabular-nums text-zinc-900">{wireways}</span>
          </div>
          <div className="space-y-1 border-t border-zinc-200 pt-2">
            <div className="flex justify-between text-zinc-600">
              <span>Pieces cost</span>
              <span className="tabular-nums">{formatUsd(pricing.pieceCost, true)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Base</span>
              <span className="tabular-nums">{formatUsd(cfg.baseCost)}</span>
            </div>
            {pricing.addOnTotal > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Add-ons</span>
                <span className="tabular-nums">{formatUsd(pricing.addOnTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-zinc-900">
              <span>Est. project cost</span>
              <span className="tabular-nums">{formatUsd(pricing.cost, true)}</span>
            </div>
            <div className="text-xs text-zinc-500">
              Displayed range: {Math.round(cfg.lowMargin * 100)}%–
              {Math.round(cfg.highMargin * 100)}% gross margin · target 40–50%
            </div>
          </div>
          <div className="space-y-2 border-t border-zinc-200 pt-2">
            {cfgField("coefficient", "$ / inch / piece", 0.05)}
            {cfgField("baseCost", "Base cost $", 50)}
            {cfgField("addOnCost", "Add-on $ each", 50)}
            {cfgField("lowMargin", "Low margin %", 1, true)}
            {cfgField("highMargin", "High margin %", 1, true)}
            {cfgField("roundTo", "Round to $", 10)}
          </div>
        </div>
      </details>
      )}
    </div>
  );
}
