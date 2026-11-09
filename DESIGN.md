---
name: Pascack Course Planner
description: Neutral charcoal course planner built around one Board. Figtree, soft filled blocks instead of lines, one school blue for things you can click, a color per subject, and the contd sticker button.
colors:
  background: "#161616"
  fill: "#202020"
  fill-2: "#2a2a2a"
  fill-3: "#333333"
  foreground: "#efefef"
  muted: "#a3a3a3"
  dim: "#6e6e6e"
  line-strong: "#3a3a3a"
  accent: "#2f6fe4"
  accent-hover: "#3d7bf0"
  accent-lip: "#1a4499"
  accent-foreground: "#ffffff"
  accent-ink: "#7aa5ff"
  success: "#33d6a6"
  warning: "#f1c40f"
  appeal: "#ff8c37"
  danger: "#ec3750"
subjects:
  english: ["#2b2536", "#c8b5ff"]
  math: ["#1b2f2c", "#79d7c2"]
  science: ["#232f1d", "#a9da86"]
  social: ["#33291b", "#f0c27a"]
  language: ["#33202a", "#f2a2c0"]
  pe: ["#33231b", "#ffab7a"]
  arts: ["#2f2134", "#e6a3ef"]
  life: ["#2d2b17", "#e2d36b"]
  finlit: ["#182a31", "#82d0ec"]
  elective: ["#262626", "#cfcfcf"]
typography:
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "52px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  section:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  small:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
rounded:
  tile: "10px"
  block: "14px"
  input: "10px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    shadow: "0 4px 0 {colors.accent-lip}"
    rounded: "{rounded.pill}"
    height: "38px"
  button-default:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "38px"
  input:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.input}"
    height: "38px"
---

# Design System: Pascack Course Planner

## 1. Overview

**North star: "The Board."** A student's whole high school plan fits on one screen: a row for each subject, a column for each grade, a colored tile for each class, and an outlined empty spot for each thing still needed to graduate. Everything else in the app is either a way to fill the Board (Classes) or a staff view of many Boards (Students).

The look is neutral charcoal, close to BetterCanvas dark mode, with the clarity of Vercel and Supabase. It is for the whole district, so it borrows one blue from the schools and nothing else: no logo, mascot or school-specific color.

The one expressive element is the primary button from `hackclub/contd`: a solid blue pill with a hard lip that lifts and tilts slightly on hover and squishes on press.

**Key characteristics:**
- Space and soft filled blocks separate things. No hairline separators between rows.
- Color always means something: blue means you can click it, subject colors mean what kind of class it is, green, yellow, orange and red mean status.
- One font, Figtree, for everything including numbers (tabular figures where numbers line up).
- Plain, short sentences that state the situation ("92.5 of 120 credits. 3 empty spots left to graduate.").

## 2. Colors

### Surfaces
- **Page** `#161616`. **Fill** `#202020` for soft blocks, inputs and sheets. **Fill 2** `#2a2a2a` for secondary buttons and hover. **Fill 3** `#333333` for hover on Fill 2.
- **Text** `#efefef`, **muted** `#a3a3a3`, **dim** `#6e6e6e` for placeholders.
- **Line strong** `#3a3a3a` is used only to outline an empty spot or a drawn control. Never as a row separator.

### Blue
- **Accent** `#2f6fe4`: primary buttons, focus, selection, progress. White label (about 4.6:1).
- **Accent ink** `#7aa5ff`: blue text and links on the dark page, where the button blue would be too dark to read.
- **The Blue Rule.** If it is blue, you can click it or it is selected. Blue is never a surface.

### Subjects
Each subject has a soft fill for its tiles and a brighter ink for its label (see frontmatter). They appear only on classes: Board tiles, class pages, the class list dot, and the landing page's example board. A class's subject is the Board row it sits in, worked out from its graduation requirement tags (`src/lib/board`).

### Status
Green done or eligible, yellow warning, orange needs a placement review, red locked or denied. Always a dot plus a word.

## 3. Typography

Figtree from `@fontsource/figtree`, self-hosted (`src/app/fonts.ts`). Weights 400, 500, 600, 700.

- **Display** 52px, 700: the landing headline only.
- **Title** 28px, 700: page titles.
- **Section** 15px, 600 (`.eyebrow`, kept as a class name): block headings.
- **Body** 15px; secondary 14px muted; small 13px.
- Tailwind's `text-sm` is pinned to 14px and `text-xs` to 12px so small text stays readable.

## 4. Elevation

Flat. Depth is one step of fill (page, Fill, Fill 2). The only shadows are the primary button's hard lip and the soft shadow under the name menu and the dragged tile. No gradients, glows, blur or glass.

## 5. Components

### Board (`src/components/board`)
- Grid: `150px` row headers plus four grade columns. Row header: subject name in its ink, then "Done", "N more" or "Any class".
- **Tile** (`.tile` plus `.subject-<key>`): class name, credits and status in the subject ink, and a dot plus words for one problem ("Needs its partner class", "Check details", "Not offered in 11th").
- **Empty spot** (`.tile-empty`): an outline that says what goes there ("+ Pick a physics class"). Hover turns the outline blue. Clicking opens the add panel filtered to that requirement.
- **Class sheet**: a side sheet (bottom sheet on phones) with move-to-grade buttons, status, grade, credits, the eligibility details, placement review, and remove.
- Phones: a 9th / 10th / 11th / 12th / All switcher. "All" shows the board as small colored blocks.

### Buttons
Primary: blue pill, 38px, `0 4px 0` lip, hover lifts 2px and tilts -1deg, press sinks 3px. One per screen. Secondary: Fill 2 pill, no lip. Ghost: text only. Danger: red text. Reduced motion removes movement and keeps color changes.

### Lists and rows
`.list` rows are separated by 2px of space. `.list-hover` rows fill softly on hover. A selected row is Fill 2 plus a small blue dot.

### Tabs
Pill tabs everywhere (nav, Admin, Students, Classes, pathways): the active tab is a Fill 2 pill with semibold text.

### Inputs
38px, 10px radius, Fill background, no border. Focus: blue border and a 3px blue ring. Checkboxes and radios are drawn and fill blue when on.

### Navigation
A solid top bar: wordmark, then the role's places (students: Board, Classes; staff add Students and Admin), then a menu under the user's name (Import transcript, Settings, Help, Sign out). Phones get the same places in a bottom bar. `src/lib/nav.ts` is the single list.

### Empty state
An outlined block like an empty spot, one sentence, one action.

## 6. Do's and Don'ts

### Do
- **Do** separate with space or a soft fill before anything else.
- **Do** answer the student's question in the first line ("You can take this in 11th or 12th grade.").
- **Do** label every status in words.
- **Do** keep one primary button per screen.

### Don't
- **Don't** draw hairlines between rows, or use colored side stripes.
- **Don't** use gradients, glows, glass, gradient text, tinted pill badges or big-number stat boxes.
- **Don't** use a mono font.
- **Don't** put warm, navy or blue tints into surfaces.
- **Don't** use subject colors for anything that is not a class.
- **Don't** use em dashes in copy.
