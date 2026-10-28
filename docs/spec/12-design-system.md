# 12 Design system and other features

The tokens and button classes are already implemented in `src/app/globals.css`, with the components in `src/components/ui/`. `/styleguide` shows them. This file is the rulebook.

## Rules

Dark only. Vercel-like and sleek: calm, high contrast, lots of whitespace, hairline borders, tight type. The buttons are the one expressive element and come from the owner's contd project.

**Hard rule: backgrounds and surfaces are pure neutral black or charcoal (equal R, G, B). No navy, no blue-tinted grays, no blue gradients or glows on surfaces.** Blue appears only on interactive elements (primary buttons, focus ring, links, active nav marker, progress bars, the "in review" status).

Tokens: `--bg #0a0a0a`, `--bg-raised #141414`, `--bg-elevated #1c1c1c`, `--line #2b2b2b`, `--line-strong #3d3d3d`, `--fg #ededed`, `--muted #a1a1a1`, `--accent #338eda` (Hack Club blue), `--accent-hover #4a9fe6`, `--accent-lip #1f5b94`, `--accent-fg #0a0a0a`, `--green #33d6a6`, `--yellow #f1c40f`, `--orange #ff8c37`, `--red #ec3750`, `--radius-pill 999px`, `--spring cubic-bezier(0.3, 1.6, 0.6, 1)`.

White text on `#338eda` is only about 3.5:1 and fails AA for normal text, so primary buttons use the dark label. Selected rows use a neutral fill (`--bg-elevated`) plus a 2px accent left bar or ring, never a blue fill.

**Type:** Geist Sans 14px base, Geist Mono for course codes, credits, grades, and dates. Spacing on a 4px scale. No cards, no heavy shadows. App shell: left sidebar 232px (collapsible on mobile), 48px top bar with breadcrumbs, content max width 1100px.

**Layout language (no cards).** Do not wrap content in bordered, rounded boxes. Separate things with 1px hairlines and whitespace instead:
- Page = `PageHeader` (26px title, muted one-line description, actions on the right) then `Section` blocks, each with a top hairline and a 14px medium title (`src/components/ui/page.tsx`).
- Collections are rows, not tiles: the `.list` class (top rule, a rule under each row) and `.list-hover` for clickable rows. A selected row uses `.row-selected` (neutral fill plus a 2px accent bar).
- Facts about one thing go in `Dl` (label left, value right, hairlines between).
- Forms are plain fields on the page, grouped by `Section`. No panel behind them.
- Status is `Badge`: a 6px colored dot plus a plain label in a 6px-radius outline. Not tinted pills.
- Inputs are 34px, 6px radius, transparent over the page background. Buttons keep their pill shape and lip.
- Numbers (credits, grades, dates, emails in lists) use `.num` (Geist Mono, tabular).
- Headings: tight tracking, `text-wrap: balance`. Body 14px, secondary text 13px muted. One column of text maxes out around 65 characters.
- Pages fade and rise 6px on entry (`.page-enter`, respects reduced motion).
- The sign-in page has a faint hairline grid backdrop (`.grid-backdrop`, neutral white at 4%) and the checkerboard on its controls only.

**Buttons:** pill shaped, a hard no-blur bottom "lip", spring press. **No tilt or rotation.** Variants: default, primary, ghost, danger. Respect `prefers-reduced-motion`. Focus ring is a 2px bg gap plus a 2px accent ring.

Wrap the single most important call to action on a screen (for example "Submit appeal") in `StarBorder`, a travelling glint limited to the button edge. Use it sparingly.

**Sign-in and onboarding screens only:** a faint checkerboard texture on inputs and buttons (`.auth-texture`), with a frosted look over a neutral background.

**Status colors** (same everywhere): eligible = green, eligible with warning = yellow, needs appeal = orange, locked = red, appeal in review = accent blue, appeal approved = green, appeal denied = red. Red is never used for a primary action, so it always means blocked or destructive.

## Other features

- **Timeline:** dashboard widget with countdowns to course selection, appeal windows, and decision dates from `TimelineEvent` (per audience).
- **Print and PDF export:** a print stylesheet at `/plan/[id]/print` with a **white background and black text** (an intentional exception to the dark theme, to save ink). Use "Save as PDF" through the browser first. Include plan name, grade columns, credits, requirement summary, and a "self-reported, unofficial" footer.
- **Help page** replaying the onboarding explainers.
