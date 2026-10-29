# Phase 7: appeals

**Goal**: placement review requests end to end with per-department questions, supervisor queue, windows, and plan overrides on approval.

**Read first**: `spec/07-appeals.md`, `spec/06-eligibility-pathways.md`, `spec/02-auth-roles.md` (supervisor scoping).

## Tasks

1. Test first, `src/lib/appeals/`: status machine (`DRAFT` to `SUBMITTED` to `UNDER_REVIEW` to `APPROVED` or `DENIED`, `WITHDRAWN` before a decision), window check (`STUDENT` any time, `INCOMING` only inside an open `APPEAL_WINDOW` for their audience), next-open-date helper, department scoping for reviewers.
2. Seed default `AppealQuestion` set (six questions from the spec), editable per department.
3. `/appeals/new?course=...`: shows the requirement against the entered grade with a clear warning below the cutoff, still allows proceeding, snapshots unmet rules into `unmetRules`, collects self-reported average, snapshots question prompts into `AppealAnswer`. Drafts allowed outside the window.
4. `/appeals` and `/appeals/[id]`: student view, edit while draft, withdraw.
5. `/review` supervisor queue: only appeals whose course department is in the supervisor's `departments`. Admins any. Counselors read only for their students. Self-reported values marked as such. Decision note required.
6. Approval sets `PlanEntry.overrideAppealId` where an entry exists, and the eligibility checker shows "Approved via appeal".
7. `/admin/appeal-questions` and `/admin/timeline` (create next cycle windows and dates, seed the 2026 dates as labeled examples).
8. Emit notification events on submit and decision (delivery is Phase 9, record the in-app `Notification` now).
9. Rate limit submissions. Authorization tests: wrong-department supervisor rejected, student cannot decide, student cannot read another's appeal, INCOMING outside window rejected on submit but draft saved.

## Verify

`npm test`. Manual: submit and decide an appeal end to end.

## Checkpoint

Owner submits as a student and decides as a supervisor.

## Done when

- [x] Window rules and department scoping fully tested.
- [x] No hardcoded dates.
- [x] Approved appeal visibly overrides the warning.

## Remaining for the checkpoint

- [ ] Owner submits as a student and decides as a supervisor.
