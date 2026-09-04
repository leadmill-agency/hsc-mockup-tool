---
name: HSC Sign Mockup Tool
description: Bright-showroom customer surface for designing and pricing a storefront sign on a photo of your own building.
colors:
  ink: "#18181b"
  warm-white: "#f7f7f5"
  card-white: "#ffffff"
  showroom-blue: "#2563eb"
  blue-hover: "#3b82f6"
  blue-well: "#eff6ff"
  blue-selection: "#bfdbfe"
  border: "#d4d4d8"
  hairline: "#e4e4e7"
  text-secondary: "#52525b"
  text-tertiary: "#71717a"
  placeholder: "#a1a1aa"
  night-wash: "#0b1120"
  door-green: "#4ade80"
typography:
  display:
    fontFamily: "Barlow, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Barlow, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Barlow, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Barlow, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Barlow, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.showroom-blue}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
  button-secondary:
    backgroundColor: "{colors.card-white}"
    textColor: "#3f3f46"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  chip:
    backgroundColor: "{colors.card-white}"
    textColor: "#3f3f46"
    rounded: "{rounded.md}"
    padding: "6px 8px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px"
---

# Design System: HSC Sign Mockup Tool

Recorded from the shipped code (2026-09-04). The project carries **two visual surfaces in one codebase**:

1. **The customer "bright showroom"** — the new world, the subject of this file. Scoped by the `.showroom` class (src/app/globals.css) and by `customerMode` / `customerUX` branches inside shared components.
2. **The staff cockpit** — the incumbent internal surface: dark zinc (`bg-zinc-950` / `bg-zinc-900`) with an amber-400 accent, red destructive actions, amber canvas markers. It is documented briefly at the bottom and is deliberately **not** the system for new customer work.

The direction contract (src/app/layout.tsx), quoted verbatim:

> THESIS: A sign shop's showroom in daylight — the customer's building is the exhibit; refuses the dark-panel configurator default.
>
> OWN-WORLD: Warm-white ground, ink #18181b, one blue #2563eb; Barlow (CA signage grotesque) display; white cards with soft offset shadows; the photo canvas is a dark framed stage where lit signs pop.

## Overview

**Creative North Star: "The Daylight Showroom"**

The customer surface reads as a real sign shop's showroom with the lights on: warm-white walls, ink lettering, one confident blue, and — at the center — a single dark framed stage where the customer's own building hangs like the exhibit. Everything around the stage is bright, quiet, and card-based; the only dark surface on the page is the photo canvas itself, so day scenes read naturally and lit signs pop at night. The voice is a working tradesperson's: friendly imperatives ("Drop your photo here", "Looks good — continue"), no jargon, and reassurance at every irreversible-feeling moment ("Nothing here is final — play around").

The build refuses the dark-panel configurator default. Chrome never competes with the mockup: controls are white cards and quiet outlined buttons; the blue is reserved for the one thing to do next (the CTA, the active step, the selected look, the price). Sign-industry controls live in the selection-driven "Make it yours" card in the right rail (plain-language labels: "How it lights at night", "Sign type"); the default path is reacting to finished looks, not composing from parts. When nothing is selected the card teaches the interaction ("Tap your sign on the photo…").

