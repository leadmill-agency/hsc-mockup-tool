// Customer-mode "Pick a look" presets (PRD non-designer UX): each card bundles
// font + lighting + colors so customers react to finished styles instead of
// decoding sign-industry controls. Looks carry real sign-lettering webfonts
// (loaded via loadGoogleFont before applying, so cap-height pricing measures
// the actual glyphs); system stacks remain only as fallbacks.

import type { CSSProperties } from "react";
import {
  fontSizeForLetterHeight,
  TextElement,
  textLetterHeightInches,
} from "@/lib/types";

export interface SignLook {
  id: string;
  name: string;
  blurb: string;
  /** Google font to load before this look applies (and for card previews). */
  googleName?: string;
  /** Style fields applied to a text element (fontSize handled separately). */
  patch: Pick<
    TextElement,
    "fontFamily" | "fill" | "trimColor" | "lighting" | "ledColor" | "signStyle"
  > &
    Partial<Pick<TextElement, "backerColor">>;
  /** Card preview: rendered with CSS, no canvas needed. */
  preview: {
    text: CSSProperties;
    /** Cabinet looks draw a face plate behind the text. */
    plate?: CSSProperties;
  };
}

/** The customer default: what the auto-placed first sign wears. */
export const DEFAULT_LOOK_FONT = "'Oswald', 'Arial Narrow', sans-serif";
export const DEFAULT_LOOK_GOOGLE = "Oswald";

export const SIGN_LOOKS: SignLook[] = [
  {
    id: "classic",
    name: "Classic Glow",
    blurb: "White letters that light up at night",
    googleName: "Oswald",
    patch: {
      fontFamily: DEFAULT_LOOK_FONT,
      fill: "#f5f5f5",
      trimColor: "#26221f",
      lighting: "front",
      ledColor: "#ffffff",
      signStyle: "letters",
    },
    preview: {
      text: {
        fontFamily: DEFAULT_LOOK_FONT,
        color: "#fafafa",
        textShadow: "0 0 10px rgba(255,255,255,0.9), 0 0 22px rgba(255,255,255,0.45)",
      },
    },
  },
  {
    id: "halo",
    name: "Night Halo",
    blurb: "Dark letters with a soft glow behind them",
    patch: {
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fill: "#1c1c1e",
      trimColor: "#111113",
      lighting: "halo",
      ledColor: "#fff3d6",
      signStyle: "letters",
    },
    preview: {
      text: {
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        color: "#26262a",
        textShadow:
          "0 0 14px rgba(255,243,214,0.95), 0 0 30px rgba(255,243,214,0.6)",
      },
    },
  },
  {
    id: "blue",
    name: "Bold Blue",
    blurb: "Blue letters with a bright blue glow",
    googleName: "Archivo",
    patch: {
      fontFamily: "'Archivo', Arial, sans-serif",
      fill: "#2563eb",
      trimColor: "#1e3a8a",
      lighting: "front",
      ledColor: "#60a5fa",
      signStyle: "letters",
    },
    preview: {
      text: {
        fontFamily: "'Archivo', Arial, sans-serif",
        color: "#3b82f6",
        textShadow: "0 0 10px rgba(96,165,250,0.95), 0 0 24px rgba(59,130,246,0.55)",
      },
    },
  },
  {
    id: "script",
    name: "Signature",
    blurb: "Handwritten style with a warm halo",
    googleName: "Dancing Script",
    patch: {
      fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
      fill: "#f5f5f5",
      trimColor: "#26221f",
      lighting: "halo",
      ledColor: "#fff3d6",
      signStyle: "letters",
    },
    preview: {
      text: {
        fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
        color: "#fafafa",
        textShadow:
          "0 0 12px rgba(255,243,214,0.9), 0 0 26px rgba(255,243,214,0.5)",
      },
    },
  },
  {
    id: "box",
    name: "Lightbox",
    blurb: "A lit white box sign — clean and simple",
    googleName: "Barlow Condensed",
    patch: {
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      fill: "#1c1917",
      lighting: "front",
      ledColor: "#ffffff",
      signStyle: "cabinet",
      backerColor: "#f7f5f0",
    },
    preview: {
      text: {
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
        color: "#1c1917",
      },
      plate: {
        background: "#f7f5f0",
        borderRadius: 4,
        boxShadow: "0 0 14px rgba(255,255,255,0.55)",
      },
    },
  },
];

/** The patch that restyles `el` into `look` while keeping its physical
 *  letter height (and therefore its price) unchanged. Call after the look's
 *  webfont has loaded (and its cap-height cache invalidated). */
export function lookPatch(
  el: TextElement,
  look: SignLook,
  ipp: number
): Partial<TextElement> {
  const inches = textLetterHeightInches(el, ipp);
  return {
    ...look.patch,
    fontSize: fontSizeForLetterHeight(inches, ipp, look.patch.fontFamily),
  };
}
