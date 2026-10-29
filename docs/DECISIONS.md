# Decisions

Settled choices and deviations from the original spec. Add a dated entry when you make a new one. Do not re-litigate without the owner.

## 2026-10-29 (admin student access)

- **Admins can use every student page with their own data.** Import and placement review navigation, page guards and server actions share an explicit student workspace role list (`STUDENT`, `INCOMING`, `ADMIN`). Admin pathways use their own primary plan. Ownership checks still apply, and staff review views retain their existing permissions.
- **Admin onboarding is optional and preserves `ADMIN`.** Visiting `/onboarding` can create or update the admin's own student profile and plan. Grade choices never demote an admin or promote a student to staff. Admins still skip mandatory onboarding and use current-student eligibility and appeal windows.

## 2026-10-29 (same-year co-requisites)

- **Co-requisites have explicit timing:** `sameYear` requires a companion in the same grade year, including completed courses from that year. `sameOrEarlier` also accepts earlier coursework. Existing rules without a timing field keep the earlier-course behavior; new co-requisites default to `sameYear` in the rule builder. The planner has no semester schedule, so paired half-year courses share a school year, not necessarily a semester.
- **AP Microeconomics and AP Macroeconomics are a same-year pair**, as confirmed by the owner, based on the pairing on Program of Studies page 26. Each course references the other. Missing, removed or split companions raise planner warnings without preventing saves. The migration upgrades only rules that still exactly match the original seeds, preserving staff edits and cleared rules.

## 2026-10-29 (deployment recovery)

- **Unsaved editor drafts stay in `sessionStorage`**, scoped to the authenticated user and resource, with a versioned key independent of the release. This survives reloads and redeployments within a tab without keeping student input indefinitely across closed tabs. Store no raw transcript file or raw PDF text. Recovery restores input for review; it never bypasses server authorization or submits automatically.
- **Save acknowledgement is revision specific.** Clearing a draft must preserve typing made while the request was pending. Planner recovery keeps one pending course action, with explicit retry and reconciliation against saved entries so a lost response does not duplicate an added course.
- **Docker builds get a unique `NEXT_DEPLOYMENT_ID`**, generated during the build unless an operator supplies it. Next.js can then detect older client versions and navigate to the current release while drafts survive the reload. Existing database volumes and auth secrets must persist between releases.

## 2026-10-28

- **Prisma 7.10.1, not 8.** npm `latest` is 8.0 RC. We pin stable 7.10.1. Datasource URL lives in `prisma.config.ts`, generator is `prisma-client` with output `src/generated/prisma`, and the client uses `@prisma/adapter-pg`. Revisit when 8 is stable.
- **Dev port 3100.** Port 3000 is occupied by Dokploy on the dev machine. `npm run dev` and Playwright use 3100.
- **Local Postgres on 5433** via `docker-compose.yml` (user, password, db: `pascack` / `pascack` / `pascack_planner`).
- **Next 16 with `cacheComponents` and `partialPrefetching` on** (scaffold default). Dynamic data needs `<Suspense>`. If this fights us, turn it off and record it here.
- **Geist via the `geist` package**, not `next/font/google`, so builds work offline.
- **shadcn hand-wired** (`components.json`, `cn`, `Button`). Use the shadcn CLI to add further primitives.
- **Docs layout for agents.** `AGENTS.md` is the single source of truth (Codex reads it natively), `CLAUDE.md` imports it. Spec is split into `docs/spec/*`, the schema file is the data model source of truth. Plans per phase in `docs/plans/`.
- **Auth.js stays**, behind a thin `src/lib/auth/` layer, per the spec. Verify its current status when starting Phase 1.
- **Never `pkill`.** Stop own processes by port.
- **Counselors see all students for now.** No caseload model exists. The "filter by counselor" in the dashboard is deferred until the owner defines caseloads. Appeals "for their students" means all students. Changing this later needs a new assignment model and a revisit of Phase 7 and 8 authorization tests.
- **Dev sign-in stub allowed from Phase 1.** A credentials-style sign-in that exists only when `NODE_ENV !== "production"` and `DEV_AUTH=true`, so phases 3 to 8 can be verified without Google credentials. It must be compiled out or throw in production builds, and a test must assert that. Real Google flow is still the checkpoint for Phase 1.
- **Open-item defaults ship as flagged guesses**: honors science credits 5 (entry credits override), American Studies 5 plus 5, arts and life-careers tags provisional, example dates for timelines. Flag them in the UI where they affect totals.
- **Phase 1 may start before the owner approves `/styleguide`.** Token or component tweaks after review are cheap. Do not build large UI on top of unreviewed tokens beyond the app shell.

