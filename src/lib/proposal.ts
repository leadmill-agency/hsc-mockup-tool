// Preliminary proposal document (PRD §8.13): opened in a new window as
// print-styled HTML — the browser's Save as PDF stands in for server-side
// rendering in the internal tool.

import {
  formatFeetInches,
  formatUsd,
  PieceGroup,
  PricingResult,
} from "@/lib/pricing";

export interface ProposalInput {
  projectName: string;
  dayPng: string;
  nightPng?: string;
  pieces: PieceGroup[];
  pricing: PricingResult;
  wireways: number;
  backerPlates: number;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildProposalHtml(input: ProposalInput): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const rows = input.pieces
    .map(
      (p) => `<tr>
        <td>${esc(p.label)}</td>
        <td>${formatFeetInches(p.heightInches)} letter height</td>
      </tr>`
    )
    .join("");
  const addOns = [
    input.wireways > 0 ? "Raceway/wireway mounting" : null,
    input.backerPlates > 0 ? `${input.backerPlates} backer plate(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Preliminary Sign Concept &amp; Budget Estimate — ${esc(input.projectName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
         color: #1c1917; margin: 0; padding: 40px; max-width: 800px;
         margin-inline: auto; }
  header { display: flex; justify-content: space-between; align-items: baseline;
           border-bottom: 3px solid #f59e0b; padding-bottom: 12px; }
  .brand { font-size: 22px; font-weight: 800; }
  .brand span { color: #d97706; }
  h1 { font-size: 20px; margin: 24px 0 4px; }
  .meta { color: #57534e; font-size: 14px; margin-bottom: 20px; }
  figure { margin: 0 0 8px; }
  figure img { width: 100%; border-radius: 8px; border: 1px solid #e7e5e4; }
  figcaption { font-size: 12px; color: #78716c; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e7e5e4; }
  .invest { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;
            padding: 16px 20px; margin: 20px 0; text-align: center; }
  .invest .label { font-size: 12px; letter-spacing: .08em; text-transform: uppercase;
                   color: #92400e; }
  .invest .range { font-size: 28px; font-weight: 800; color: #92400e; }
  .fine { font-size: 12px; color: #78716c; line-height: 1.5; }
  .next { background: #f5f5f4; border-radius: 8px; padding: 12px 16px;
          font-size: 14px; margin: 16px 0; }
  .print-btn { position: fixed; top: 16px; right: 16px; background: #f59e0b;
               border: none; border-radius: 8px; padding: 10px 18px;
               font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } body { padding: 0; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">Print / Save PDF</button>
<header>
  <div class="brand"><span>Houston</span> Sign Crafters</div>
  <div class="meta">${date}</div>
</header>
<h1>Preliminary Sign Concept &amp; Budget Estimate</h1>
<div class="meta">${esc(input.projectName)}</div>
<figure><img src="${input.dayPng}" alt="Proposed sign — day view"><figcaption>Proposed sign — day view</figcaption></figure>
${input.nightPng ? `<figure><img src="${input.nightPng}" alt="Proposed sign — night view"><figcaption>Proposed sign — illuminated night view</figcaption></figure>` : ""}
<h1>Preliminary dimensions</h1>
<table>${rows}</table>
${addOns ? `<div class="meta">Includes: ${esc(addOns)}</div>` : ""}
<div class="invest">
  <div class="label">Estimated project investment</div>
  <div class="range">${formatUsd(input.pricing.low)} – ${formatUsd(input.pricing.high)}</div>
</div>
<div class="next"><b>Next step:</b> We will review this concept, confirm
installation conditions, and finalize pricing during your scheduled
consultation.</div>
<p class="fine">This is a preliminary budget estimate based on customer-provided
information and photographic measurements. Final pricing is subject to site
verification, landlord requirements, permitting, engineering, electrical
conditions, access, and approved scope. Dimensions are for sales estimation
only; a final field survey is required before production.</p>
</body></html>`;
}

/** Write the proposal into a window opened synchronously from a click. */
export function writeProposal(w: Window, input: ProposalInput): void {
  w.document.open();
  w.document.write(buildProposalHtml(input));
  w.document.close();
}
