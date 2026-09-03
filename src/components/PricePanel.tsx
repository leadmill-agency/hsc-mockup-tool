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
  racewayCount,
  SignElement,
  textLetterHeightInches,
} from "@/lib/types";

interface Props {
  elements: SignElement[];
  ipp: number;
  cfg: PricingConfig;
  setCfg: (updater: (c: PricingConfig) => PricingConfig) => void;
}

function letterCount(text: string): number {
  return text.replace(/\s/g, "").length;
}

export function elementsToPieces(elements: SignElement[], ipp: number): PieceGroup[] {
  return elements.flatMap((el) =>
    el.kind === "panel"
      ? [] // panels price as backer-plate add-ons, not pieces
      : el.kind === "text"
      ? el.signStyle === "cabinet"
        ? {
            // cabinet/box signs price as one piece at overall box height
            label: `“${el.text}” — cabinet sign`,
            heightInches: cabinetHeightInches(el, ipp),
            count: 1,
          }
        : {
            label: `“${el.text}” — ${letterCount(el.text)} letters`,
            heightInches: textLetterHeightInches(el, ipp),
            count: letterCount(el.text),
          }
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

export default function PricePanel({ elements, ipp, cfg, setCfg }: Props) {
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
      <span className="text-zinc-400">{label}</span>
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
        className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right tabular-nums text-zinc-200"
      />
    </label>
  );

  return (
    <div className="w-full shrink-0 space-y-4 lg:w-80">
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="font-semibold text-zinc-100">Estimate</h3>

        <div className="mt-3 space-y-2 text-sm">
          {pieces.length === 0 && (
            <p className="text-zinc-500">Add sign text or a logo to price it.</p>
          )}
          {pieces.map((p, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate text-zinc-400">{p.label}</span>
              <span className="whitespace-nowrap tabular-nums text-zinc-200">
                {formatFeetInches(p.heightInches)} tall
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-700 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Backer plates (+$400 each)</span>
            <span className="text-sm tabular-nums text-zinc-100">
              {backers}
              <span className="ml-1 text-xs text-zinc-500">from design</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Wireway (+$400 flat)</span>
            <span className="text-sm tabular-nums text-zinc-100">
              {wireways}
              <span className="ml-1 text-xs text-zinc-500">from design</span>
            </span>
          </div>
        </div>

        {pieces.length > 0 && (
          <>
            <div className="mt-4 space-y-1 border-t border-zinc-700 pt-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Pieces cost</span>
                <span className="tabular-nums">{formatUsd(pricing.pieceCost, true)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Base</span>
                <span className="tabular-nums">{formatUsd(cfg.baseCost)}</span>
              </div>
              {pricing.addOnTotal > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Add-ons</span>
                  <span className="tabular-nums">{formatUsd(pricing.addOnTotal)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium text-zinc-200">
                <span>Est. project cost (internal)</span>
                <span className="tabular-nums">{formatUsd(pricing.cost, true)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-amber-400/10 p-3 text-center">
              <div className="text-xs uppercase tracking-wide text-amber-300/80">
                Estimated project investment
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-amber-300">
                {formatUsd(pricing.low)} – {formatUsd(pricing.high)}
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {Math.round(cfg.lowMargin * 100)}%–{Math.round(cfg.highMargin * 100)}%
                gross margin · target 40–50%
              </div>
            </div>
          </>
        )}
      </div>

      <details className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <summary className="cursor-pointer text-sm font-medium text-zinc-300">
          Pricing settings
        </summary>
        <div className="mt-3 space-y-2">
          {cfgField("coefficient", "$ / inch / piece", 0.05)}
          {cfgField("baseCost", "Base cost $", 50)}
          {cfgField("addOnCost", "Add-on $ each", 50)}
          {cfgField("lowMargin", "Low margin %", 1, true)}
          {cfgField("highMargin", "High margin %", 1, true)}
          {cfgField("roundTo", "Round to $", 10)}
        </div>
      </details>

      <p className="px-1 text-xs text-zinc-500">
        Preliminary budget estimate from photographic measurement. Final pricing
        requires site verification.
      </p>
    </div>
  );
}
