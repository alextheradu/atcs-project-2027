# 03 Onboarding flow

Onboarding is required and resumable (`OnboardingProgress`). Middleware sends incomplete users back to it.

**Step 0, age gate, before sign-in.** The landing page asks "How old are you?" before showing the Google button.
- Under 13: show a friendly "come back when you're 13" screen. Do not sign them in or store anything. A short-lived signed cookie may remember the block for the session only.
- 13 or older: store only `User.ageConfirmed13At`. Never store an exact age or birthdate.

**Step 1.** Sign in with Google, then choose a grade: 8th, 9th, 10th, 11th, or 12th (buttons). This sets cohort, role (`INCOMING` or `STUDENT`), and grad year.

**Step 2.** Show the privacy policy and terms as short summary cards with links to the full pages. Require acceptance (checkbox), stored as `PolicyAcceptance` rows. A new policy version re-prompts.

**Step 3, learn the basics.** Five short skippable cards, replayable from `/help`: how credits work (5 per full-year course, 2.5 per half-year, 120 to graduate), what graduation requires, levels (CP, Enhanced, Honors, AP, dual enrollment), pathways (locked vs appealable), appeals (what they are and when they open). The same explainers appear as tooltips in the app.

**Step 4, background (branches by cohort).**
- Grades 9 to 12: import a transcript or add courses by hand (optional, can skip to a blank plan). Ask for prior coursework: Algebra I or Pre-Algebra in 8th grade, and the world language studied. This sets the math pathway start.
- 8th graders: no transcript and no strict eligibility, because we do not have the middle schools' programs of study. Collect:
  - Interest buttons (multi-select): engineering and building, coding and CS, medicine and health, business and money, art and design, film and media, music and performing, writing and humanities, languages, science research, hands-on career programs (Satellite School). Stored as `InterestTag`. Editable by counselors.
  - A **snapshot** of self-reported info: math in 8th grade (Algebra I, Pre-Algebra, not sure), math grade, science grade, English grade, history grade, and an optional world language and level. Each grade is a dropdown (A+ through D, plus "I don't know yet" and "Prefer not to say").
  - Show this at the top of the step, in plain words: *"Be honest here. Nobody is grading you and this does not change your real placement. It only helps us suggest classes that fit you. If you enter higher grades than you have, you will get suggestions that are too hard and a plan you may not be placed into. The school decides your real placement from your actual records."* Require an "I'm answering honestly" checkbox before continuing.
  - Everything derived from these answers is labeled "Based on self-reported info". Supervisors reviewing an appeal see the values marked self-reported and verify them elsewhere. The app never treats them as verified.
  - Generate a **starter Plan A** as a clearly labeled draft: required 9th grade courses first, then electives ranked by interest-tag overlap. Rule-based, no AI. Suggestions are phrased as "likely a fit" or "worth considering, a supervisor decides", never as placements.
  - The snapshot is stored in `StudentProfile` with `snapshotExpiresAt` set to the end of their first appeal cycle, after which a daily job deletes the snapshot fields.

**Step 5.** Optional intended major or career, used for college-requirement guidance.

**Step 6.** Notification preferences (email, push), PWA install prompt, and the iOS note (push on iOS only works after Add to Home Screen, iOS 16.4 or later).

**Step 7.** Land on the dashboard with the plan already created and a short product tour.
