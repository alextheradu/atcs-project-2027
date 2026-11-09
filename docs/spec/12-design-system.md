# 12 Design system and other features

Tokens and shared classes live in `src/app/globals.css`, components in `src/components/ui/` and `src/components/board/`. `/styleguide` shows them. `DESIGN.md` (repo root) is the full description; this file is the rulebook.

## Rules

Dark only. Neutral charcoal like BetterCanvas dark mode, with the clean layout of Vercel and Supabase. Built around one Board.

**Surfaces are neutral.** `--bg #161616`, `--fill #202020`, `--fill-2 #2a2a2a`, `--fill-3 #333333`. No warm lean, no navy or blue tint, no gradients, glows, blur or glass.

**Blue means clickable.** `--accent #2f6fe4` (stands in for Pascack Hills blue; swap the exact hex when known and recheck the white label) on primary buttons, focus, selection and progress. `--accent-ink #7aa5ff` for blue text on the page. Blue is never a surface.

**Subject colors only mark classes.** Each Board row has a fill and an ink (`--subject-<key>` and `--subject-<key>-ink`, keys `english math science social language pe arts life finlit elective`). Use them through `.subject-<key>` with `.tile` or `.ink`.

**Status colors** (same everywhere): eligible or done = green, warning = yellow, needs a placement review = orange, locked or denied = red, in review = blue. Always a dot plus a word.

**Type:** Figtree for everything, self-hosted from `@fontsource/figtree`. No mono font. Numbers use `.num` (tabular figures). Page titles 28px bold, section headings `.eyebrow` (15px semibold), body 15px, secondary 14px muted.

**Layout language: space and soft fills, not lines.**
- No hairline separators between rows or sections. Separate with space; group with `.soft` (a Fill block, 14px radius) when space is not enough. No nested boxes.
- Collections are `.list` rows separated by space; `.list-hover` fills a row softly on hover; `.row-selected` is Fill 2 plus a blue dot.
- An outline (`.tile-empty`, `EmptyState`) means "empty, fill me in".
- Tabs are pills: the active one is a Fill 2 pill with semibold text.
- Exceptions: thin guide lines in tree views (rule builder, eligibility breakdown) and the printed Board.

**Buttons:** the primary button is the contd sticker: blue pill, hard `0 4px 0` lip, lifts 2px and tilts -1deg on hover, sinks 3px on press. One per screen. Secondary is a Fill 2 pill with no lip. Reduced motion keeps color changes and drops movement.

**Navigation:** students see Board and Classes; counselors and supervisors see Classes, Students and Admin (only the tabs their role may open); admins see all four. A menu under the user's name holds Import transcript, Settings, Help and Sign out. Phones use a bottom bar. `src/lib/nav.ts` is the one list, and every page still checks the role on the server.

## The Board

- One plan per student in the UI: the primary plan, otherwise the most recently changed one (`boardPlanId`). Multi-plan support stays in the database.
- Rows come from requirement tags (`src/lib/board`): a class sits in the row of its biggest tag; no tags means Electives.
- Empty spots come only from the graduation summary: missing credits split into one-class spots (5, or 2.5 for Financial Literacy), placed in the earliest open grade from the student's current grade on, extras in 12th. The credit total and per-year minimums never make spots; they show in the status sentence and the grade headers.

## Other features

- **Dates:** the next date within 30 days shows as a note on the Board, from `TimelineEvent` (per audience).
- **Print and PDF export:** `/plans/[id]/print` prints the Board grid with a **white background and black text** (an intentional exception to the dark theme, to save ink), the status sentence, and a "self-reported, unofficial" footer.
- **Help page:** how the Board and Classes work, then the onboarding explainers.
