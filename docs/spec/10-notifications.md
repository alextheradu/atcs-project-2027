# 10 Notifications

- `Notification` is the in-app record. `NotificationDelivery` is the outbox (channel, status, attempts, next attempt time, last error) so failed sends retry.
- Kinds: appeal submitted, appeal assigned, appeal decided, plan submitted, plan changes requested, plan approved, plan comment, role changed, deletion confirmation, deletion scheduled, timeline reminder, system.
- Channels: in-app, email, push. Per-user, per-kind preferences (`NotificationPreference`). Email is on by default for decisions.
- Email via Resend, sent from a domain the owner controls (set SPF and DKIM). Do not send from a school address.
- Worker: a protected route `POST /api/cron/deliver` (checks `CRON_SECRET`) that Dokploy Schedules calls every minute, and `POST /api/cron/daily` for expiring snapshots, processing deletions, and timeline reminders.
- Push: PWA with `app/manifest.ts`, `public/sw.js`, an install prompt, and `web-push` with VAPID keys. Store each `PushSubscription` (endpoint, p256dh, auth, user agent). Delete a subscription on a 404 or 410 response. The service worker caches only the static app shell, never API responses or student data.
