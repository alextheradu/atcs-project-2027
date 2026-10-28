# Phase 3: planner and graduation tracker

**Goal**: multi-plan four-year planner with drag and drop, correct credit math, requirement meters, and warnings.

**Read first**: `spec/05-planner-graduation.md`, `spec/12-design-system.md`.

## Tasks

1. Test first, `src/lib/credits/`: decimal-safe credit math (integer tenths). Half plus half equals one full slot. Sum by year, by requirement kind, completed versus planned.
2. Test first, `src/lib/requirements/`: given entries, course requirement tags, and `RequirementRule` thresholds, return per-kind `{required, completed, planned, missing}`, total credits, per-year minimums, and a "what's missing" list. Cover: American Studies counts toward two kinds, provisional tags still count but are flagged, half-year FIN_LIT 2.5, physics via engineering courses, thresholds editable.
3. Test first, `src/lib/plan-warnings/`: under 30 credits a year, under 25 in senior year, too many full-year courses (default 8, configurable), duplicate course in plan rejected (data layer), unmet prereq and missing coreq hooks (wired in Phase 4).
4. Server actions in `src/lib/plans/`: create, rename, clone, delete, set primary (single transaction, respects the partial unique index), add entry, move entry between grades, remove entry, change status and grade. Ownership checks on every action. Submitted plans are read-only. Rate limit plan creation.
5. UI `/plans` list and `/plans/[id]`: four grade columns, course cards, add-course dialog with search and filters, `@dnd-kit` drag between columns with keyboard support, right rail with requirement meters and warnings. Optimistic updates with server reconciliation.
6. Admin edit of requirement thresholds in `/admin/settings`.
7. Authorization tests: another user's plan returns not found, submitted plan rejects edits, counselor read-only.

## Verify

`npm test`. Manual end to end: build a plan from scratch, totals match the PDF graduation rules (120 credits, subject minimums).

## Checkpoint

Owner builds a plan and checks totals.

## Done when

- [ ] Credit and requirement logic has full unit tests.
- [ ] Drag and drop works by mouse and keyboard.
- [ ] Clone, primary switch, delete verified.
