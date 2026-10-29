# Phase 9: notifications and PWA

**Goal**: reliable in-app, email, and push delivery through an outbox and cron routes, plus an installable PWA.

**Read first**: `spec/10-notifications.md`, `spec/13-screens-security-deploy.md` (cron, CSP).

**Inputs needed**: `RESEND_API_KEY` and a sending domain with SPF and DKIM (not a school address). VAPID keys from `npx web-push generate-vapid-keys`. A real phone for the checkpoint.

## Tasks

1. Test first, `src/lib/notify/`: `notify(userId, kind, payload)` creates the `Notification`, reads `NotificationPreference` (defaults: in-app on, email on for decisions, push off), creates `NotificationDelivery` rows per enabled channel. Retry backoff function tested (attempts, `nextAttemptAt`, give up after N).
2. Replace Phase 7 and 8 direct notification writes with `notify()`. Cover all kinds in the spec.
3. `POST /api/cron/deliver`: checks `CRON_SECRET` (constant-time compare), claims due rows safely (no double send under concurrent calls), sends email via Resend and push via `web-push`, records status and errors, deletes a `PushSubscription` on 404 or 410. Redact emails in logs.
4. `POST /api/cron/daily`: expire snapshots (null the snapshot fields past `snapshotExpiresAt`), process due deletions (Phase 10 hooks), timeline reminders.
5. In-app notification bell and list, mark read. Preferences UI in `/settings`.
6. PWA: `src/app/manifest.ts`, `public/sw.js` caching only the static shell, never API or student data, install prompt, iOS Add to Home Screen note (push needs iOS 16.4 or later). Subscribe flow stores `PushSubscription`.
7. Tests: cron rejects missing or wrong secret, delivery claims are exclusive, 410 removes subscription, preferences respected.

## Verify

`npm test`. Manual: trigger an appeal decision and receive an email and a push on a real device.

## Checkpoint

Owner receives an email and a push on a real device.

## Done when

- [x] Service worker cache holds no API responses.
- [x] Failed sends retry then stop.
- [x] Cron routes unreachable without the secret.

## Remaining for the checkpoint

- [ ] Owner sets `RESEND_API_KEY`, `EMAIL_FROM` and production VAPID keys, then receives an email and a push on a real device.
