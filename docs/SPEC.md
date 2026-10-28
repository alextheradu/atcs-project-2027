# Pascack Course Planner: spec index

Unofficial student project, not affiliated with Pascack Valley Regional High School District. The spec is split by topic so an agent loads only what its phase needs. The Prisma schema is the source of truth for the data model: `prisma/schema.prisma`.

| File | Covers |
|---|---|
| `spec/01-overview-stack.md` | Features, source PDFs, stack |
| `spec/02-auth-roles.md` | Roles, signup modes, grants, linked emails, rate limits |
| `spec/03-onboarding.md` | Age gate, onboarding steps, 8th grade snapshot |
| `spec/04-catalog.md` | Catalog seeding, data pitfalls |
| `spec/05-planner-graduation.md` | Planner behavior, graduation requirements |
| `spec/06-eligibility-pathways.md` | Rule tree, eligibility results, pathway graph |
| `spec/07-appeals.md` | Appeal flow and windows |
| `spec/08-review-dashboards.md` | Plan review, counselor dashboard, catalog admin |
| `spec/09-transcript-import.md` | Browser-side transcript parsing and matching |
| `spec/10-notifications.md` | In-app, email, push, cron workers |
| `spec/11-privacy.md` | Policies, deletion, export |
| `spec/12-design-system.md` | Visual rules, buttons, print, timeline, help |
| `spec/13-screens-security-deploy.md` | Route list, security checklist, env, Dokploy |
| `spec/14-open-items.md` | Questions only the owner can answer |

Also read: `docs/DECISIONS.md` (choices that deviate from or refine this spec), `docs/STATUS.md` (where we are), `docs/plans/` (one file per build phase).
