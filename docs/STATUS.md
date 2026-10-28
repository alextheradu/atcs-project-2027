# Status

Update this file at the end of every phase or session.

## Phases

| Phase | Name | State |
|---|---|---|
| 0 | Scaffold | done, awaiting owner checkpoint on `/styleguide` |
| 1 | Auth and roles | next |
| 2 | Catalog | not started, needs `docs/source/ProgramofStudies2026-2027_1.pdf` |
| 3 | Planner and tracker | not started |
| 4 | Eligibility and pathways | not started |
| 5 | Onboarding | not started |
| 6 | Transcript import | not started, needs a layout reference transcript |
| 7 | Appeals | not started |
| 8 | Review and dashboards | not started |
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

- 2026-10-28: Phase 0 built. Next 16.4.3, Prisma 7.10.1, schema and init migration applied, design tokens, `/styleguide`. Spec split into `docs/spec/*`, agent docs written.
