// HSC pricing formula (PRD §8.12).
// The formula output is PROJECT COST; selling price = cost ÷ (1 − margin).

export interface PricingConfig {
  coefficient: number; // $ per inch of piece height, per piece
  baseCost: number;
  addOnCost: number; // per backer plate or wireway
  lowMargin: number; // displayed low end
  highMargin: number; // displayed high end
  roundTo: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  coefficient: 7.05,
  baseCost: 2000,
  addOnCost: 400,
  lowMargin: 0.35,
  highMargin: 0.6,
  roundTo: 50,
};

export interface PieceGroup {
  label: string;
  heightInches: number;
  count: number;
}

export interface PricingResult {
  pieceCost: number;
  addOnTotal: number;
  cost: number;
  low: number;
  high: number;
}

export function calculatePricing(
  pieces: PieceGroup[],
  backerPlates: number,
  wireways: number,
  cfg: PricingConfig = DEFAULT_PRICING
): PricingResult {
  const pieceCost = pieces.reduce(
    (sum, p) => sum + p.heightInches * p.count * cfg.coefficient,
    0
  );
  // backer plates price per piece; wireways are a single flat adder for the job
  const addOnTotal =
    backerPlates * cfg.addOnCost + (wireways > 0 ? cfg.addOnCost : 0);
  const cost = pieceCost + cfg.baseCost + addOnTotal;
  const round = (v: number) => Math.round(v / cfg.roundTo) * cfg.roundTo;
  return {
    pieceCost,
    addOnTotal,
    cost,
    low: round(cost / (1 - cfg.lowMargin)),
    high: round(cost / (1 - cfg.highMargin)),
  };
}

export function formatUsd(v: number, cents = false): string {
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  });
}

export function formatFeetInches(inches: number): string {
  // round to whole inches first so 23.7" carries to 2' 0", never 1' 12"
  const total = Math.round(inches);
  const ft = Math.floor(total / 12);
  const inch = total - ft * 12;
  if (ft === 0) return `${inch}"`;
  return `${ft}' ${inch}"`;
}
