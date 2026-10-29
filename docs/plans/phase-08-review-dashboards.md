# Phase 8: plan review and dashboards

**Goal**: plan submission and review with comments, counselor dashboard, dashboard timeline widget, intended-major guidance.

**Read first**: `spec/08-review-dashboards.md`, `spec/05-planner-graduation.md` (intended major), `spec/07-appeals.md` (timeline).

## Tasks

1. Test first, `src/lib/plan-review/`: status transitions (`DRAFT` to `SUBMITTED` to `CHANGES_REQUESTED` or `APPROVED`, back to `DRAFT` edits after changes requested), read-only rule for submitted plans.
2. Submit, request changes, approve actions with role checks. Comments on plan or entry (length limited, escaped). Emit in-app notifications.
3. Counselor and admin read-only view of any student's plans. Counselors see all students (see `docs/DECISIONS.md`). Skip the filter-by-counselor control until caseloads exist.
4. `/counselor`: filter by grad year and counselor, off-track list (missing requirements, under credit minimums, using the Phase 3 requirement module), pending plan reviews, course demand (count only primary or submitted plans, per course, sortable).
5. Dashboard timeline widget with countdowns from `TimelineEvent` by audience.
6. Intended major guidance from the PDF college admission table, editable by admin, shown on the plan rail.
7. Authorization tests: student cannot approve, counselor cannot edit a student's plan, demand excludes non-primary draft plans.

## Verify

`npm test`. Seed several synthetic students and plans (fake data only) to check demand counts.

## Checkpoint

Counselor walkthrough with the owner.

## Done when

- [x] Demand numbers verified against seeded data.
- [x] Submitted plans uneditable by the student.

## Remaining for the checkpoint

- [ ] Counselor walkthrough with the owner.
