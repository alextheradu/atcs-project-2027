# Phase 0: scaffold (DONE, awaiting owner checkpoint)

**Goal**: runnable Next app with design system, database, and test tooling.

**Built**: Next 16.4.3, Tailwind 4, Prisma 7.10.1 schema plus init migration (with the partial unique index), Docker Postgres, `.env.example`, tokens, `Button`/`Badge`/`StarBorder`, `/styleguide`, vitest and Playwright config.

**Remaining**
- [ ] Owner reviews `/styleguide` (run `npm run dev`, open `http://localhost:3100/styleguide`).
- [ ] Add `docs/source/` folder note. It is gitignored.
- [ ] Add app shell placeholder only when Phase 1 needs it.

**Verify**: `npm run typecheck && npm run lint && npm test && npm run build`.
