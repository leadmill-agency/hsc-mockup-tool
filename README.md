# HSC Sign Mockup Tool

Internal storefront-sign mockup and estimating tool for Houston Sign Crafters.
Staff take a customer's storefront photo from upload to a scale-calibrated
sign mockup with a live price estimate in a few minutes. This is the
internal-first phase of the [Storefront Sign Generator PRD](docs/PRD.md) —
the same pipeline later becomes the customer-facing generator.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL. No database or accounts — everything runs in
the browser.

## Workflow

1. **Photo** — upload a storefront photo (JPEG/PNG).
2. **Square up** — straighten + fix perspective against a grid, crop to the
   storefront. Corrections are non-destructive parameters; Apply bakes them
   via a WebGL homography warp.
3. **Measure** — drag two dots across the storefront frontage and enter its
   width (tape measure or lease/plans). This calibrates inches-per-pixel for
   everything that follows. The width field is intentionally blank — a guessed
   default must never silently drive pricing.
4. **Design & price** — drag sign text (rendered as channel letters: trim cap,
   extruded returns, shadow) and logos onto the photo. Live dimension badges,
   snap-to-whole-inch resize, Google Fonts picker, wall-color-matched
   raceways, automatic logo background removal, undo/redo, zoom/pan. The
   estimate updates live as you drag.

## Pricing

The formula produces **project cost**; selling price applies gross margin on
top (see PRD §8.12 — all values editable under "Pricing settings" in the app):

```
cost = (letter height in inches × letter count × $7.05) + $2,000
     + $400 per backer plate
     + $400 flat if the job uses a wireway/raceway

displayed low  = cost ÷ 0.65   (35% gross margin — floor HSC accepts)
displayed high = cost ÷ 0.40   (60% gross margin)
target sale    = 40–50% margin
```

"Letter height" means capital-letter height (cap height), measured per font.
Logos price as one piece by default, or per-letter via "Price as letters"
(staff enter count and true letter height). The wide displayed range is
intentional: it anchors budget and drives the prospect to the consultation.

## Architecture

Next.js + TypeScript + Tailwind, Konva for the design canvas.

| Path | What |
| --- | --- |
| `src/lib/pricing.ts` | Pricing engine and config |
| `src/lib/types.ts` | Element model, measurement math, cap-height per font |
| `src/lib/warp.ts` | Perspective square-up: CSS preview + WebGL homography bake |
| `src/lib/removeBg.ts` | Flood-fill logo background removal |
| `src/lib/fonts.ts` | On-demand Google Fonts loading |
| `src/components/*Step.tsx` | The four workflow steps |
| `src/components/PricePanel.tsx` | Live estimate sidebar |

Two invariants worth knowing before changing code:

- **Geometry is deterministic.** Dimensions come from the measured
  inches-per-pixel scale — never from any generative model (PRD §11.4).
- **Visible = priced.** Anything that costs money appears on the canvas, and
  anything on the canvas prices automatically (raceway count derives from the
  design, not a separate counter).

## Status

Validated against two real jobs (GTS Equipment, Peach Cobbler Factory) —
dimensions land within drag precision of the designer's drawings and pricing
matches hand calculations. Not yet built: saved projects, night view,
proposal PDF, CRM/funnel integration (see PRD §17 for the release plan).
