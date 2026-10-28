# Phase 6: transcript import

**Goal**: browser-side transcript parsing, matching, review screen, aliases, manual bulk add.

**Read first**: `spec/09-transcript-import.md`, `spec/04-catalog.md` (alias and honors pitfalls).

**Inputs needed**: a real transcript for layout reference only, never committed. Ask the owner to describe or place it in `docs/source/` (gitignored).

## Tasks

1. `fixtures/`: generate a synthetic transcript PDF with the same 2x2 year-block layout and fake data. Script in `scripts/make-fixture-transcript.ts`. Include a title ending in a letter ("AP Computer Science A" grade "A"), an in-progress row, and a deliberate block total mismatch variant.
2. Test first, `src/lib/transcript/parse.ts`: input is pdfjs text items with x and y, output is blocks and rows. Split into quadrants, group by line, header regex `/^(\d{2})\s+(\d{4})-(\d{2})$/`, end-anchored row regex `/^(.+?)\s+([A-DFPWI][+-]?)\s+(\d+\.\d{3})$/`, in-progress rows, "Class of YYYY", block and cumulative sanity checks as warnings (never blocking). It must not read, keep, or log DOB, state ID, student ID, address, or parent names.
3. pdfjs-dist glue (client only, worker configured for Next 16 bundling). The PDF is never uploaded.
4. Test first, `src/lib/transcript/match.ts`: normalize titles (Hon to Honors, Eng to English, strip punctuation), match order alias, exact name, Fuse fuzzy with confidence. Thresholds documented and tested.
5. `/import` review screen: row, best match, confidence badge, fix dropdown, map to archived course, skip row. Nothing saves until confirm. Confirm sends only the course rows to a server action (zod validated, rate limited, ownership checked). Saves aliases for manual mappings. Entries get `source: IMPORT`, `COMPLETED` or `IN_PROGRESS`, entered credits.
6. Manual bulk add: search, year, grade, `source: MANUAL`.
7. Counselor alias management in `/admin/catalog`.
8. Tests: parser against the fixture, matching table tests, server action rejects another user's plan and oversized payloads.

## Verify

`npm test`. Manual: import the fixture, then (owner, locally) a real transcript.

## Checkpoint

Owner imports a transcript locally and checks the result.

## Done when

- [ ] Network tab shows no PDF upload.
- [ ] No PII fields in parser output types.
- [ ] Aliases improve a second import.
