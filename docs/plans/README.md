# Phase plans

One file per phase. Each is written so a fresh agent session can pick it up cold: read `AGENTS.md`, `docs/STATUS.md`, then the phase file and only the spec files it lists.

## Template every phase follows

- **Goal**: one sentence.
- **Read first**: spec files and code to read.
- **Inputs needed**: things only the owner can provide.
- **Tasks**: ordered, each small enough to verify. Logic tasks are test-first.
- **Verify**: exact commands and manual checks.
- **Checkpoint**: what to demo to the owner. Stop there.
- **Done when**: checklist. Then update `docs/STATUS.md`.

## Definition of done for any task

`npm run typecheck && npm run lint && npm test` pass, new server actions and routes have an authorization test, no em dashes, no real student data, UI matches `/styleguide` rules.

## Order and dependencies

```
0 scaffold
1 auth ──┬─ 2 catalog ── 3 planner ── 4 eligibility ──┬─ 5 onboarding
         │                                            ├─ 6 transcript import
         │                                            └─ 7 appeals ── 8 review/dashboards
         └─ 9 notifications (needs 7 and 8 events) ── 10 privacy/export ── 11 ship
```

Phases 5, 6, 7 can run in parallel after 4 if agents use separate git worktrees, since they touch mostly separate files. Shared files to watch: `prisma/schema.prisma` (migrations), `src/lib/auth/`, the sidebar nav.
