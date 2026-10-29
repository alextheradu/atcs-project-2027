# Status

Update this file at the end of every phase or session.

## Phases

| Phase | Name | State |
|---|---|---|
| 0 | Scaffold | done |
| 1 | Auth and roles | built, awaiting owner checkpoint (needs Google credentials for the live flow) |
| 2 | Catalog | built, awaiting owner review of the catalog and provisional tags |
| 3 | Planner and tracker | built, awaiting owner checkpoint (build a plan, check totals) |
| 4 | Eligibility and pathways | built, awaiting owner checkpoint (try real course choices and the pathway graph) |
| 5 | Onboarding | built, awaiting owner checkpoint (walk the 9th grade and 8th grade paths) |
| 6 | Transcript import | built, awaiting owner checkpoint (import your own transcript locally) |
| 7 | Appeals | built, awaiting owner checkpoint (submit as a student, decide as a supervisor) |
| 8 | Review and dashboards | built, awaiting owner checkpoint (counselor walkthrough) |
| 9 | Notifications and PWA | not started |
| 10 | Privacy and export | not started |
| 11 | Ship | not started |

Plans: `docs/plans/phase-NN-*.md`.

## Blockers and inputs needed from the owner

- Program of Studies PDF: present at `docs/source/ProgramofStudies2026-2027_1.pdf` (Phase 2 unblocked).
- Sample transcript PDF for layout only (Phase 6). Must not be committed.
- Google OAuth client ID and secret for real sign-in (Phase 1 checkpoint). Everything but the live Google flow can be built and tested without them.
- Resend API key and a sending domain (Phase 9). VAPID keys can be generated locally.

## Open items (from `docs/spec/14-open-items.md`)

- [ ] Honors science credits (6.000 on a real transcript)
- [ ] Which courses satisfy Visual/Performing Arts and 21st Century Life and Careers
- [ ] American Studies credit split
- [ ] Four sending-district email domains
- [ ] Operator name and contact email for policies, plus school sign-off
- [ ] Whether school Google Workspaces allow the OAuth client
- [ ] Next cycle dates for course selection and the appeal window
- [ ] Counselor scope: do counselors see all students (current default) or only an assigned caseload? A caseload needs a new model.
- [ ] Deadline or launch date, to decide an MVP cut line (candidates to cut first: rule builder UI, PWA push, pathway graph)

## Log

- 2026-10-29: Deployment resilience: user and resource scoped drafts now recover unsaved editor input after a reload in the same browser tab. Interrupted planner actions retain a pending change with explicit retry, including detection of a save whose response was lost. Confirmed saves preserve newer typing. Docker generates a release ID for Next.js version checks. Typecheck, lint (one warning in concurrent planner loader work), all 697 unit tests and five browser recovery tests passed. Rollout and storage limits are documented in `docs/deployments.md`. No production deployment performed.
- 2026-10-29: Catalog update: dual enrollment is an independent checkbox alongside a course's base level. Existing partner notes were migrated for 28 courses without changing levels. CSV exports include the flag and older imports still work. Typecheck, lint and all 574 tests pass. Browser verified Honors plus dual enrollment, save and reload, display without a note, and clearing the checkbox while preserving the note.
- 2026-10-28: Phase 0 built. Next 16.4.3, Prisma 7.10.1, schema and init migration applied, design tokens, `/styleguide`. Spec split into `docs/spec/*`, agent docs written.
- 2026-10-28: Phase 1 built. Policy, guards, rate limiter, link-intent, signIn decision, role application and all admin actions are unit tested (124 tests). Live Google sign-in and the link-email flow are not tested yet (no credentials). Admin flows verified in a browser through the dev login. Plan item 9 "origin check helper for route handlers" is deferred to Phase 11 (no custom route handlers take state-changing input yet).
- 2026-10-28: Phase 2 built. 226 courses seeded from the PDF with requirement tags (55 provisional), 11 interest tags, 16 aliases. Browse and detail pages for everyone, counselor and admin catalog editor with archive, guarded hard delete, aliases, CSV import and export, audit with before and after. 233 tests. Docker image now seeds reference data on boot. New open items added to `docs/spec/14-open-items.md`.
- 2026-10-28: Phase 3 built. Credit math (integer tenths), requirement tracker, plan warnings, plan server actions (ownership in every query, read-only when submitted, rate limited), `/plans` and `/plans/[id]` with drag and drop (mouse, touch, keyboard, plus a move-to-grade select), add-course panel with filters, requirement rail, admin-editable thresholds. 334 tests. Counselor read-only plan view arrives in Phase 8 (until then staff get a 404 for plans they do not own).
