# Phase 2: catalog

**Goal**: seeded, hand-reviewed catalog of about 150 courses with requirement tags, interest tags, aliases, plus browse and counselor CRUD.

**Read first**: `spec/04-catalog.md`, `spec/08-review-dashboards.md` (catalog admin), `spec/05-planner-graduation.md` (requirement table).

**Inputs needed**: `docs/source/ProgramofStudies2026-2027_1.pdf`. Stop and ask if missing.

## Tasks

1. Read the PDF in page ranges of at most 20. Write the table of contents mapping (printed page vs PDF index) into `docs/source/notes.md` (gitignored).
2. `scripts/extract-catalog.ts`: one-off extraction to `prisma/seed/courses.draft.json`. Capture name, department, level, duration, credits, grades, description, verbatim `prereqText`, `sourcePage`.
3. Hand-review into `prisma/seed/courses.json`. Apply every pitfall in `spec/04-catalog.md`: half-year labels, 10 and 15 credit specials, default 5 credits, honors variants, per-grade PE rows, middle school pseudo-courses (`plannable: false`), physics-satisfying engineering courses, American Studies dual tag (unverified), AP Art History excluded from arts, dual enrollment as notes.
4. Seed files: `requirements.json` (`RequirementRule` table from the spec), `course-requirements.json` (provisional arts and life-careers tags by department with `provisional: true`), `interest-tags.json` (the eleven interests), `aliases.json` (transcript title variants). `prisma/seed.ts` loads all, idempotent.
5. Catalog browse `/courses` with search and filters (department, level, credits, duration, grade, interests) and `/courses/[slug]`.
6. Counselor and admin CRUD at `/admin/catalog`: add, edit, archive, requirement tags (provisional shown as "needs counselor review"), interest tags, aliases. Hard delete blocked when any `PlanEntry` references the course. All changes audited with before and after. CSV import and export.
7. Tests: seed integrity (unique slugs, every rule slug resolves later, half-year credits are 2.5, no plannable course missing a department), CSV round trip, hard-delete guard, authorization on every action (COUNSELOR and ADMIN only).

## Verify

`npm run db:seed` twice (idempotent). `npm test`. Spot check 15 random courses against the PDF.

## Checkpoint

Owner reviews the extracted catalog and the provisional requirement tags. Record answers to open items in `docs/STATUS.md`.

## Done when

- [x] 226 courses seeded (more than 150 because of level variants), `prereqText` extracted from the PDF and spot checked.
- [x] Provisional tags visibly flagged in admin.
- [x] CRUD, archive, CSV, audit, authorization tests pass.

## Remaining for the checkpoint

- [ ] Owner reviews `/admin/catalog?review=1` (courses with unconfirmed tags) and `docs/spec/14-open-items.md`.