## 2026-10-28 (Phase 1)

- **`ADMIN_EMAILS` is trusted and exempt from the `@pascack.org` rule.** It is set by the operator, who may not have a school address. It bootstraps an admin when the user is new, or when no admin exists at all. It never re-promotes after an admin changes that role. Staff roles through grants and the admin UI still require `@pascack.org`.
- **A student grant is the invite.** In `INVITE_ONLY` mode a `RoleGrant` with role `STUDENT` or `INCOMING` (any email domain) lets that person sign up. Staff grants are limited to `@pascack.org`.
- **Grants apply once.** A grant with `appliedAt` set no longer changes roles, so later admin changes are not overwritten at sign-in.
- **Link-second-email flow.** `startLinkEmail` sets a signed 10 minute cookie, then sends the user to Google's account chooser. Auth.js links any new Google account to a signed-in user on its own, so `decideSignIn` denies that unless the cookie is valid, the email is verified, and the email belongs to nobody else. `events.linkAccount` stores the `LinkedEmail`. `allowDangerousEmailAccountLinking` is on for Google only, and our adapter's `getUserByEmail` also searches `LinkedEmail`.
- **Session reads call `connection()` first** in `getCurrentUser` (Auth.js uses `crypto.getRandomValues` before reading request data, which `cacheComponents` rejects during prerender).
- **Authed pages export `instant = false`.** Layout level is not enough, each page needs it. Remove it from a page only if that page can stream behind its own Suspense.
- **Unauthorized pages stream a 404 body with HTTP 200** because the role check runs behind Suspense. No admin data is sent (verified). API and server actions throw proper errors.
- **Baseline CSP uses `'unsafe-inline'` for scripts** (no nonces, so static shells still work). Phase 11 tightens it with SRI or nonces.
- **Dev login** is `GET /api/dev-login?email=&role=&dept=`, only when `NODE_ENV` is development or test and `DEV_AUTH=true`. It creates a database session directly.

## 2026-10-28 (Docker)

