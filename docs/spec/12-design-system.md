# 12 Design system and other features

The tokens and button classes are already implemented in `src/app/globals.css`, with the components in `src/components/ui/`. `/styleguide` shows them. This file is the rulebook.

## Rules

Dark only. Vercel-like and sleek: calm, high contrast, lots of whitespace, hairline borders, tight type. The buttons are the one expressive element and come from the owner's contd project.

**Hard rule: backgrounds and surfaces are pure neutral black or charcoal (equal R, G, B). No navy, no blue-tinted grays, no blue gradients or glows on surfaces.** Blue appears only on interactive elements (primary buttons, focus ring, links, active nav marker, progress bars, the "in review" status).

Tokens: `--bg #0a0a0a`, `--bg-raised #141414`, `--bg-elevated #1c1c1c`, `--line #2b2b2b`, `--line-strong #3d3d3d`, `--fg #ededed`, `--muted #a1a1a1`, `--accent #338eda` (Hack Club blue), `--accent-hover #4a9fe6`, `--accent-lip #1f5b94`, `--accent-fg #0a0a0a`, `--green #33d6a6`, `--yellow #f1c40f`, `--orange #ff8c37`, `--red #ec3750`, `--radius-card 12px`, `--radius-pill 999px`, `--spring cubic-bezier(0.3, 1.6, 0.6, 1)`.

White text on `#338eda` is only about 3.5:1 and fails AA for normal text, so primary buttons use the dark label. Selected rows and cards use a neutral fill (`--bg-elevated`) plus a 2px accent left bar or ring, never a blue fill.

**Type:** Geist Sans 14px base, Geist Mono for course codes, credits, grades, and dates. Spacing on a 4px scale. Cards 12px radius, 1px `--line` border, no heavy shadows. App shell: left sidebar 232px (collapsible on mobile), top bar with breadcrumbs, content max width 1200px.

**Buttons:** pill shaped, a hard no-blur bottom "lip", spring press. **No tilt or rotation.** Variants: default, primary, ghost, danger. Respect `prefers-reduced-motion`. Focus ring is a 2px bg gap plus a 2px accent ring.

Wrap the single most important call to action on a screen (for example "Submit appeal") in `StarBorder`, a travelling glint limited to the button edge. Use it sparingly.

**Sign-in and onboarding screens only:** a faint checkerboard texture on inputs and buttons (`.auth-texture`), with a frosted look over a neutral background.

**Status colors** (same everywhere): eligible = green, eligible with warning = yellow, needs appeal = orange, locked = red, appeal in review = accent blue, appeal approved = green, appeal denied = red. Red is never used for a primary action, so it always means blocked or destructive.

## Other features

- **Timeline:** dashboard widget with countdowns to course selection, appeal windows, and decision dates from `TimelineEvent` (per audience).
- **Print and PDF export:** a print stylesheet at `/plan/[id]/print` with a **white background and black text** (an intentional exception to the dark theme, to save ink). Use "Save as PDF" through the browser first. Include plan name, grade columns, credits, requirement summary, and a "self-reported, unofficial" footer.
- **Help page** replaying the onboarding explainers.
