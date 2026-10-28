# Phase 5: onboarding

**Goal**: age gate, policy acceptance, learn cards, current-student and 8th-grade branches, starter plan, interest tags.

**Read first**: `spec/03-onboarding.md`, `spec/11-privacy.md`, `spec/12-design-system.md` (auth texture applies here).

## Tasks

1. Age gate on `/`: under 13 shows the "come back when you're 13" screen, stores nothing, short-lived signed cookie for the session only. 13 or older stores only `ageConfirmed13At`. Never store age or birthdate. Unit test the gate logic and cookie signing.
2. Middleware or proxy sends incomplete users to `/onboarding`. Resumable through `OnboardingProgress` (step plus draft JSON).
3. Steps 1 to 7 as in the spec. Grade buttons set cohort, role (`INCOMING` or `STUDENT`), and grad year. Check that a grade pick can never grant a staff role.
4. Placeholder `PolicyDocument` rows (privacy and terms v1, clearly marked draft with placeholders). Acceptance via `PolicyAcceptance`. A new version re-prompts.
5. Five learn cards, also exposed at `/help` and as tooltips. Content in one module so all three places share it.
6. Grades 9 to 12 branch: link to import (Phase 6 stub) or blank plan, prior coursework questions (8th grade math, world language) which set the math pathway start.
7. 8th grade branch: interest multi-select, snapshot form with grade dropdowns, the honesty warning text verbatim and the required "I'm answering honestly" checkbox, in-app privacy notice. Set `snapshotExpiresAt` to the end of the first appeal cycle (from `TimelineEvent`, fallback documented in code).
8. Test first, `src/lib/starter-plan/`: rule-based starter Plan A. Required 9th grade courses first, then electives ranked by interest-tag overlap. Output labeled "Based on self-reported info", wording "likely a fit" or "worth considering, a supervisor decides", never placement. Deterministic.
9. Steps 5 to 7: optional intended major, notification preferences stub, PWA install prompt stub with the iOS note, dashboard landing with a short tour.

## Verify

`npm test`. Walk through as a 9th grader and as an 8th grader.

## Checkpoint

Owner walks both paths.

## Done when

- [ ] Under-13 path stores nothing.
- [ ] Starter plan tests pass and copy follows the wording rules.
- [ ] Onboarding is resumable mid-step.
