# 07 Appeals (placement review)

Mirrors the PDF's Placement Review Request Form process: students who do not meet prerequisites can ask the department supervisor to review. Supervisors decide, not counselors.

## Flow

1. Student opens a course they do not qualify for and clicks "Request placement review".
2. The form shows the requirement against their entered grade, with a clear warning if they are below the cutoff, and still lets them proceed. It snapshots the unmet rules into `Appeal.unmetRules`.
3. Questions (stored in `AppealQuestion`, editable per department by supervisors and admins). Defaults: Why do you want this course? What is your current test/quiz average in the prerequisite? Did you take the placement exam, and what was the result? Has your teacher recommended it? How will you handle the added workload? Do your parents or guardians know about this request? Answers are stored as `AppealAnswer` rows with the prompt text snapshotted.
4. Status flow: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `DENIED`, `WITHDRAWN`. Students can edit while draft and withdraw before a decision.
5. Reviewers are `SUPERVISOR`s whose `departments` include the target course's department. Admins can review any. Counselors can view appeals for their students (read only). Reviewers add a decision note.
6. An approved appeal sets `PlanEntry.overrideAppealId`, and the eligibility checker then shows "Approved via appeal" instead of a warning.
7. Notifications on submit (to supervisors of that department) and on decision (to the student).

## Windows

Current students (`STUDENT`) can submit appeals any time. Incoming 8th graders (`INCOMING`) can only submit inside an open `TimelineEvent` of kind `APPEAL_WINDOW` for their audience. Outside the window the button shows the next open date and they can still save a draft. All dates are admin-editable. Do not hardcode dates: the PDF's 2026 dates (semester 1 grades due February 6, course selection February 9 to March 27, level-change forms due March 2, decisions by June 19) are for the previous cycle. Seed them as examples with `schoolYear` labels and let admins create the next cycle.
