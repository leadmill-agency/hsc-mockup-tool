// Google Fonts, loaded on demand. A curated popular list rather than the full
// catalog — searchable, sign-leaning, and small enough to ship inline.

export const GOOGLE_FONTS: string[] = [
  // popular sans
  "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", "Inter", "Raleway",
  "Nunito", "Rubik", "Work Sans", "DM Sans", "Manrope", "Karla", "Cabin",
  "Barlow", "Heebo", "Ubuntu", "PT Sans", "Noto Sans", "Source Sans 3",
  "Josefin Sans", "Quicksand", "Comfortaa", "Varela Round", "Dosis", "Kanit",
  "Catamaran", "Chivo", "Jost", "Outfit", "Sora", "Space Grotesk", "Lexend",
  "Figtree", "Plus Jakarta Sans", "League Spartan", "Exo 2", "Mulish",
  // display / impact (sign favorites)
  "Oswald", "Anton", "Bebas Neue", "Archivo Black", "Alfa Slab One",
  "Righteous", "Bangers", "Titan One", "Luckiest Guy", "Passion One",
  "Russo One", "Black Ops One", "Bungee", "Bungee Shade", "Monoton", "Ultra",
  "Rye", "Graduate", "Staatliches", "Teko", "Fjalla One", "Squada One",
  "Days One", "Six Caps", "Pathway Gothic One", "Changa One", "Racing Sans One",
  "Bowlby One SC", "Sigmar One", "Shrikhand", "Secular One", "Chewy",
  "Fredoka", "Baloo 2", "Abril Fatface", "Special Elite", "Faster One",
  "Audiowide", "Orbitron", "Unbounded", "Syne",
  // condensed
  "Barlow Condensed", "Archivo Narrow", "PT Sans Narrow", "Yanone Kaffeesatz",
  // serif
  "Playfair Display", "Merriweather", "Lora", "Cinzel", "EB Garamond",
  "Cormorant Garamond", "Libre Baskerville", "Crimson Text", "Bitter",
  "Roboto Slab", "Arvo", "Zilla Slab", "Domine", "Cardo", "Prata",
  "DM Serif Display", "Spectral", "Alegreya", "Vollkorn",
  // script / handwritten
  "Lobster", "Lobster Two", "Pacifico", "Dancing Script", "Great Vibes",
  "Satisfy", "Caveat", "Courgette", "Kaushan Script", "Permanent Marker",
  "Amatic SC", "Sacramento", "Yellowtail", "Allura", "Alex Brush",
  "Tangerine", "Parisienne", "Mr Dafoe", "Norican", "Grand Hotel",
  "Berkshire Swash", "Shadows Into Light", "Indie Flower", "Patrick Hand",
  "Architects Daughter", "Gloria Hallelujah", "Rock Salt", "Sriracha",
];

/** CSS font-family string stored on elements for a Google font. */
export function googleFamily(name: string): string {
  return `'${name}', sans-serif`;
}

const loading = new Map<string, Promise<void>>();

/** Inject the stylesheet for one Google font and wait until it is usable. */
export function loadGoogleFont(name: string): Promise<void> {
  const existing = loading.get(name);
  if (existing) return existing;
  const p = (async () => {
    const id = `gf-${name.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
        name
      ).replace(/%20/g, "+")}:wght@400;700&display=swap`;
      document.head.appendChild(link);
      await new Promise<void>((res) => {
        link.onload = () => res();
        link.onerror = () => res();
        setTimeout(res, 4000);
      });
    }
    try {
      await Promise.all([
        document.fonts.load(`700 32px '${name}'`),
        document.fonts.load(`400 32px '${name}'`),
      ]);
    } catch {
      // fall back silently; the browser will substitute
    }
  })();
  loading.set(name, p);
  return p;
}
