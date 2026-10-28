# Pascack Course Planner: design

## Intent

A high schooler wants to plan four years of classes without guessing whether they will graduate or qualify for the next course. Counselors and department supervisors want the same facts in one place: who is off track, what courses are in demand, and who is asking to move up a level. Incoming 8th graders want to see what high school could look like before they pick classes.

The owner is a student building this as an unofficial project. It is not affiliated with the school district and never presents itself as an official placement tool. The school decides real placements from real records. The app is a planning aid.

## Why this document exists

The full product spec already exists (`docs/SPEC.md` and `docs/spec/*`) and Phase 0 is built. The owner's main worry is the repo itself: the spec was not in it, and it was not set up for AI agents. The owner will use Claude Code and possibly Codex. So this design is about how the project is run as much as what it builds. A fresh agent in either tool must be able to pick up any phase cold and do it correctly.

## Goals

- Build the product described in `docs/spec/*`, in twelve phases (0 to 11), stopping at an owner checkpoint after each.
- Make the repo agent-ready: one rules file both tools read, a spec split by topic, one plan per phase with exact verify commands, a status tracker, and a decisions log.
- Keep everything deterministic. No AI APIs in the product.
- Protect students: never store birthdate, student ID, state ID, parent info, or transcript files. Parse transcripts in the browser only.

## Non-goals

- Not an official school system. No district branding or logo.
- No automatic course placement. The app suggests and checks, humans decide.
- No retakes of a course within a plan (for now).
- No middle school program data. 8th graders get suggestions from self-reported info only.
- No AI features.

## Anti-goals (a failure even if it technically works)

- A student sees "you are placed in X" instead of "likely a fit" or "worth considering".
- Staff roles granted from an email domain, or any authorization that exists only in the UI.
- A real student's data appears in the repo, fixtures, logs, or tests.
- An eligibility rule that cannot be traced to the Program of Studies PDF.
- A docs set so long that agents load all of it every time.

## Constraints

- Stack: Next.js 16 (App Router), Tailwind 4, Prisma 7.10.1 with `@prisma/adapter-pg`, Auth.js v5 beta behind `src/lib/auth/`, PostgreSQL, deployed on Dokploy behind Traefik. Details and reasons in `docs/DECISIONS.md`.
- Design is dark only with neutral surfaces and blue only on interactive elements (`docs/spec/12-design-system.md`).
- Writing style: natural, concise, no em dashes anywhere.
- The dev machine already uses port 3000, so the app runs on 3100. Never use broad process kills.
- Inputs only the owner can provide: the Program of Studies PDF (Phase 2), a layout-reference transcript (Phase 6), Google OAuth credentials (Phase 1), Resend key and sending domain (Phase 9), and the seven open items in `docs/spec/14-open-items.md`.

## Decisions made with the owner

- `AGENTS.md` is the single source of truth. `CLAUDE.md` imports it. Codex reads `AGENTS.md` natively.
- Spec split into 14 topic files plus an index. The Prisma schema is the data model source of truth, not a copy in the docs.
- One plan file per phase, in `docs/plans/`, written to run cold. Test-first for pure logic (eligibility, credits, requirements, transcript parsing, matching, appeals status, deletion) and an authorization test for every server action.
- Work happens one phase at a time with a stop at each checkpoint, as in the original spec.

## Decisions made by the builder (my calls)

- Prisma pinned to 7.10.1 because `latest` is an 8.0 release candidate.
- Dev port 3100, local Postgres on 5433.
- Keep Next's generated warning block in `AGENTS.md` unchanged so `next dev` does not keep rewriting the file.
- Phases 5, 6, 7 may run in parallel in separate git worktrees after Phase 4. Everything else is sequential.
- Commits happen only when the owner asks.

## Left to the builder

- Exact file and module layout inside each phase, as long as pure logic stays in `src/lib/<name>/` with no framework imports.
- UI details inside the design rules.
- Whether to use the shadcn CLI for new primitives.
- Test data design (synthetic only).

## Success

The owner can hand any phase file to a fresh Claude Code or Codex session and get a correct, tested result that stops at the checkpoint. At the end, a student can sign in, import a transcript, build and submit a plan, appeal a placement, and delete their data, and a counselor can see who is off track.
