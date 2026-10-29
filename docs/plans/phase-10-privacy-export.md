# Phase 10: privacy, export, print

**Goal**: final policy drafts, delete-my-data with grace period, JSON export, print stylesheet, help page.

**Read first**: `spec/11-privacy.md`, `spec/12-design-system.md` (print rule).

**Inputs needed**: operator name and contact email (placeholders until the owner answers). Note in the pages that school or teacher review is required before real students use the app.

## Tasks

1. `/privacy` and `/terms` rendered from `PolicyDocument` (v-next drafts). Cover everything the spec lists, with placeholders and a clear "draft, not legal advice" banner. Bump the version so Phase 5 acceptance re-prompts.
2. Test first, `src/lib/deletion/`: state machine (`AWAITING_CONFIRMATION` to `SCHEDULED` with a 14 day grace, cancelable, then `COMPLETED`), email hash only, guardian-source requests.
3. Settings flow: request, confirmation email via `notify()`, scheduled notice, cancel. Daily cron performs the delete in a transaction: user, profile, plans, entries, appeals and answers, snapshot, linked emails, sessions, accounts, push subscriptions, preferences. Anonymize `AuditLog` actor labels and appeal `decidedBy` to "deleted user". Deleting staff reassigns or anonymizes review history. `/admin/deletions` shows pending.
4. Test deletion completeness: after delete, no row anywhere references the user id or email, audit rows remain anonymized, `DeletionRequest` keeps only the hash.
5. Data export: JSON of everything stored about the user, rate limited, own data only. Test it includes every user-owned table and excludes other users' data.
6. `/plans/[id]/print`: white background, black text (intentional exception), plan name, grade columns, credits, requirement summary, "self-reported, unofficial" footer. Browser Save as PDF first.
7. `/help` replays the onboarding explainers (shared module from Phase 5).

## Verify

`npm test`. Manual: delete and export a test account.

## Checkpoint

Owner deletes and exports a test account.

## Done when

- [x] Deletion and export tests cover every user-related table (add a test that fails when a new user-owned model is not handled).
- [x] Print view is black on white and fits one page per plan where possible.
