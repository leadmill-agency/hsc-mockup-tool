import type { Metadata } from "next";
import { Barlow, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Customer-surface voice: Barlow is a grotesque drawn from California public
// signage — the one Google face whose actual lineage is sign lettering.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Design Your Sign — Houston Sign Crafters",
  description:
    "Put a finished storefront sign on a photo of your building — day and night — with a realistic budget range, in about 5 minutes.",
};

const DIRECTION_CONTRACT = `<!--
THESIS: A sign shop's showroom in daylight — the customer's building is the exhibit; refuses the dark-panel configurator default.
OWN-WORLD: Warm-white ground, ink #18181b, one blue #2563eb; Barlow (CA signage grotesque) display; white cards with soft offset shadows; the photo canvas is a dark framed stage where lit signs pop.
STORY: A shop owner sees their name on their building in minutes, believes a real sign shop made this, and emails themselves the proposal / books the call.
FIRST VIEWPORT: Centered welcome card on warm white: wordmark, display headline, one input (business name), one blue CTA.
FORM: Bright showroom — user-pinned direction (Refero refs: Fiverr logo maker grid, Pitch onboarding), no seed roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  );
}
