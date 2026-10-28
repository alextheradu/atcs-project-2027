# 08 Plan review and counselor dashboard

- A student can submit a plan for review. Status: `DRAFT`, `SUBMITTED`, `CHANGES_REQUESTED`, `APPROVED`. Submitted plans are read-only. Counselors can comment (on the plan or a specific entry), request changes, or approve.
- Counselors and admins have a read-only view of any student's plans.
- Counselor dashboard: filter by grad year and counselor, list students off track for graduation (missing requirements, under credit minimums), pending plan reviews, and **course demand** (how many students planned each course, counting only primary or submitted plans) to help with enrollment decisions, since the PDF says the administration may cancel courses with insufficient enrollment.
- Catalog admin (counselors and admins): add, edit, archive courses, edit requirement tags, interest tags, rules, edges, and aliases. "Delete" archives by default. A hard delete is blocked if any plan entry references the course. Every change is written to `AuditLog` with before and after. CSV import and export of the catalog.