- **Dockerfile is in and tested** (build, boot against an empty database, migrations applied, `/api/health` ok, runs as non-root uid 1001, dev-login returns 404). Stages: deps, builder, migrator, runner. Base `node:22-bookworm-slim` (Debian, not Alpine, so Prisma's engines just work).
- **Migrations run in `docker-entrypoint.sh`** using a separate Prisma CLI install in `/opt/migrate` (pinned 7.10.1, same as the app) so the CLI stays out of the standalone bundle. If you bump Prisma, bump it in the `migrator` stage too.
- **The container seeds reference data on boot.** The seed is bundled with esbuild into `seed.mjs` (self-contained, no tsx) and run by the entrypoint after migrations. It is create-only, so restarts and admin edits are safe. `RUN_SEED=false` skips it. The first admin still comes from `ADMIN_EMAILS`.
- **Container listens on 3000 internally.** Dokploy routes the domain to it. Set `AUTH_URL` to the public https URL and `AUTH_TRUST_HOST=true`.

## 2026-10-28 (Phase 2, catalog)

- **226 course rows, not about 150.** Level variants (CP, Enhanced, Honors) and per-language levels are separate rows because transcripts list them separately. Four languages times levels I to V, honors II to IV and AP account for 41 of them.
- **Extraction is a script plus a hand-reviewed build.** `scripts/extract-catalog.ts` reads `docs/source/pages/NN.txt` (from `pdftotext -layout`) into `prisma/seed/courses.draft.json`. `scripts/build-catalog.ts` is the review: every mapping, tag and judgment call is in that file. Re-run both to regenerate the seed JSON. Never edit `courses.json` by hand.
- **Requirement tags live inside each course** in `courses.json` (a `requirements` array) instead of a separate `course-requirements.json`.
- **Seeds are create-only.** Re-seeding never overwrites a counselor's edits. To reset a course, delete it in the admin and re-seed, or use CSV import.
- **Catalog names use "AP", "Honors", "U.S."** and slugs drop apostrophes. `normalizeTitle` (in `src/lib/catalog/normalize.ts`) maps transcript spellings such as "Advanced Placement" and "United States" onto the same normalized form. Phase 6 matching must use it.
- **English electives do not count as English.** The PDF has an ELECTIVES heading starting at 21st Century Journalism, and AP Capstone: Research says it does not count for English credit. Tagged accordingly.
- **Dual enrollment is independent of level.** Courses keep their base level, with a `dualEnrollment` checkbox and an optional `dualEnrollmentNote`. A course can be both Honors or AP and dual enrollment. Existing partner notes enable the checkbox during migration. CSV exports include the flag; older CSVs derive it from their notes.
- **Applied Physics & Engineering is one row** (the PDF lists it twice with different prerequisites, Algebra I in Science and Chemistry in Technology). Both statements are kept in `prereqText`. Credits are 10, with 5 counted toward physics.
- **Authorization:** counselors and admins edit the catalog. Hard delete is blocked if any plan entry or appeal references the course.
- **Do not run `next build` while `next dev` is running.** It leaves dev in a state where pages reload forever. Stop dev, delete `.next/dev`, and restart if that happens.

## 2026-10-28 (UI pass)

- **No cards.** The first design used bordered, rounded boxes everywhere and read as generic. Everything is now flat: hairline rules, rows, definition lists, dot-style status badges. Buttons and tokens are unchanged. Rules are in `docs/spec/12-design-system.md`. The `.card` class and `--radius-card` no longer exist, do not reintroduce them.
- **App shell:** 232px sidebar, 48px top bar with breadcrumbs, content max width 1100px (was 1200), wordmark mark in the sidebar.

## 2026-10-28 (design pass 2: impeccable, Emil, command, contd)

- **`PRODUCT.md` and `DESIGN.md` now exist at the repo root** (impeccable's format). Read them before any UI work. `DESIGN.md` is the compact visual source of truth; `docs/spec/12-design-system.md` has the longer rules.
- **Expressive everywhere, but short.** Sign-in has a staged blur-to-sharp reveal (0.8s, once). In the app, headers, sections and the first rows rise in 6px steps under 300ms total, ease-out. Nothing animates on keyboard actions. Reduced motion keeps a quick fade.
- **Selected state is a 6px blue dot, not a 2px stripe** (impeccable bans side stripes). Applies to rows and the active nav item. A test fails the build if a colored side stripe returns.
- **Sticky bars are opaque** (command's Solid Bar Rule). The sign-in pill nav is solid too.
- **No browser form chrome** (contd): drawn checkboxes and radios (blue when on), one chevron on selects, no number spinners, autofill keeps the surface, thin scrollbars. Fields focus with a blue border and 3px 20% ring.
- **Phones:** opaque bottom tab bar (Workspace items plus More), 44px inputs at 16px text on touch.
- **Not taken from contd:** tilt, rotation and sticker styling (the spec bans tilt), and the red accent.
- **`globals.test.ts`** guards the stylesheet. A slicing edit once deleted the whole components layer (buttons, lists, badges); the test now fails if shared classes disappear or braces unbalance.

## 2026-10-28 (Phase 3, planner)

- **Credits and requirement math use integer tenths** (`src/lib/credits`). A tag worth less than the whole course counts its own credits (American Studies 5 + 5, Applied Physics 5 of 10). A full tag counts the credits the student actually has, so a 6 credit honors science counts 6 toward its requirement.
- **Completed vs planned:** `COMPLETED` entries are earned. `PLANNED` and `IN_PROGRESS` are scheduled. Requirements met by any mix are met; the rail shows the two shades.
- **Warnings are advice only.** Under 30 credits (25 senior year), more than 8 periods (a 10 credit course counts as 2, half-years as 0.5), and a course placed in a grade it is not offered in. Prereq and coreq warnings plug into `computeWarnings(..., extra)` in Phase 4.
- **Plans:** up to 10 per student, 60 courses per plan, first plan is primary, names default to Plan A, Plan B. Submitted and approved plans are read-only; `CHANGES_REQUESTED` is editable again. A submitted plan cannot be deleted.
- **Ownership lives in the query** (`where: { id, ownerId }`). Someone else's plan, for any role including counselor and admin, is a 404. Counselors get their read-only view in Phase 8.
- **Thresholds are admin editable** in `/admin/settings` (11 requirement credits plus total, per year, senior year and max periods, stored in `RequirementRule` and `AppSetting graduation`).
- **Drag and drop:** `@dnd-kit/core` with mouse, touch (180ms hold) and keyboard sensors. Collision uses the pointer when there is one and falls back to rectangle overlap for keyboard drags. Every row also has a "Move to grade" select as a non-drag alternative. The `DndContext` has a fixed `id` to avoid a hydration mismatch.
- **Optimistic updates:** the client applies the change, calls the server action, and falls back to the server's copy if it refuses. Server data replaces local state whenever it arrives (state is reset during render, not in an effect).
- **The planner page is wider** (max 1440px) than other pages. Four columns need 2xl width; below that it is a 2 by 2 grid.

## 2026-10-29 (Phase 4, eligibility and pathways)

- **The engine is `src/lib/eligibility/`**, pure and shared by client and server. Rule trees are `all`, `any` and six leaves: `completed`, `minGrade`, `gradeLevel`, `coreq`, `priorCoursework`, `manual`. A leaf listing several courses means any one of them.
- **Four results:** `ELIGIBLE`, `ELIGIBLE_WITH_WARNING`, `NOT_ELIGIBLE_APPEALABLE`, `NOT_ELIGIBLE_LOCKED`. A met requirement is eligible. A prerequisite that is only planned in an earlier year, a missing grade, a `Pass`, a missing 8th grade profile, a `manual` leaf, or an unmet `advisory` leaf gives a warning. `all` takes the worst child, `any` the best. A `manual` leaf never passes or fails but never hides a real failure.
- **Appealable or locked:** a grade that is too low is appealable. A prerequisite that was skipped (or planned after the course) is locked. A leaf can override with `appealable`. This is how "skipping a step is locked, moving up a level is appealable" falls out of the rules, no extra data needed.
- **Final grade stands in for the "initial test/quiz average".** `minGrade` has a `basis`. When it is `initialAverage` the message says the final grade is an estimate. The appeal form (Phase 7) collects the real average.
- **Approved appeal:** a plan entry with `overrideAppealId` set counts as "Approved via appeal" and clears an unmet result. Phase 7 sets that column only for approved appeals.
- **Rules come from the PDF text only.** `scripts/build-rules.ts` is the reviewed source and writes `prisma/seed/rules.json` and `edges.json`. Each entry cites PDF pages and a test fails if the page does not match the course's `sourcePage`. 94 courses are encoded. Vague placements, auditions and recommendations are `manual` leaves. A course with prerequisite text nobody encoded shows a warning and the text, it never passes silently.
- **How generic PDF names were read:** "9th Grade English", "a biology course", "Biology, Chemistry, and Physics" use the whole subject family. Exact course names ("Geometry", "Algebra I", "Pre-Calculus") mean that exact course. 8th grade Algebra I counts as Algebra I for the courses that follow it (page 37 path diagram). Each of these is listed in `docs/spec/14-open-items.md`.
- **"Suggested Co-requisite" is `advisory`:** it warns, never fails.
- **Seeding rules and edges is one time** (`AppSetting seed.rules.v1`). After that admins own them, so a re-seed cannot bring back something an admin removed. Bump the key to apply a revised set, and it only fills courses without a rule.
- **Edges come from the typical path diagrams** (math and computer science p37, science p46) plus prerequisite text. Solid arrows are `STANDARD`, dotted arrows that move up are `ADVANCE`. Dotted arrows that move down (for example Honors Geometry to Algebra II Enhanced) are not drawn. Middle school Algebra I and Pre-Algebra are the two math starting nodes and light up from the student's profile. World language and English ladders follow course numbering only, and the edge note says the PDF lists no formal prerequisite.
- **Pathways page** uses React Flow with dagre (top to bottom). Node state comes from the student's primary plan. Staff see the graph without states. "Request placement review" is a disabled stub until Phase 7.
- **Rule and edge admin** (`/admin/rules`, `/admin/edges`): ADMIN everywhere, SUPERVISOR only in their own departments, nobody else. The scope check lives in the server action, a mutation test confirms the tests fail without it. A supervisor gets a 404, not a 403, for another department's course. An edge needs both courses in scope. New edges cannot make a loop. Every change is audited with before and after.
- **Plan warnings:** failing placements become `UNMET_PREREQ` or `MISSING_COREQ` (only when every unmet leaf is a co-requisite). Warning-level results show as a "Check details" badge on the row, not in the warning list.

## 2026-10-29 (Phase 5, onboarding)

- **Age gate:** the sign-in card asks "How old are you?" first. The answer is a short lived (6 hours) HMAC signed cookie holding only `over13` or `under13` and an expiry. Under 13 shows "Come back when you are 13", creates no user and stores nothing. `signInWithGoogle` also checks the cookie server side. `User.ageConfirmed13At` is set when the student picks a grade. Existing users with no cookie tick a box instead.
- **Onboarding is for students only.** Every onboarding action calls `requireUser()` and refuses staff roles. A grade pick moves a user only between `STUDENT` and `INCOMING`, never to staff (tested for every grade and with a forged `role` field).
- **Gate:** the `(app)` layout redirects students with no `onboardedAt`, or with an unaccepted newest policy version, to `/onboarding`. Staff skip it. Progress is saved per step in `OnboardingProgress`, so a reload resumes. A new policy version resumes at the policy step.
- **Policies** are seeded as clearly marked drafts with placeholders (`[OPERATOR NAME]`, `[CONTACT EMAIL]`) and shown at `/privacy` and `/terms`. They need real text and school sign-off before real students use the app.
- **Snapshot expiry:** `snapshotExpiresAt` is the close of the first appeal window that has not ended (from `TimelineEvent`). With none scheduled it falls back to August 31 (`src/lib/onboarding/placement.ts`). The daily deletion job comes in Phase 9.
- **Starter plan** (`src/lib/starter-plan/`): six required 9th grade picks (English, social studies, biology, geometry, health and PE, a world language), then interest ranked electives with no prerequisites until the year is 35 to 40 credits. Higher level courses appear only as "worth considering, a supervisor decides" stretch options when a grade is A- or better (math also needs 8th grade Algebra I), and are not added to the plan. With no language entered the first beginner language is picked and marked as a guess. Current students get a blank Plan A. 8th graders get "Plan A (starter draft)" with an "Based on self-reported info" note.
- **Learn cards** live in `src/lib/learn/content.ts` and feed onboarding, `/help`, and tooltips (the credits heading so far).
- **Stubs:** transcript import (Phase 6) falls back to a blank plan. Notification choices and the PWA install prompt are text only until Phase 9. The tour is a short note on the first plan page.
- **Dev login** skips onboarding by default. Add `&onboarding=1` to walk it.

## 2026-10-29 (Phase 6, transcript import)

- **Real layout differs from the spec text.** The district transcript is a 2 by 2 grid of year blocks headed `Grade: 09   Year: 2024-25` (label and value are separate text items), not the bare `09 2024-25` form. The parser accepts both. An unused block prints `Grade:   Year:` with nothing after it and is skipped. Rows in progress print a title only. Block totals read `Academic G.P.A.: x   Total Credits: y` and the cumulative total is its own line. Real honors science rows print 6.000 credits, so imports keep the printed credits.
- **Parsing happens in the browser** (`pdfjs-dist`, worker bundled with the app, `worker-src 'self' blob:`). The PDF is read in memory. Only confirmed course rows (course id, year, grade, credits) go to the server, about 2 KB. A test checks the parser output has no field that could hold a name, ID, birth date, address or parent. The student information area is never read: the parser only looks inside year blocks and one "Class of" line.
- **Sanity checks are warnings only:** each block's rows against its printed total, and the sum of blocks against the cumulative total.
- **Matching order:** alias, exact normalized name, Fuse.js fuzzy. Bands: 0.80 and up "likely", 0.55 to 0.80 "check", below that nothing is selected. A fuzzy hit with a different level word (honors, AP, enhanced) or course number is capped at 0.50 so Honors Biology never quietly becomes Biology. A trailing "(H)" reads as honors.
- **Aliases:** a hand mapping or a fuzzy confirmation saves a `CourseAlias`, never overwriting one a counselor made. A second student's import then matches it. Counselor alias management already exists in `/admin/catalog` (Phase 2).
- **Saving:** `confirmImport` and `bulkAddCourses` check the plan by owner, refuse submitted plans, cap payloads at 60 rows, skip courses already on the plan, allow archived courses but not middle school placeholders, and are rate limited (10 an hour). The audit log gets counts only.
- **Import stays a student page** (`/import`). A transcript fixture is generated by `scripts/make-fixture-transcript.ts` into `fixtures/`: fake student, same layout, an "AP Computer Science A / A" row, an in-progress block, an unused block, and a mismatch variant.
- **Student imports never write shared aliases.** A matched course is recorded on the student's plan right away. A title the student matched by hand, or one that is not in the catalog at all, becomes an `ImportRequest` (pending). Counselors and admins review these at `/admin/catalog/requests`: approving creates the shared alias (and records who approved it), dismissing discards it. A missing course is not added to the plan until staff add it or map it. Requests are skipped for titles that already equal a catalog name or already have an alias, one per student per title, and the same title from several students shows once with a count. The import action also refuses non-student roles and ignores suggestions for courses outside the same import. Manual entry (`Add by hand`) stays available for any grade.

## 2026-10-29 (Phase 7, appeals)

- **Student side:** "Request placement review" is a button on the course page and the pathway graph (client component, because creating a draft is a server action and cannot run while a page renders). It opens or reopens one draft per student and course. Current students may ask when they are `NOT_ELIGIBLE_APPEALABLE` or `ELIGIBLE_WITH_WARNING`. A course they already qualify for, a locked one, or one already approved is refused with a plain message. Incoming 8th graders have no records here, so they may ask about any course.
- **Windows:** current students any time. Incoming students only inside an open `APPEAL_WINDOW` (audience incoming or all). Outside it they can still save a draft, and the form shows the next open date. A window with no end date stays open. No dates are in code. The 2025-26 dates from the Program of Studies are seeded as labeled examples, and admins add the next cycle at `/admin/timeline`.
- **Self-reported values:** the form collects a grade and a 0 to 100 average, both stored with `selfReported` and shown to reviewers with a "Self-reported" badge. Question prompts are copied into each answer so later edits do not change what a reviewer reads.
- **Review:** `/review` shows SUPERVISORs only appeals in their own departments and ADMINs all. The detail page and the decision action both check the department, so another department's appeal is a 404 on the page and a refusal in the action (mutation tested). A decision needs a note. Counselors are not reviewers. They get a read-only view in Phase 8, once "their students" has a definition (no counselor to student link exists yet).
- **Approval** sets `PlanEntry.overrideAppealId` on that student's entries for the course, so the planner and the course page show "Approved via appeal". Adding the course later links the approval automatically. Denied or withdrawn requests change no plan.
- **Notifications:** submitting notifies the supervisors of that department (admins if there are none). A decision notifies the student. They are saved as in-app `Notification` rows with no grades or answers in the text. Showing and delivering them is Phase 9.
- **Default questions** (six, from the spec) are seeded only when none exist. Supervisors edit questions for their own departments, admins any, including the all-department ones. Submissions are rate limited (10 an hour).

## 2026-10-29 (Phase 8, plan review and dashboards)

- **Plan review flow:** `DRAFT` to `SUBMITTED`, then a counselor or admin approves or requests changes. A student can take a submitted plan back to a draft, resubmit after changes were requested, or reopen an approved plan (which clears the approval). Submitted and approved plans are read-only for the student, and the existing plan actions already enforce that. Only counselors and admins review plans. Supervisors review appeals, not plans.
- **Counselors and admins read, never edit.** `/counselor/plans/[id]` shows any student's plan through the same planner with editing off. Every edit action still checks ownership, so a counselor cannot change a student's plan even by calling the action directly.
- **Comments** are on the plan or on one course, up to 1000 characters, shown as plain text (a pasted `<b>` stays literal). Only the plan's owner and plan reviewers can comment, and anyone else gets "not found". Asking for changes needs a note, which is saved as a comment. Notifications say a comment exists and never contain its text.
- **Counselor dashboard** (`/counselor`): plans waiting for review, plans that leave graduation open (uses the Phase 3 requirement and warning modules on each primary plan, with a class year filter), and course demand. The filter by counselor is skipped until caseloads exist, as agreed.
- **Course demand** counts a student once per course when it is in their primary plan or in a submitted or approved plan. Other drafts are what-ifs and are left out. The count is by grade level and can be sorted by students or name. Checked against an independent SQL count in the browser.
- **Dashboard** shows the next dates by audience with countdowns (an open window counts down to its close). Nothing is hardcoded, the dates come from the admin timeline.
- **College guidance** (`/admin/major-guidance`, admin editable, audited): the table on page 12 of the Program of Studies is stored as years of English, math, social studies, science and world language. Social studies uses 3 (the PDF says 3 to 4) and world language 2 (2 to 4). Majors are groups with keywords. Typing a matching intended major (whole words) raises math or science to 4. It shows on the plan rail as "For college" and counts a year when the plan has a course from that department in it. It is labeled a recommendation, not a graduation rule.

