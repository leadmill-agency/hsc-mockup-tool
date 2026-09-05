// Preliminary proposal document, styled to match HSC's house format: the
// black italic title bars and blue identity cards from the drawing sets, and
// the itemized-section estimate layout from HSC web proposals — one vertical
// list, item details always expanded. Browser Save-as-PDF is the output path.

import { formatUsd } from "@/lib/pricing";

export interface ProposalItem {
  label: string;
  detail?: string;
  low: number;
  high: number;
}

export interface ProposalSection {
  title: string;
  items: ProposalItem[];
  low: number;
  high: number;
}

export interface SpecLine {
  label: string;
  value: string;
}

export interface ProposalInput {
  projectName: string;
  dayPng: string;
  nightPng?: string;
  sections: ProposalSection[];
  totalLow: number;
  totalHigh: number;
  specs: SpecLine[];
}

const HSC = {
  name: "HOUSTON SIGN CRAFTERS",
  web: "www.houstonsigncrafters.com",
  email: "sales@houstonsigncrafters.com",
  phone: "(832) 974-2546",
  address: "1359 E 40th St, Houston, TX 77022",
  blue: "#1e4bb8",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const range = (low: number, high: number) =>
  `${formatUsd(low)} – ${formatUsd(high)}`;

export function buildProposalHtml(input: ProposalInput): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const card = (title: string, body: string) => `
    <div class="card">
      <div class="card-head">${title}</div>
      <div class="card-body">${body}</div>
    </div>`;

  // Line items list WHAT is included (sizes, construction, mounting) but
  // deliberately carry no prices — only the overall project range shows, so
  // nobody reverse-engineers per-letter pricing by tweaking one item at a
  // time. The full breakdown stays internal.
  const sectionsHtml = input.sections
    .map(
      (s) => `
    <div class="est-section">
      <div class="est-head">
        <span>${esc(s.title)}</span>
      </div>
      ${s.items
        .map(
          (it) => `
        <div class="est-item">
          <div class="est-row">
            <span>${esc(it.label)}</span>
            <span class="est-included">Included</span>
          </div>
          ${it.detail ? `<div class="est-detail">${esc(it.detail)}</div>` : ""}
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");

  const specsHtml = input.specs.length
    ? `
    <div class="block">
      <div class="spec-title">CHANNEL LETTERS SPECIFICATION</div>
      ${input.specs
        .map(
          (sp) =>
            `<div class="spec-line"><b>${esc(sp.label)}:</b> ${esc(sp.value)}</div>`
        )
        .join("")}
      <div class="fine" style="margin-top:6px">Final materials confirmed at
      production; specific thicknesses determined per UL manufacturing
      standards.</div>
    </div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Preliminary Sign Concept &amp; Budget Estimate — ${esc(input.projectName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
         color: #17171b; margin: 0; background: #fff; }
  .page { max-width: 820px; margin: 0 auto; padding: 0 36px 40px; }
  .titlebar { background: #111; color: #fff; font-style: italic;
              font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
              padding: 8px 16px; font-size: 14px; }
  .brandrow { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap;
              padding: 18px 0 6px; }
  .brand { color: ${HSC.blue}; font-weight: 900; font-size: 26px;
           line-height: 1.02; align-self: center; letter-spacing: .01em; }
  .brand small { display: block; font-size: 15px; letter-spacing: .18em; }
  .cards { display: flex; gap: 10px; flex-wrap: wrap; margin-left: auto; }
  .card { border-radius: 10px; overflow: hidden; min-width: 150px;
          box-shadow: 0 1px 4px rgba(0,0,0,.25); font-size: 11px; }
  .card-head { background: ${HSC.blue}; color: #fff; font-weight: 800;
               text-transform: uppercase; text-align: center; padding: 5px 10px;
               letter-spacing: .06em; border-bottom: 2px solid #fff; }
  .card-body { background: ${HSC.blue}; color: #fff; text-align: center;
               padding: 8px 10px; font-weight: 600; line-height: 1.5; }
  .bar { background: #111; color: #fff; font-style: italic; font-weight: 800;
         text-transform: uppercase; letter-spacing: .05em; font-size: 13px;
         padding: 6px 12px; margin: 26px 0 10px; }
  figure { margin: 0 0 4px; break-inside: avoid; }
  figure img { width: 100%; border: 1px solid #e2e2e6; }
  figcaption { font-size: 11px; color: #6b6b74; margin-top: 4px; }
  .est-section { margin: 18px 0 6px; break-inside: avoid; }
  .est-head { display: flex; justify-content: space-between; align-items: baseline;
              font-weight: 800; text-transform: uppercase; letter-spacing: .03em;
              font-size: 15px; border-bottom: 2px solid #111;
              padding-bottom: 6px; }
  .est-total { color: ${HSC.blue}; font-size: 16px; }
  .est-item { border-bottom: 1px solid #e7e7ea; padding: 10px 0; }
  .est-row { display: flex; justify-content: space-between; font-size: 15px; }
  .est-price { white-space: nowrap; font-weight: 600; }
  .est-included { white-space: nowrap; font-weight: 600; font-size: 12px;
    color: #6b6b74; text-transform: uppercase; letter-spacing: 0.04em; }
  .est-detail { color: #6b6b74; font-size: 12.5px; margin-top: 4px;
                line-height: 1.5; max-width: 560px; }
  .invest { background: #f4f7ff; border: 2px solid ${HSC.blue}; border-radius: 10px;
            padding: 14px 20px; margin: 22px 0; text-align: center;
            break-inside: avoid; }
  .invest .label { font-size: 11px; letter-spacing: .1em; text-transform: uppercase;
                   color: ${HSC.blue}; font-weight: 800; }
  .invest .range { font-size: 27px; font-weight: 900; color: ${HSC.blue}; }
  .invest .sub { font-size: 11px; color: #6b6b74; margin-top: 2px; }
  .block { break-inside: avoid; }
  .spec-title { color: #1d4ed8; font-weight: 800; text-decoration: underline;
                text-transform: uppercase; font-size: 14px; margin: 4px 0 8px; }
  .spec-line { font-size: 13.5px; line-height: 1.7; }
  .next { background: #f4f4f5; border-radius: 8px; padding: 12px 16px;
          font-size: 13.5px; margin: 18px 0 10px; }
  .fine { font-size: 11px; color: #6b6b74; line-height: 1.55; }
  .footer { border-top: 3px solid ${HSC.blue}; margin-top: 26px; padding-top: 8px;
            font-size: 11px; color: #6b6b74; display: flex; gap: 14px;
            flex-wrap: wrap; }
  .print-btn { position: fixed; top: 14px; right: 14px; background: ${HSC.blue};
               color: #fff; border: none; border-radius: 8px; padding: 10px 18px;
               font-weight: 700; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style></head><body>
<button class="print-btn" onclick="window.print()">Print / Save PDF</button>
<div class="titlebar">${esc(input.projectName)} — Preliminary Sign Concept &amp; Budget Estimate</div>
<div class="page">
  <div class="brandrow">
    <div class="brand">HOUSTON<small>SIGN CRAFTERS</small></div>
    <div class="cards">
      ${card("Company Details", `${HSC.web}<br>${HSC.email}<br>${HSC.phone}`)}
      ${card("Project Name", esc(input.projectName))}
      ${card("Project Date", date)}
    </div>
  </div>

  <div class="bar">Proposed Sign — Day View</div>
  <figure><img src="${input.dayPng}" alt="Proposed sign — day view"></figure>
  ${
    input.nightPng
      ? `<div class="bar">Illuminated Night View</div>
  <figure><img src="${input.nightPng}" alt="Proposed sign — night view"></figure>`
      : ""
  }

  <div class="bar">Preliminary Estimate</div>
  ${sectionsHtml}

  <div class="invest">
    <div class="label">Estimated Project Investment</div>
    <div class="range">${range(input.totalLow, input.totalHigh)}</div>
    <div class="sub">Final pricing confirmed at your consultation</div>
  </div>

  ${specsHtml}

  <div class="next"><b>Next step:</b> We will review this concept, confirm
  installation conditions, and finalize pricing during your scheduled
  consultation.</div>
  <p class="fine">This is a preliminary budget estimate based on
  customer-provided information and photographic measurements. Final pricing
  is subject to site verification, landlord requirements, permitting,
  engineering, electrical conditions, access, and approved scope. Dimensions
  are for sales estimation only; a final field survey is required before
  production.</p>
  <div class="footer">
    <span>${HSC.name}</span><span>${HSC.address}</span>
    <span>${HSC.phone}</span><span>${HSC.email}</span>
  </div>
</div>
</body></html>`;
}

/** Write the proposal into a window opened synchronously from a click. */
export function writeProposal(w: Window, input: ProposalInput): void {
  w.document.open();
  w.document.write(buildProposalHtml(input));
  w.document.close();
}
