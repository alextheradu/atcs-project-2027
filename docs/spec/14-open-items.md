# 14 Open items to confirm with the owner

Track resolution status in `docs/STATUS.md`.

- Actual credits for honors science courses (a real transcript shows 6.000 for Honors Biology and Honors Chemistry).
- Which courses satisfy Visual/Performing Arts and 21st Century Life and Careers (provisional tags until a counselor confirms).
- American Studies credit split between English and social studies.
- The four sending-district email domains for 8th graders.
- Operator name and contact email for the privacy policy and terms, and school sign-off before real students use the app.
- Whether school Google Workspaces allow the OAuth client.
- Next cycle dates for course selection and the appeal window.

## Added in Phase 2 (catalog judgment calls)

- Which Social Studies electives, if any, count toward the 15 required Social Studies credits (only World History, U.S. History I and II, and American Studies are tagged).
- Whether the English electives (journalism, film, creative writing, public speaking) count toward the 20 English credits. They are untagged today.
- Applied Physics & Engineering: the PDF gives two different prerequisites (Algebra I, Chemistry). Confirm which is right, and that 5 of its 10 credits count toward physics.
- Credit values the PDF does not state: Satellite School, Virtual High School, Choir/Lunch (assumed 2.5), Teacher Assistant Program (2.5 or 5), and the special education courses with combined names (English 1-2 and 3-4, Math 1-2 and 3-4, Transition Education 1 and 2, Daily Living Skills 1 and 2).
- Elements of Financial Literacy: assumed half year, 2.5 credits, counts toward the financial literacy requirement.
- Grades offered for AP Drawing, AP 2-D and AP 3-D Art are not stated (assumed 11 and 12).
- The PDF labels History of Sport in America and An Introduction to the Analysis of Public Policy "Half-year elective - Honors". They are marked Honors level.
- Seton Hall dual enrollment is applied to IV, V and AP for all four languages.

## Added in Phase 4 (rule readings a supervisor should confirm)

Edit any of these in `/admin/rules`. Each is a reading call, not something the PDF states outright.

- **Placement exam on one branch or both.** Honors Algebra II with Trigonometry, AP Pre-Calculus, Pre-Calculus and AP Calculus AB all say "initial average of X in A; initial average of Y in B and proficiency on a placement exam". The exam is encoded on the second branch only.
- **Which courses count as "9th, 10th, 11th Grade English" and "10th Grade U.S. History".** Encoded as the whole core sequence of that grade (all levels). Electives and AP Capstone are not counted for English III and IV.
- **Do higher levels satisfy a prerequisite that names a college prep or enhanced course?** For example Statistics lists "Algebra II with Trigonometry or Enhanced". A student with Honors Algebra II with Trigonometry is not matched today.
- **8th grade Algebra I counts as Algebra I** for Algebra II with Trigonometry (all levels) and Chemistry, per the page 37 path diagram.
- **Geometry Enhanced:** "C+ in 8th grade Algebra I; B- in 8th grade math" is read as two alternatives, not both.
- **AP Statistics:** whether the B+ applies to Algebra II with Trigonometry Enhanced as well as College Algebra.
- **AP Biology and AP Chemistry:** "Honors Chemistry, Honors Physics" and "Honors Physics/AP Physics I" are read as either one.
- **Biology, Chemistry, Physics for Forensic Science:** any level of each counts.
- **Honors Geometry for students who did not take 8th grade Algebra I** shows as appealable (page 38 says students can move into honors later).
- **World language and English ladders** are drawn from course numbering. The PDF lists no formal prerequisite between language levels.
- **Applied Physics and Engineering** is a `manual` rule because the Science and Technology listings disagree.

## Added in Phase 5

- Real privacy policy and terms text, operator name and contact email. The seeded v1 documents are drafts with placeholders.
- Which world language the starter plan should suggest when an 8th grader gives none. It currently shows the first beginner course and says it is a guess.
- Appeal windows for incoming students (`TimelineEvent`, audience `INCOMING`). Until one exists, snapshots expire August 31.

