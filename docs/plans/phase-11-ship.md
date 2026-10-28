# Phase 11: ship

**Goal**: production container on Dokploy, hardened headers, smoke tests, README.

**Read first**: `spec/13-screens-security-deploy.md`.

## Tasks

1. Multi-stage `Dockerfile`, `output: "standalone"`, non-root user, entrypoint runs `prisma migrate deploy` before start. Verify Prisma 7 client and adapter work in the standalone output. Docker build tested locally.
2. `/api/health` (checks DB reachability, no PII).
3. Final CSP and security headers (nonce or hashes as needed for Next 16, service worker, React Flow). Tighten and test with the app running. Origin checks on route handlers, secure httpOnly cookies, `AUTH_TRUST_HOST=true` behind Traefik.
4. Playwright smoke tests: landing and age gate, sign-in stub or seeded session, build a plan, import fixture transcript, submit an appeal, counselor approve a plan, delete-my-data request. Use a test auth bypass that cannot exist in production builds.
5. `README.md`: setup, env vars, Google OAuth steps (consent screen External, redirect `https://<domain>/api/auth/callback/google`, school IT allowlist note), Dokploy steps (app, Postgres service, env, domain, Let's Encrypt, Schedules for `deliver` every minute and `daily`), VAPID and Resend setup, backup note for Postgres.
6. Dependency audit (`npm audit`), remove unused packages, final pass for em dashes and any real student data (grep checks).

## Verify

`docker build .`, run the image against a clean Postgres, `npm run e2e`, `curl /api/health`.

## Checkpoint

Owner deploys to Dokploy and signs in on the real domain.

## Done when

- [ ] Fresh deploy from the README works.
- [ ] Cron schedules configured and verified.
- [ ] Security checklist in `spec/13-screens-security-deploy.md` fully ticked.
