# 06 Eligibility engine and pathways

Store prerequisites as structured rules in `Course.rules` (JSON), alongside the verbatim `prereqText`. Implement as a pure TypeScript module `src/lib/eligibility/` shared by client and server, with unit tests.

## Rule tree nodes

- `all: [...]`, `any: [...]`
- `completed { courses: [slug...] }`
- `minGrade { course: slug | courses: [slug...], grade: "B+", basis: "initialAverage" | "final" }`
- `gradeLevel { in: [10,11,12] }`
- `coreq { courses: [slug...], timing?: "sameYear" | "sameOrEarlier" }`: any listed course satisfies it. `sameYear` requires the same grade year, including completed coursework in that year. Omitted timing keeps the existing same-year-or-earlier behavior. New rules default to `sameYear` in the editor. AP Microeconomics and AP Macroeconomics are a same-year pair.
- `priorCoursework { field: "eighthMath", value: "ALGEBRA_I" }` (for middle school math)
- `manual { label: "Placement exam proficiency" }` (cannot be checked automatically)
- Any leaf can set `appealable: true | false` (default true) and a human `note`.

Result per course: `ELIGIBLE`, `ELIGIBLE_WITH_WARNING` (for example "you have a B+, this needs an A"), `NOT_ELIGIBLE_APPEALABLE`, `NOT_ELIGIBLE_LOCKED`, plus the per-leaf breakdown so the UI can explain exactly what is missing. `manual` leaves show as visible notes and do not pass or fail.

Important: the PDF thresholds use "initial test/quiz average", but we only have final grades from transcripts. Compare against the entered grade as an approximation, label it as such, and have the appeal form collect a self-reported average.

Example from the PDF, Honors Algebra II with Trigonometry: an initial test/quiz average of B or higher in Honors Geometry, or an A in Geometry Enhanced and Algebra I Enhanced, plus proficiency on a placement exam, plus supervisor and teacher recommendation. Encode as `any[ minGrade(honors-geometry, B), all[ minGrade(geometry-enhanced, A), minGrade(algebra-i-enhanced or priorCoursework ALGEBRA_I, A) ] ]` plus `manual` leaves. The PDF's punctuation leaves it unclear whether the placement exam applies to both branches, so encode it as a `manual` leaf on the second branch and flag it for a supervisor to confirm. Write tests from several PDF examples across math, science, CS, English, and world language. Do not encode a rule you cannot trace to the PDF. Leave it as free text and a `manual` leaf.

## Pathways

`CourseEdge` rows connect courses per track (MATH, SCIENCE, COMPUTER_SCIENCE, WORLD_LANGUAGE, ENGLISH, SOCIAL_STUDIES). `kind` is `STANDARD` (the normal next step) or `ADVANCE` (moving up a level, needs an appeal if the criteria are not met). Derive edges from the pathway diagrams in the PDF (math, computer science, and science "typical paths") and the prerequisite text, with the prerequisite text as the source of truth.

- Skipping a step (for example Geometry straight to Calculus) is `locked`.
- Moving up a level within a step (for example Geometry Enhanced to Honors Algebra II) is `appealable`.
- Two math starting points exist: Algebra I in middle school (Honors Geometry or Geometry Enhanced, then Algebra II tracks, Pre-Calculus or AP Pre-Calculus, then Calculus) and Pre-Algebra in middle school (Geometry Enhanced or Geometry, Algebra I Enhanced or Algebra I, Algebra II tracks, AP Statistics or Pre-Calculus, with College Algebra, Statistics, and Discrete Math as electives). Computer science runs Intro to CS and App Development, Honors CS, AP CS A, Advanced Topics in CS (Honors).
- Pathway graph view (React Flow): the student's completed courses, open next steps, appealable moves (dashed), and locked moves. Clicking a node shows requirements and a "Request placement review" button where applicable.

Admins and supervisors can edit rules and edges in an admin UI (a simple rule builder, not raw JSON).
