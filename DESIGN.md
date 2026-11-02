---
name: Pascack Course Planner
description: Calm, flat, dark course planner. Warm off-black surfaces, hairline rules, one blue accent on things you can act on, expressive pill buttons.
colors:
  background: "#12110f"
  surface: "#1b1a17"
  surface-elevated: "#24221e"
  hairline: "#2e2b27"
  hairline-strong: "#423e38"
  hairline-hover: "#5c574f"
  foreground: "#ece8e1"
  muted: "#a39d93"
  placeholder: "#6f6a62"
  accent: "#338eda"
  accent-hover: "#4a9fe6"
  accent-lip: "#1f5b94"
  accent-foreground: "#12110f"
  success: "#33d6a6"
  warning: "#f1c40f"
  appeal: "#ff8c37"
  danger: "#ec3750"
typography:
  display:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  data:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
rounded:
  control: "6px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.pill}"
    height: "36px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "36px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "34px"
---

# Design System: Pascack Course Planner

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

A well kept ledger: ruled lines, tight columns, numbers you can add up at a glance. Nothing sits in a box that does not need one. Structure comes from hairlines and spacing; the only loud thing on screen is the pill button with its hard lip, which is the system's one expressive gesture.

Dark only, warm off-black and charcoal, like a ruled sheet under a lamp in the evening. Blue appears only where something can be acted on or is selected. The system explicitly rejects generic AI dashboards: bordered rounded cards everywhere, tinted pill badges, gradients, glass, side stripes.

Influences: the Vercel dashboard (flat, mono for data), Linear (dense, restrained), Raycast and Arc (detail polish), and two sibling projects, `pioneersTeam1676/command` (solid bars, mono-for-numbers, dashed empty states) and `hackclub/contd` (the buttons, drawn form controls, gentler reduced motion). Contd's tilt and rotation are deliberately not used.

**Key Characteristics:**
- Hairline rules and whitespace instead of containers.
- Rows for collections, definition lists for facts, plain fields for forms.
- Mono for anything compared or added up (credits, grades, dates).
- Motion states what changed: 150 to 250ms, ease-out, never on keyboard driven or repeated actions.

## 2. Colors

Restrained: warm grays plus one accent.

### Primary
- **Interactive Blue** (#338eda): primary buttons, focus rings, row selection dots, links, progress. Never a surface fill.

### Neutral
- **Lamp Black** (#12110f): page background. **Raised** (#1b1a17), **Elevated** (#24221e): hover and selected fills.
- **Hairline** (#2e2b27) for every rule, **Hairline Strong** (#423e38) on hover, **Hairline Hover** (#5c574f) for drawn controls.
- **Ink** (#ece8e1) text, **Quiet Ink** (#a39d93) secondary text, **Placeholder** (#6f6a62).

### Semantic
- Green eligible or approved, yellow warning, orange needs appeal, red locked or denied, blue in review. Always a dot plus a word.

### Named Rules
**The Interactive Blue Rule.** If it is blue, you can click it or it is selected. Blue never decorates.
**The Label Rule.** Color is never the only carrier of meaning.

## 3. Typography

**Family:** IBM Plex Sans for everything, IBM Plex Mono for data and section headers. Self-hosted from `@fontsource` (offline builds).

### Hierarchy
- **Display** (600, 40 to 48px, -0.02em): sign-in headline only, one color.
- **Title** (600, 32px, -0.02em): page titles.
- **Section** (`.eyebrow`: Plex Mono 500, 11px, capitals, 0.08em tracking, Quiet Ink): block titles, read like ledger column headers.
- **Body** (400, 14px, 1.5): default. Prose caps at 65ch.
- **Label and caption** (500 or 400, 13px, Quiet Ink for secondary).
- **Data** (Plex Mono, 12px, tabular figures).

### Named Rules
**The Mono-For-Numbers Rule.** Anything a user compares or adds up is monospace.

## 4. Elevation

Flat. Depth is a hairline, a one-step background change (raised, elevated), and the buttons' hard 3px lip. No blur shadows. Sticky bars are opaque.

### Named Rules
**The Solid Bar Rule.** No translucent or blurred sticky bars; content must not bleed under them.

## 5. Components

### Buttons
Pill, 36px, hard no-blur lip (`0 3px 0`), spring lift on hover (-2px), sink on press. Variants: default, primary (blue, dark label), ghost, danger. One primary per screen; the single most important action may sit in a travelling-glint `StarBorder`. No rotation.

### Lists and rows
`.list`: top rule and a rule under each row. Hover fills Raised. Selected: Raised fill plus a 6px blue dot at the start.

### Inputs
34px, 6px radius, hairline, transparent over the page. Focus: blue border and a 3px 20% ring. Checkboxes, radios and selects are drawn, not browser chrome. On touch: 44px and 16px text.

### Status badge
6px dot plus label, 6px radius outline.

### Navigation
232px sidebar with grouped ledger-header labels (Workspace, Admin). Active item is semibold Ink, no dot and no fill. A mono count marks work waiting. On phones: opaque bottom tab bar plus a More drawer.

### Sign-in
Wordmark, one-color headline, the sign-in form, and a made-up example plan beside it. No grid backdrop, glow, pill nav or staged reveal.

### Empty state
Dashed outline, one line of purpose, one action.

## 6. Do's and Don'ts

### Do:
- **Do** separate with rules and space before reaching for a box.
- **Do** keep one primary action per screen.
- **Do** label every status in words.
- **Do** use skeletons for loading and teach the interface in empty states.

### Don't:
- **Don't** use cards, nested containers, tinted pills, gradient text or glass.
- **Don't** use colored side stripes; row selection is a dot, nav selection is weight.
- **Don't** bring back the default AI dark look: Geist on pure black, two-tone headlines, grid backdrops, radial glows, floating pill nav.
- **Don't** put blue or navy into surfaces. The only tint is the warm lean of the neutrals.
- **Don't** animate repeated or keyboard driven actions, or use em dashes in copy.