**Key Characteristics:**
- Warm-white ground, ink text, exactly one brand hue (blue #2563eb)
- White cards floated on soft two-part offset shadows; hairline zinc borders/rings
- One dark surface per screen: the rounded-2xl zinc-900 canvas stage
- Barlow everywhere in the UI; real sign-lettering webfonts only on the sign itself
- Drawn stroke-SVG icons, blue focus rings, a single "rise" entrance motion

## Colors

Ink and paper plus one working blue; every other value is a zinc neutral or lives inside the photo stage.

### Primary
- **Showroom Blue** (`#2563eb`, Tailwind blue-600): the single brand accent. Primary CTAs, active step label, active look-card ring, selected day/night segment, price callout background, dimension badges and the Konva transformer on the customer canvas, focus-visible outlines, link-style text buttons. Hover state lightens to **Working Blue** (`#3b82f6`, blue-500). Tints: **Blue Well** (`#eff6ff`, blue-50) for circular icon wells and selected dropdown rows; **Blue Selection** (`#bfdbfe`, blue-200) for `::selection`; focus ring is `#2563eb` at 20% opacity.

### Neutral
- **Ink** (`#18181b`, zinc-900): headings, primary text, the dark canvas-stage background, the active "Day" segment, Konva marker label text. The ink and the stage are the *same* value — the stage is a slab of ink.
- **Warm White** (`#f7f7f5`): the page ground (set on `.showroom` and propagated to `html`/`body` via `:has()` so OS-dark users still get a light page; `color-scheme: light` is pinned).
- **Card White** (`#ffffff`): every raised surface — cards, inputs, toolbar controls, modals, header.
- **Border** (`#d4d4d8`, zinc-300): control borders; hover darkens to zinc-400. **Hairline** (`#e4e4e7`, zinc-200): card rings, header rule, dividers.
- **Text ramp**: secondary body `#52525b` (zinc-600), tertiary/captions `#71717a` (zinc-500), placeholders `#a1a1aa` (zinc-400).

### Canvas-marker palette (inside the photo stage only)
- **Width line** `#3b82f6` (blue — on brand), **Door line** `#4ade80` (green, shared with staff), **Custom line** `#fafafa` (white); marker endpoint dots stroke in ink. **Night wash** `#0b1120` at 0.72 opacity over the photo. Scale-agreement confirmation text uses emerald-700 — the one green in showroom chrome, tied to the green door line it confirms. These are data markers on a photograph, not chrome; the green does not license green UI elsewhere.

### Named Rules
**The One-Blue Rule.** Blue #2563eb is the only brand hue on customer surfaces. Owner-pinned: the brand is black and blue only. Anything that is not blue is ink, zinc, or white.

**The No-Red Rule.** Even destructive actions stay ink on customer surfaces — the customer Delete button is a quiet white/zinc outline button (`tb.del` in DesignStep.tsx), never red. Red is a staff-cockpit convention only.

**The Dark-Stage Rule.** Exactly one dark surface per customer screen: the photo canvas (`rounded-2xl bg-zinc-900` + stage shadow). Look-card previews repeat it in miniature (gradient `#101014 → #23232a`). Nothing else on the showroom goes dark — no dark panels, headers, or footers.

## Typography

**UI Font:** Barlow (weights 400/500/600/700/800, via `next/font` variable `--font-barlow`, fallback `"Barlow", "Helvetica Neue", Arial, sans-serif`)
**Sign-lettering fonts (canvas only):** Oswald (default look), Archivo, Dancing Script, Barlow Condensed — plus the full Google Fonts picker. Loaded on demand via `loadGoogleFont()` *before* applying, then `invalidateCapHeight()`, so cap-height (and therefore pricing) is measured on real glyphs.

**Character:** Barlow is a grotesque drawn from California public signage — the one Google face whose lineage is actual sign lettering. The UI voice is bold and tight at headline sizes, relaxed and legible at body sizes.

### Hierarchy
- **Display** (extrabold 800, `text-4xl` → `sm:text-5xl`, `leading-[1.05]`, `tracking-tight`): welcome headline only ("See your name on your building.").
- **Headline** (extrabold 800, `text-2xl`–`text-3xl`, `tracking-tight`): step headings ("First, a photo of your storefront") and modal titles.
- **Title** (bold 700, `text-lg`–`text-xl`, `tracking-tight`): card headings ("Your sign", "Pick a look").
- **Body** (regular 400, `text-base`, `leading-7`, zinc-600): explanatory copy under headings.
- **Label** (medium/semibold, `text-sm`): buttons, form labels (labels of inputs are `font-semibold text-zinc-900`), inline hints in zinc-500.
- **Fine print** (`text-xs`, zinc-500): disclaimers ("No spam, no signup — just your proposal.").
- **Figures**: all dimensions and prices are `tabular-nums`; the price range is `text-[26px] font-extrabold tracking-tight`.

### Named Rules
**The Two-Faces Rule.** Barlow is the only UI face. Sign-lettering webfonts appear exclusively as sign faces on the canvas, in look-card previews, and in the font picker's preview lines — never in chrome.

**The Bold-Tight Rule.** Every heading is 700–800 weight with `tracking-tight`; hierarchy is carried by weight and size, never by color alone or by uppercase kickers (the system has none).

## Layout

Single-column centered pages with `px-6` gutters. The welcome screen is a centered `max-w-xl` column, vertically centered (`min-h-screen items-center justify-center`). Working screens: white header bar (`border-b border-zinc-200 bg-white px-6 py-3.5`) carrying the wordmark left and a chevron-separated step nav right (`sm:ml-auto`), then a `max-w-[1400px]` main (staff uses max-w-7xl). The design and measure steps are a two-column `flex flex-col gap-6 lg:flex-row`: canvas column `flex-1 min-w-0`, sidebar `lg:w-80` fixed. In customer mode the stage is centered in its column and grows with the viewport (height `clamp(420, innerHeight − 340, 700)`) — the building is the exhibit. Look cards ride a horizontal scroller (`flex gap-3 overflow-x-auto`), `w-48 shrink-0` each. Spacing rhythm is Tailwind's 4px scale; the recurring steps are 8 / 12 / 16 / 20 / 24px, with `gap-6` (24px) between major columns and `p-5` (20px) card interiors. Phones never scroll sideways: the stage rescales with its column via ResizeObserver.

## Elevation & Depth

Layered and lifted — depth comes from **soft two-part offset shadows** (a tight contact shadow plus a large, blurred, negative-spread drop), all cast in ink (`rgba(24,24,27,…)`) or, for blue elements, in the blue itself. Surfaces also carry a hairline ring (`ring-1 ring-zinc-200`) so cards read on the warm ground even where the shadow is faint. No hard/neobrutalist offsets, no borders-as-elevation.

### Shadow Vocabulary
- **Card resting** (`0 1px 2px rgba(24,24,27,0.05), 0 12px 32px -16px rgba(24,24,27,0.18)`): sidebar cards, the upload dropzone.
- **Stage** (`0 2px 6px rgba(24,24,27,0.08), 0 20px 48px -20px rgba(24,24,27,0.35)`): the dark canvas frame — the deepest neutral shadow on screen.
- **Popover** (`0 2px 8px rgba(24,24,27,0.08), 0 20px 48px -16px rgba(24,24,27,0.25)`): font-picker dropdown.
- **Modal** (`0 2px 8px rgba(24,24,27,0.08), 0 24px 64px -16px rgba(24,24,27,0.35)`): email dialog, sent confirmation, over a `bg-zinc-900/50 backdrop-blur-sm` scrim.
- **Blue glow** (`0 2px 6px rgba(37,99,235,0.35)`): primary CTAs; the price callout uses `0 2px 8px` of the same; the wordmark chip `0 2px 8px rgba(37,99,235,0.45)`.
- **Active look card** (`0 2px 6px rgba(37,99,235,0.15), 0 12px 28px -12px rgba(37,99,235,0.35)` + `ring-2 ring-blue-600`): selection = the shadow turns blue.

### Named Rules
**The Blue-Glow Rule.** Blue elements cast blue shadows; neutral elements cast ink shadows. Selection promotes a card's ink shadow to a blue one.

## Shapes

Rounded, friendly, and tiered by prominence: `rounded-lg` (8px) for dense toolbar controls, `rounded-xl` (12px) for CTAs, standalone inputs, and reference cards, `rounded-2xl` (16px) for cards, modals, and the canvas stage, `rounded-full` for icon wells (the 56px circular blue-50 wells holding a stroke icon). The wordmark mark is a lit sign-panel: a solid blue square at `rounded-[5px]` with a blue glow. Borders are 1px zinc-300 on controls, 2px dashed on the upload dropzone and "add reference" affordance. Nothing is fully square; nothing is a pill except radii-by-consequence of `rounded-full` on small elements.

## Components

### Buttons
- **Primary:** solid Showroom Blue, white `font-semibold` text, `rounded-xl px-6 py-2.5` (toolbar variant `px-4 py-2`), blue-glow shadow, `hover:bg-blue-500`, `transition-colors`, `disabled:opacity-40/50`. One per view region — it is the next step ("Show me my sign", "Continue to design", "Email my proposal", "Send my proposal").
- **Secondary:** white with `border-zinc-300`, `font-medium text-zinc-700`, `rounded-xl px-4 py-2.5`; hover darkens border to zinc-400 and text to zinc-900. Toolbar buttons are the same recipe at `rounded-lg px-3 py-2 text-sm`.
- **Icon buttons:** `rounded-lg border-zinc-300 bg-white p-2 text-zinc-600`, same hover.
- **Text buttons:** bare `font-medium text-blue-600 hover:text-blue-500`, or underlined zinc for back-links ("← Back to measurement").
- **Destructive:** identical to secondary but text-zinc-600 with `hover:bg-zinc-100` — see The No-Red Rule.
- **Focus (all buttons):** `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`.

### Inputs
- **Style:** white, `border-zinc-300`, `rounded-xl` standalone (`h-13 px-4 text-base` on the welcome input) or `rounded-lg px-3 py-2 text-sm` in toolbars; `placeholder:text-zinc-400`; numeric fields `text-right tabular-nums`.
- **Focus:** `focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20` (inputs get the border+ring treatment; buttons get the outline treatment).
- **Errors:** inline as `text-sm font-medium text-zinc-900` prose in context — never red, never a toast.
- **Checkboxes:** native with `accent-blue-600`; range sliders `accent-blue-600`.

### Cards / Containers
- **Corner style:** `rounded-2xl`; **background:** white; **elevation:** card-resting shadow + `ring-1 ring-zinc-200`; **padding:** `p-5` (sidebar), `p-6`–`p-8` (modals), `p-3.5` (dense reference cards at `rounded-xl` with `border` instead of ring).

### Look Cards (signature component)
`w-48 shrink-0 rounded-2xl bg-white p-2.5`: an h-20 `rounded-xl` dark-gradient mini-stage (`linear-gradient(180deg,#101014,#23232a)`) rendering the customer's own business name in the look's real webfont with CSS glow (`textShadow`), then name + check + one-line blurb. Resting `ring-1 ring-zinc-200` / hover zinc-300; active = blue ring-2 + blue shadow + blue stroke-check. Font size scales down with name length instead of ellipsizing — the customer's name is never truncated.

### Price Callout (signature component)
A solid blue `rounded-xl p-4` block inside the "Your sign" card: label in blue-100, `26px` extrabold tabular range, reassurance line in blue-100 ("Final pricing is confirmed with a real person…"). The only large solid-blue surface — the money moment owns the accent.

### Segmented Day/Night Toggle
`rounded-xl border-zinc-300 bg-white p-0.5` shell; each segment `rounded-lg px-3 py-1.5 font-medium` with a stroke sun/moon icon. Active Day = `bg-zinc-900 text-white` (ink = daylight chrome); active Night = `bg-blue-600 text-white`. A blue nudge line ("See it lit up at night →") points at it before first use.

### Navigation (step header)
Plain text steps separated by drawn chevrons: active `font-semibold text-blue-600`, reachable `font-medium text-zinc-700 hover:text-zinc-900`, locked `text-zinc-400`. No pills, no numbers on the customer surface (labels are stripped of their "1 · " prefixes).

### Icons
Hand-drawn single-path stroke SVGs (`fill="none" stroke="currentColor"`, stroke-width 1.5–2, round caps/joins, 16 or 24 viewBox), defined inline per component (`StrokeIcon`, `CameraIcon`, `Chevron`, `Check`, envelope). No icon library, no icon fonts, no emoji on customer surfaces.

### Canvas furniture (customer mode)
Transformer: blue border/anchors with white anchor fill; dimension badge: blue tag, white bold 12px text; zoom pill: `bg-zinc-900/90` floating bottom-left with light text (dark furniture is allowed *on* the stage). Auto-placed first sign wears the Classic Glow look (Oswald, `#f5f5f5` face, `#26221f` trim, front-lit white LEDs).

## Do's and Don'ts

### Do:
- **Do** scope every customer-facing style behind `.showroom` and the `customerMode`/`customerUX` props; the staff cockpit must render byte-identically after showroom work.
- **Do** use the two-material pattern for shared components: one markup tree, two class maps (`tb` in DesignStep.tsx, `styles(customer)` in FontPicker.tsx, ternary classNames elsewhere). Never fork the markup per surface.
- **Do** give every interactive element the blue focus treatment: `outline-blue-600` outlines on buttons, `border-blue-600` + `ring-blue-600/20` on inputs.
- **Do** load a sign font with `loadGoogleFont()` and call `invalidateCapHeight()` **before** measuring or applying it — cap-height drives pricing.
- **Do** use `.rise` with staggered `animationDelay` (0/80/160/240/320ms) for entrances — it is the showroom's only authored motion (0.7s `cubic-bezier(0.16,1,0.3,1)` from `translateY(14px)`, disabled under `prefers-reduced-motion`).
- **Do** end reassurance copy at moments of commitment ("A rough guess is fine — we confirm exact measurements before anything is built.").
- **Do** keep dimensions and money in `tabular-nums`.

### Don't:
- **Don't** use amber on customer surfaces — amber is the staff cockpit's accent and is out of scope for customer work.
- **Don't** use red anywhere on customer surfaces, including destructive actions and errors; the brand is black and blue only (owner-pinned).
- **Don't** introduce a second dark surface — the zinc-900 stage (and its miniature in look cards) is the only one.
- **Don't** set UI text in a sign-lettering font, or sign faces in Barlow.
- **Don't** show internal pricing machinery (cost breakdown, margins, add-on counts, config fields) to customers — `PricePanel` renders sizes and the investment range only; the internals block is absent, not hidden.
- **Don't** use icon libraries, icon fonts, or emoji on the showroom; draw the stroke path inline.
- **Don't** truncate the customer's business name — scale it down instead.

---

## Appendix: the staff cockpit (legacy internal surface, unchanged)

For reference only — extend it in kind, never import it into the showroom. Ground `bg-zinc-950`, panels `bg-zinc-900` with `border-zinc-700/600`, text zinc-100/300/400. Accent **amber-400** (`#fbbf24`): primary buttons (`text-zinc-950` on amber), active step pill, price total, canvas transformer/dimension badges, width marker; night toggle uses indigo-400; destructive actions are red (`text-red-400`, `border-red-500/50`); checkboxes `accent-amber-400`. Radii run one step tighter (`rounded-lg`/`rounded-xl`), shadows are stock (`shadow-2xl`), copy is terse and operator-oriented, and the staff home grid uses a 🪧 emoji placeholder. Fonts fall back to the root Arial/Helvetica body — the cockpit never adopted Barlow.
