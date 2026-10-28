# Phase 1: auth and roles

**Goal**: Google sign-in with gated signup, role grants, admin user management, audit log, rate limiting, and tested authorization.

**Read first**: `spec/02-auth-roles.md`, `spec/13-screens-security-deploy.md` (security), `spec/12-design-system.md`. Check installed `next-auth` beta types and its current status (Auth.js is now maintained by the Better Auth team). Read `node_modules/next/dist/docs/` for middleware or proxy conventions in Next 16 before writing it.

**Inputs needed**: `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` for the live flow. Without them, build and unit test everything else.

## Tasks

1. `src/lib/auth/` thin layer: Auth.js config, Prisma adapter, database sessions, `getSession()`, `requireRole(...roles)`, `requireUser()`. Nothing outside this folder imports `next-auth` directly.
2. Pure policy module `src/lib/auth/policy.ts` (test first): given email, signup mode, allowed domains, grants, admin emails, existing linked emails, return `{allow, role, cohort, departments, reason}`. Cases: allowlist hit and miss, OPEN, INVITE_ONLY with and without grant, staff grant only for `@pascack.org`, `ADMIN_EMAILS` bootstrap, linked email resolves to existing user, unverified email rejected.
3. `signIn` callback uses the policy module. Applies grants at first sign-in and marks `appliedAt`. Handles the link-second-email flow (start link, sign in as B, confirm, store `LinkedEmail`, later B resolves to same user).
4. Seed: `AppSetting signupMode` from `SIGNUP_MODE_DEFAULT`, `AllowedDomain pascack.org` as `CURRENT`. Do not seed sending-district domains.
5. `src/lib/audit.ts`: `writeAudit({actor, action, entityType, entityId, before, after})`.
6. `src/lib/rate-limit.ts`: in-memory sliding window limiter with named buckets (sign-in, appeal, plan, import, export). Unit tested with a fake clock.
7a. Dev-only sign-in stub per `docs/DECISIONS.md` (`DEV_AUTH=true`, never in production, tested).
7. Sign-in page UI with a stub age gate (full age gate is Phase 5). App shell: 232px sidebar, top bar with breadcrumbs, role-aware nav.
8. `/admin/users`: search, change role, set supervisor departments, create pre-approved grants (rejects non `@pascack.org` staff), cannot demote last admin, every change audited. `/admin/settings` for signup mode and allowed domains.
9. Security headers and a first CSP in `next.config.ts`. Secure httpOnly cookies. Origin check helper for route handlers.
10. Authorization tests: each admin server action rejects anonymous, STUDENT, INCOMING, COUNSELOR (where not allowed) and accepts the right role. Last-admin demotion blocked.

## Verify

`npm run typecheck && npm run lint && npm test`. Manual: sign in with an allowed and a disallowed email, create a grant before sign-in and confirm it applies, try to grant a staff role to a gmail address (must fail).

## Checkpoint

Owner signs in with Google, sees role-aware nav, uses `/admin/users`. Staff roles only come from grants.

## Done when

- [x] Policy module tests pass, auth tests pass.
- [x] No direct `next-auth` imports outside `src/lib/auth/`.
- [x] Every admin action audited.
- [x] `docs/STATUS.md` updated.

## Remaining for the checkpoint

- [ ] Owner adds `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, signs in, and tries the link-email flow.
- [ ] Origin check helper for route handlers (moved to Phase 11).
