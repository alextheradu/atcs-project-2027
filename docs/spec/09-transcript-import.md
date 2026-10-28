# 09 Transcript import

Parse in the browser only. Send just the confirmed course rows to the server. Never upload the PDF, and never store or log DOB, state ID, student ID, address, or parent names.

- Use `pdfjs-dist` text items with x and y coordinates, because the transcript is a 2x2 grid of year blocks. Split items into quadrants, then group by line.
- Block header regex: `/^(\d{2})\s+(\d{4})-(\d{2})$/` gives grade level and school year.
- Course row regex anchored at the end of the line: `/^(.+?)\s+([A-DFPWI][+-]?)\s+(\d+\.\d{3})$/` gives title, final grade, and credits. Anchoring matters for titles that end in a letter, such as "AP Computer Science A" with grade "A".
- Rows with a title but no grade or credits are in progress. Import as `IN_PROGRESS` and take credits from the catalog.
- "Class of YYYY" fills grad year.
- Sanity checks: each block's total credits should equal the sum of its rows, and the cumulative total should equal the sum of the blocks. On mismatch, show a warning on the review screen. Do not block the import.
- Normalize titles (expand "Hon" to "Honors", "Eng" to "English", strip punctuation), then match in order: exact alias, exact catalog name, Fuse.js fuzzy match with a confidence score.
- Review screen: each parsed row with its best match, a confidence badge, and a dropdown to fix it. Nothing saves until the student confirms. When a student maps an unmatched title, save a `CourseAlias` so later imports match automatically (counselors can manage aliases).
- Archived and unmatched courses: allow mapping to an archived course, or skip the row.
- Also provide a manual bulk-add UI (search, year, grade). Set `PlanEntry.source` to `IMPORT` or `MANUAL`.
- Build a synthetic fixture PDF with the same layout and fake data for tests (`fixtures/`). Test the parser against it. Never commit a real transcript.
