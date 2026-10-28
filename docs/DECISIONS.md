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
- **No seed runs in the container yet.** In production, `signupMode` falls back to `SIGNUP_MODE_DEFAULT` and the `pascack.org` allowed domain does not exist until it is added in `/admin/settings` or a production seed is written (Phase 2). The first admin comes from `ADMIN_EMAILS`.
- **Container listens on 3000 internally.** Dokploy routes the domain to it. Set `AUTH_URL` to the public https URL and `AUTH_TRUST_HOST=true`.
