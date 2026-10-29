# Pascack Course Planner

Unofficial student web app: 4-year course planner, graduation tracker, eligibility checker, placement appeals, counselor tools. Not affiliated with Pascack Valley Regional High School District. No AI APIs, everything deterministic.

Single source of truth for every agent (Claude Code, Codex, others). `CLAUDE.md` just imports this file.

## Start here

1. Read `docs/STATUS.md`: current phase, what is done, open items.
2. Read the phase file in `docs/plans/` for the phase you are working on. It lists which `docs/spec/*` files to read. Do not read the whole spec.
3. Read `docs/DECISIONS.md` before changing the stack, versions, or conventions.
4. Do one phase at a time. Stop at the phase's checkpoint and report to the owner. Update `docs/STATUS.md` when you finish.

## Commands

```bash
docker compose up -d                 # local Postgres on localhost:5433
npm run dev                          # http://localhost:3100 (3000 is used by Dokploy on this machine)
npm run typecheck && npm run lint && npm test   # run before claiming anything is done
npm run e2e                          # Playwright
npx prisma migrate dev               # apply and create migrations
npx prisma generate                  # client goes to src/generated/prisma (gitignored)
npm run db:seed
```

Do not run `next build` while `npm run dev` is up (dev starts reloading pages forever; stop dev, delete `.next/dev`, restart). Never run `pkill` or broad process kills. This machine runs other services. Stop your own server by port: `fuser -k 3100/tcp`.

## Hard rules

- **No em dashes anywhere**: copy, comments, docs, commits, UI. Use commas, periods, or colons. Natural, concise writing.
- **Never commit real student data.** No real transcript, DOB, student ID, state ID, or parent info in the repo, seeds, fixtures, or tests. The transcript fixture is synthetic.
- **Never use the school logo or district branding.**
- **Authorization is server-side**: every server action and route handler calls `requireRole()` plus ownership checks (`where: { ownerId: session.user.id }`). Hiding buttons is not security. Add a test for each.
- **Staff roles never come from email domain.** Only `RoleGrant` rows, only `@pascack.org` addresses.
- Validate all input with zod. Length-limit free text. Never log PII or full request bodies.
- Do not encode an eligibility rule you cannot trace to the Program of Studies PDF. Use a `manual` leaf.
- Do not guess the sending-district email domains.
- Warnings never block the student. Only authorization and data integrity block.

## Conventions

- Next.js 16 is newer than most training data. Before using a Next API you are unsure about, read `node_modules/next/dist/docs/`. Same for Auth.js, Prisma 7, Tailwind 4: check installed types or docs first.
- All auth code lives behind `src/lib/auth/` (thin, swappable). Prisma client is `src/lib/db.ts`.
- Pure logic (eligibility, credit math, requirement tracking, transcript parsing, matching) lives in `src/lib/<name>/` with no framework imports and has vitest tests. Write the tests first for these.
- Read `PRODUCT.md` and `DESIGN.md` (repo root) before any UI work. Dark theme only, tokens in `src/app/globals.css`, rules in `docs/spec/12-design-system.md`. Backgrounds are neutral (equal R, G, B). Blue only on interactive elements. No cards: use `PageHeader`, `Section`, `Dl`, `.list` rows, `Badge`, `StarBorder`, `.input` (see the layout language in the design doc). Check `/styleguide`.
- Geist Mono for course codes, credits, grades, dates.
- Editable input uses `useDraftState` under the signed-in `DraftProvider`, keyed by resource, so reloads and deployments preserve unsaved work. Clear only the revision the server acknowledged with `draft.commit(submitted)`; retain newer typing and failed saves. Use `useState` for temporary UI such as expanded rows. See `docs/deployments.md`.
- Credits are `Decimal`. Never use floating point for credit math (use a decimal or integer tenths helper).
- Commit only when the owner asks. Small, focused commits when asked.

## Map

```
docs/SPEC.md            index of the spec (docs/spec/*)
docs/DECISIONS.md       deviations and settled choices
docs/STATUS.md          progress tracker and open items
docs/plans/             one plan per build phase
docs/source/            PDFs, gitignored, may hold personal data
prisma/schema.prisma    data model, source of truth
prisma/seed/            seed data (courses.json etc.)
scripts/                one-off tools (catalog extraction)
fixtures/               synthetic test data only
src/lib/                domain logic and server helpers
src/components/ui/      design system components
e2e/                    Playwright tests
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
