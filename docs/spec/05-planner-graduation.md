# 05 Planner and graduation tracker

## Planner

- A user can have several `Plan`s. Exactly one is primary. Enforced by the partial unique index `one_primary_plan_per_user` (already in the init migration).
- `PlanEntry` places a course in a grade level (9 to 12). Placement is by grade level only, not by semester. A half-year course counts 2.5 credits; two half-year courses fill one slot's worth of credits.
- Entry status: `PLANNED`, `IN_PROGRESS`, `COMPLETED`. Completed entries can store a letter grade. `credits` on the entry is the credit actually counted (defaults from the course, overridable by transcript import).
- A course can appear once per plan (no retakes for now).
- Warnings (never blocks): fewer than 30 credits in a year, fewer than 25 in senior year, more than a sensible number of full-year courses for one year (default 8 periods, configurable), missing coreqs, unmet prereqs.
- Clone plan, rename, set primary, delete. Submitted plans are read-only.
- Layout: four grade columns, course cards, add-course dialog with search and filters (department, level, credits, duration, grade offered, interests), drag between columns, requirement meters in a right rail.

## Graduation tracker

Measure everything in credits. Seed `RequirementRule`:

| Kind | Required credits | Source |
|---|---|---|
| ENGLISH | 20 | 4 years of English |
| PE_HEALTH | 20 | 4 years of PE and Health |
| MATH | 15 | 3 years |
| SCI_BIO | 5 | Biology |
| SCI_CHEM | 5 | Chemistry |
| SCI_PHYS | 5 | Physics |
| SOCIAL_STUDIES | 15 | World History, US History I and II |
| ARTS | 5 | 1 year Visual/Performing Arts |
| LIFE_CAREERS | 5 | 1 year 21st Century Life and Careers |
| FIN_LIT | 2.5 | half year |
| WORLD_LANG | 10 | 2 years |

Also: 120 total credits to graduate, at least 30 credits scheduled per year, at least 25 credits in the final year, the state assessment requirement (informational only). Show per-requirement progress, split into completed vs planned, with a clear "what's missing" list. All thresholds are admin-editable.

Intended major guidance (from the PDF's college admission table, admin-editable): English 4 years; math 3 years, 4 for math, science, and engineering majors; social studies 3 to 4; science 3 years, 4 for science, health care, and engineering majors; world language 2 to 4 with a concentration in one language.
