# Phase 4: eligibility and pathways

**Goal**: pure rule engine, seeded rules and edges for math, science, CS, English, world language, eligibility badges, pathway graph, rule and edge admin UI.

**Read first**: `spec/06-eligibility-pathways.md`, `spec/04-catalog.md`. Re-read the PDF prerequisite text for each course you encode.

## Tasks

1. Test first, `src/lib/eligibility/`: types for the rule tree, `evaluate(rules, context)` returning `ELIGIBLE`, `ELIGIBLE_WITH_WARNING`, `NOT_ELIGIBLE_APPEALABLE`, `NOT_ELIGIBLE_LOCKED` plus a per-leaf breakdown. Leaves: `completed`, `minGrade` (initialAverage approximated by final grade, labeled), `gradeLevel`, `coreq`, `priorCoursework`, `manual` (visible, never pass or fail). `appealable` and `note` per leaf. Approved appeal on the plan entry yields "Approved via appeal".
2. Grade comparison helper over the `LetterGrade` enum, unit tested at every boundary.
3. Tests from real PDF examples across math, science, CS, English, world language. Include the Honors Algebra II with Trigonometry example (second branch carries a `manual` placement exam leaf, flagged for supervisor confirmation) and the AP Micro/Macro and AP Gov/Syracuse coreq pairs.
4. `prisma/seed/rules.json` and `edges.json`: encode only what traces to the PDF. Everything else stays `prereqText` plus a `manual` leaf. Edges from the math, CS, and science typical path diagrams: `STANDARD` versus `ADVANCE`. Skipping a step is locked, moving up a level is appealable. Two math starting points (Algebra I or Pre-Algebra in 8th grade).
5. Wire eligibility into the add-course dialog, course page, and plan warnings (unmet prereqs, missing coreqs) as badges using the status colors.
6. `/pathways`: React Flow plus dagre. Completed, open next, appealable (dashed), locked. Node click shows requirements and "Request placement review" where applicable (button is a stub until Phase 7).
7. Admin rule builder UI (not raw JSON) and edge editor, for ADMIN and SUPERVISOR scoped to their departments. Audited.

## Verify

`npm test`. Manual: owner tries real course choices.

## Checkpoint

Owner tests real course choices and the pathway graph.

## Done when

- [ ] Every encoded rule cites a PDF page in its `note` or seed comment.
- [ ] Engine has no framework imports and is used by both client and server.
- [ ] Supervisors cannot edit rules outside their departments (tested).
