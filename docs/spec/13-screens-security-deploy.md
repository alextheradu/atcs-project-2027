# 13 Screens, security, environment, deployment

## Screens

- `/` landing with the age gate and sign-in
- `/onboarding/*` steps from `03-onboarding.md`
- `/dashboard` timeline widget, requirement summary, primary plan, pending appeals and notifications
- `/plans`, `/plans/[id]` the four-year planner with requirement rail and warnings
- `/courses`, `/courses/[slug]` browse and search with filters, eligibility badge, pathway links
- `/pathways` pathway graph
- `/import` transcript import and manual bulk add
- `/appeals`, `/appeals/new`, `/appeals/[id]`
- `/review` supervisor queue for appeals, counselor queue for plans
- `/counselor` dashboard (off-track students, course demand)
- `/admin/catalog`, `/admin/rules`, `/admin/users`, `/admin/timeline`, `/admin/appeal-questions`, `/admin/deletions`, `/admin/settings` (signup mode, allowed domains, requirement thresholds)
- `/settings` (notifications, linked emails, data export, delete my data)
- `/help`, `/privacy`, `/terms`, `/plans/[id]/print`

## Security checklist

- Server-side `requireRole()` and ownership checks everywhere. Test them.
- Validate every input with zod. Escape and length-limit all free text (appeal answers, comments).
- Strict security headers and a CSP. Secure, httpOnly cookies. CSRF protection from server actions plus origin checks on route handlers.
- Never log PII or full request bodies. Redact emails in logs.
- Cron routes require `CRON_SECRET`.
- Rate limits listed in `02-auth-roles.md`.
- Staff grants only for `@pascack.org` addresses.

## Environment variables

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST=true`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `SIGNUP_MODE_DEFAULT`, `RESEND_API_KEY`, `EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto), `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `CRON_SECRET`. `.env.example` exists. Generate VAPID keys with `npx web-push generate-vapid-keys`.

## Deployment (Dokploy)

- Multi-stage `Dockerfile`, Next.js `output: "standalone"`, run `prisma migrate deploy` in the entrypoint before starting.
- Postgres as a Dokploy database service on the internal network.
- Dokploy Schedules call the two cron routes with the `CRON_SECRET` header.
- Traefik with Let's Encrypt provides HTTPS (required for the service worker and push).
- Health check route `/api/health`.
