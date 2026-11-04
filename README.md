# Pascack Course Planner

An unofficial student web app for planning four years of high school courses: a planner with a graduation tracker, course eligibility checks, placement review requests, and counselor tools. It is not affiliated with Pascack Valley Regional High School District. There are no AI services involved; every check is deterministic.

Contributors and coding agents: start with `AGENTS.md`, then `docs/STATUS.md`.

## Local development

Requirements: Node 22, Docker (for Postgres).

```bash
cp .env.example .env          # fill AUTH_SECRET at least (openssl rand -base64 32)
docker compose up -d          # Postgres on localhost:5433
npm ci
npx prisma migrate dev        # apply migrations and generate the client
npm run db:seed               # catalog, requirement rules, interest tags, policies
npm run dev                   # http://localhost:3100
```

Without Google credentials you can still sign in locally: set `DEV_AUTH=true` in `.env` and open `/api/dev-login?email=you@example.test&role=STUDENT` (roles: `STUDENT`, `INCOMING`, `COUNSELOR`, `SUPERVISOR`, `ADMIN`). The route only exists when `NODE_ENV` is `development` or `test`, so a production build always answers 404.

Checks before calling anything done:

```bash
npm run typecheck && npm run lint && npm test
npm run e2e                   # Playwright, needs Postgres and DEV_AUTH=true
```

## Environment variables

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Keep it across releases or every session ends. |
| `AUTH_URL` | yes | Public origin, for example `https://planner.example.org`. |
| `AUTH_TRUST_HOST` | yes | `true` behind Traefik. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | yes | Google OAuth client, see below. |
| `ADMIN_EMAILS` | first deploy | Comma separated. These accounts become admins on first sign-in. |
| `SIGNUP_MODE_DEFAULT` | no | `DOMAIN_ALLOWLIST` (default), `OPEN` or `INVITE_ONLY`. Admins can change it later. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Without them, email deliveries are marked failed and not retried. In-app notifications still work. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push | `npx web-push generate-vapid-keys`. Subject is a `mailto:` contact. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | for push | Same value as `VAPID_PUBLIC_KEY`. Baked in at build time, so pass it as a Docker build argument. |
| `CRON_SECRET` | yes | At least 16 characters (`openssl rand -hex 32`). Shorter or empty rejects every cron call. |
| `NEXT_DEPLOYMENT_ID` | no | Build argument. Docker generates a fresh one per build if omitted. See `docs/deployments.md`. |
| `RUN_SEED` | no | `false` skips the create-only seed on container start. |
| `DEV_AUTH` | never in production | Enables `/api/dev-login` in development only. |

## Google OAuth

1. Google Cloud console, APIs and Services, OAuth consent screen: user type **External**, app name, support email, and the privacy and terms URLs (`/privacy`, `/terms`). Scopes: `openid`, `email`, `profile` only.
2. Credentials, Create OAuth client ID, type Web application.
3. Authorized redirect URI: `https://<your-domain>/api/auth/callback/google`. For local work add `http://localhost:3100/api/auth/callback/google`.
4. Put the client ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

School Google Workspace accounts may block third-party apps. If students see "access blocked", the district IT team has to allow the OAuth client ID in the Workspace admin console (Security, API controls, App access control). Ask before launch.

## Deploying on Dokploy

The `Dockerfile` builds a standalone Next.js server that runs as a non-root user. On every start the entrypoint runs `prisma migrate deploy`, then a create-only seed that never overwrites admin edits, then the server on port 3000. The image has a health check against `/api/health`.

1. **Database**: create a Postgres service (17 or newer) in the same Dokploy project. Copy its internal connection string into `DATABASE_URL`.
2. **Application**: create an application from this repository, build type Dockerfile.
3. **Build arguments**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (if using push).
4. **Environment**: everything in the table above. Never set `DEV_AUTH`.
5. **Domain**: add the domain, container port `3000`, HTTPS on with Let's Encrypt. HTTPS is required for sign-in cookies, the service worker and push.
6. **Deploy**, then open `https://<your-domain>/api/health`. It should answer `{"status":"ok"}`.
7. **Schedules**: add two schedules on the application that run a command inside the container:

   | Name | Cron | Command |
   |---|---|---|
   | deliver | `* * * * *` | `sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/deliver'` |
   | daily | `0 10 * * *` | `sh -c 'curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/daily'` |

   `deliver` sends queued email and push notifications. `daily` expires old plan snapshots, carries out account deletions whose grace period has ended, and queues date reminders. Run each once by hand and check for a JSON reply (a `401` means `CRON_SECRET` is missing or wrong in the container).
8. Sign in with an address from `ADMIN_EMAILS` and check `/admin/settings`.

Releases: redeploying keeps the database and `AUTH_SECRET`. Do not recreate the Postgres service between releases.

## Email and push

- **Resend**: verify a sending domain you control, create an API key, set `RESEND_API_KEY` and `EMAIL_FROM` (for example `Course Planner <planner@your-domain>`).
- **Push**: generate VAPID keys once and keep them. Changing them invalidates every existing push subscription. Students turn push on in Settings. Phones need the site installed to the home screen on iOS.

## Backups

Everything that matters is in Postgres. Turn on Dokploy's scheduled database backups to S3-compatible storage, or run `pg_dump` on a schedule and keep copies off the server. Test a restore before launch. Backups hold student records, so store them encrypted and delete them on the same schedule as the privacy policy promises.

## Security notes

- Every server action and route handler checks the role and ownership on the server. Hidden buttons are never the only guard.
- Staff roles come only from role grants for `@pascack.org` addresses, never from an email domain alone.
- Content Security Policy and other headers are set in `next.config.ts`. Why scripts still allow inline code is in `docs/DECISIONS.md`.
- Never commit real student data. Transcript fixtures in `fixtures/` are synthetic, and `docs/source/` is gitignored.
