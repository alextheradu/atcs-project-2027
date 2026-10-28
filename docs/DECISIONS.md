# Decisions

Settled choices and deviations from the original spec. Add a dated entry when you make a new one. Do not re-litigate without the owner.

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
- **Dual enrollment is a note, never a level.** Courses keep their base level and carry `dualEnrollmentNote`.
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
