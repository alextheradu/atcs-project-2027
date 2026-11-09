import localFont from "next/font/local";

// Figtree from @fontsource, so builds stay offline and the CSP can keep font-src 'self' (see docs/DECISIONS.md).
// next/font reads these arguments at compile time, so the paths must be literal.

export const figtree = localFont({
  src: [
    { path: "../../node_modules/@fontsource/figtree/files/figtree-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/figtree/files/figtree-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/figtree/files/figtree-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/figtree/files/figtree-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-figtree",
  display: "swap",
});

export const fontVariables = figtree.variable;
