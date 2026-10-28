# 01 Overview and stack

## What we are building

A web app where a student plans their four high school years of classes, tracks progress toward graduation, imports past courses from a transcript, checks eligibility for courses, and files placement appeals. Counselors and supervisors manage the catalog and review plans and appeals. Incoming 8th graders can use it to plan for high school.

Core features:

1. 4-year planner (grades 9 to 12) with multiple plans (Plan A, Plan B), drag and drop, half-year and full-year credit math.
2. Graduation requirement tracker (credits by subject, per-year minimums).
3. Transcript import (parsed in the browser) plus manual bulk add of past courses with year and grade.
4. Prerequisite and eligibility checker with locked pathways and a pathway graph.
5. Appeals (placement review requests) reviewed by department supervisors.
6. Submit a plan for counselor review with comments and approval.
7. Counselor dashboard (who is off track, course demand), and full catalog CRUD for counselors.
8. Intended major guidance, course selection timeline, print and PDF export.
9. Onboarding that teaches the basics, with a different path for 8th graders.
10. Notifications by in-app, email, and web push (PWA with VAPID).
11. Privacy policy, terms of service, data export, and delete-my-data requests.

No AI APIs. Everything is deterministic.

## Source files

Put these in `docs/source/` (gitignored, may contain personal data):

- `ProgramofStudies2026-2027_1.pdf` (78 pages). Source of truth for courses, prerequisites, credits, graduation rules, timeline, and pathway diagrams. Read it in page ranges (max 20 pages per read). The table of contents is near the front. Department sections: English, Social Studies, Mathematics (with Computer Science), Science, World Language, Art, Business Education, Family and Consumer Sciences, Health and PE, Music, Technology Education, Special Education, Other Programs. Printed page numbers differ from PDF page indexes, so verify.
- A sample Genesis transcript PDF, **for layout reference only**. Build a synthetic fixture with the same layout and fake data.

## Stack

- Next.js (App Router, TypeScript, server actions), Tailwind, shadcn/ui (Radix), Geist Sans and Geist Mono.
- Auth.js (next-auth v5) with the Google provider and the Prisma adapter, database sessions. Keep all auth code behind `src/lib/auth/` so it can be swapped later. Auth.js is now maintained by the Better Auth team, who recommend Better Auth for new projects. We are using Auth.js on purpose, so verify its current status and keep the abstraction thin.
- PostgreSQL with Prisma (see `docs/DECISIONS.md`: pinned to 7.10.1, driver adapter, config in `prisma.config.ts`).
- zod for validation, react-hook-form for forms, @dnd-kit for drag and drop, @xyflow/react (React Flow) with dagre layout for the pathway graph, Fuse.js for fuzzy matching, pdfjs-dist for client-side transcript parsing, web-push for push, Resend for email, vitest and Playwright for tests.
- Deploy on Dokploy (Docker, Traefik, Let's Encrypt). Postgres runs as a Dokploy database service.
