# Decisions

Settled choices and deviations from the original spec. Add a dated entry when you make a new one. Do not re-litigate without the owner.

## 2026-10-28

- **Prisma 7.10.1, not 8.** npm `latest` is 8.0 RC. We pin stable 7.10.1. Datasource URL lives in `prisma.config.ts`, generator is `prisma-client` with output `src/generated/prisma`, and the client uses `@prisma/adapter-pg`. Revisit when 8 is stable.
- **Dev port 3100.** Port 3000 is occupied by Dokploy on the dev machine. `npm run dev` and Playwright use 3100.
- **Local Postgres on 5433** via `docker-compose.yml` (user, password, db: `pascack` / `pascack` / `pascack_planner`).
- **Next 16 with `cacheComponents` and `partialPrefetching` on** (scaffold default). Dynamic data needs `<Suspense>`. If this fights us, turn it off and record it here.
- **Geist via the `geist` package**, not `next/font/google`, so builds work offline.
- **shadcn hand-wired** (`components.json`, `cn`, `Button`). Use the shadcn CLI to add further primitives.
- **Docs layout for agents.** `AGENTS.md` is the single source of truth (Codex reads it natively), `CLAUDE.md` imports it. Spec is split into `docs/spec/*`, the schema file is the data model source of truth. Plans per phase in `docs/plans/`.
- **Auth.js stays**, behind a thin `src/lib/auth/` layer, per the spec. Verify its current status when starting Phase 1.
- **Never `pkill`.** Stop own processes by port.
- **Counselors see all students for now.** No caseload model exists. The "filter by counselor" in the dashboard is deferred until the owner defines caseloads. Appeals "for their students" means all students. Changing this later needs a new assignment model and a revisit of Phase 7 and 8 authorization tests.
- **Dev sign-in stub allowed from Phase 1.** A credentials-style sign-in that exists only when `NODE_ENV !== "production"` and `DEV_AUTH=true`, so phases 3 to 8 can be verified without Google credentials. It must be compiled out or throw in production builds, and a test must assert that. Real Google flow is still the checkpoint for Phase 1.
- **Open-item defaults ship as flagged guesses**: honors science credits 5 (entry credits override), American Studies 5 plus 5, arts and life-careers tags provisional, example dates for timelines. Flag them in the UI where they affect totals.
- **Phase 1 may start before the owner approves `/styleguide`.** Token or component tweaks after review are cheap. Do not build large UI on top of unreviewed tokens beyond the app shell.
