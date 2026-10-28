# 02 Roles and auth

Roles: `STUDENT`, `INCOMING` (8th grader planning for high school), `COUNSELOR`, `SUPERVISOR` (scoped to departments), `ADMIN`.

## Rules

- Any Google account with a verified email can authenticate, but signup is gated by an admin-controlled **signup mode** stored in `AppSetting` key `signupMode`: `DOMAIN_ALLOWLIST` (default), `OPEN`, or `INVITE_ONLY`.
- `AllowedDomain` rows map an email domain to a cohort (`CURRENT` or `INCOMING_8`). Seed `pascack.org` as `CURRENT`. Admins add the four sending-district domains (Hillsdale, Montvale, River Vale, Woodcliff Lake) as `INCOMING_8` later. Do not guess those domains.
- **Staff roles are never derived from email domain.** `COUNSELOR`, `SUPERVISOR`, and `ADMIN` come only from `RoleGrant` rows created by an admin, and a staff grant is only allowed for `@pascack.org` addresses. Grants can be created before the person has signed in and are applied at first sign-in.
- The first admin comes from the `ADMIN_EMAILS` env var (comma separated), applied on first sign-in.
- Admin UI at `/admin/users`: search users, change role, set supervisor departments, create pre-approved grants. You cannot demote the last admin. Every change goes in `AuditLog`.
- A student can link a second email (for example, a personal Gmail used in 8th grade and the school address in 9th). Flow: signed in with account A, start "link email", sign in with Google as B, confirm, B is stored in `LinkedEmail`, and signing in with B later resolves to the same user. Handle this in the `signIn` callback.
- Enforce authorization on the server in every server action and route handler with a `requireRole()` helper plus ownership checks (`where: { ownerId: session.user.id }`). Hiding buttons is not security.
- Rate limit sign-in attempts, appeal submissions, plan creation, imports, and data exports (in-memory limiter is fine for a single container).
- Google OAuth consent screen type is External with only basic scopes (openid, email, profile), so no Google verification is required. Redirect URI: `https://<domain>/api/auth/callback/google`. Set `AUTH_TRUST_HOST=true` behind Traefik.
- Note for the owner: some school Google Workspaces block unapproved third-party apps, so school IT may need to allowlist the OAuth client ID.
