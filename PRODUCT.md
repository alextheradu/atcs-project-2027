# Product

## Register

product

## Users

High school students at Pascack Valley (grades 9 to 12) and incoming 8th graders planning their courses, usually on a laptop or phone in the evening, sometimes with a parent beside them. They are not experts: they want to know "will I graduate" and "can I take this class" without reading a 78 page PDF. Counselors and department supervisors use it at work on a desktop to see who is off track, which courses are in demand, and which placement appeals need a decision. Admins (the owner and teachers) manage roles, the catalog and settings.

## Product Purpose

An unofficial planning tool: build a four year course plan, track credits against graduation requirements, check which courses a student qualifies for, import past courses from a transcript, and file placement appeals. Counselors review plans and manage the catalog. Success is a student who understands exactly what is missing for graduation, and a counselor who can see the whole picture without opening a spreadsheet. It never claims to be an official placement. Everything is deterministic; no AI features.

## Brand Personality

Calm, precise, quietly confident. Three words: crisp, calm, trustworthy. The interface should feel like a well made tool from a small team that cares: sharp type, tight spacing, nothing decorative that does not mean something. One expressive element, the pill buttons with a hard lip and spring press, carries the personality. Voice is plain and direct, no exclamation marks, no "Oops", no marketing words.

## Anti-references

- Generic AI dashboards: everything in bordered rounded cards, three equal feature tiles, tinted pill badges, purple or blue gradients, glassy panels.
- Blue-tinted or navy surfaces. Surfaces are neutral black and charcoal only.
- Heavy shadows and big gradients on surfaces.
- School-district portal energy: dense grey tables, beige forms, clip art.
- Playful "student app" styling with mascots or confetti inside task screens.
- References for the feel: Vercel dashboard (flat, hairline rules, mono for data), Linear (dense, fast, restrained), Raycast and Arc (polish in the details). Sibling projects used as visual inspiration: `pioneersTeam1676/command` (quiet monochrome team app) and `hackclub/contd` (the source of the buttons).

## Design Principles

1. **The tool disappears into the task.** Familiar patterns (sidebar, breadcrumbs, lists, forms). Delight is saved for moments (sign-in, first plan, a finished requirement), not sprayed on every screen.
2. **Rules and whitespace, not boxes.** Structure comes from hairlines, alignment and spacing. A container needs a reason.
3. **Say what is true and what is guessed.** Anything unverified (self-reported grades, provisional requirement tags, assumed credits) is labeled as such where the student sees it. Warnings inform; only authorization and data integrity block.
4. **Color means something.** Neutral everywhere. Blue only marks things you can act on or the current selection. Green, yellow, orange and red are status and always mean the same thing; red is never a primary action.
5. **Fast beats fancy.** Interactions respond immediately. Motion is short, eased out, and never on repeated or keyboard driven actions.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Primary buttons use a dark label on the blue because white on `#338eda` fails contrast. Visible focus ring on every interactive element, full keyboard operation including drag and drop alternatives, a skip-to-content link. Respect `prefers-reduced-motion` (keep opacity changes, drop movement). Status is never conveyed by color alone (dot plus label). Students may be 13 to 18 and many use phones, so touch targets are at least 36px and layouts work at 360px wide. Plain language at roughly a 8th grade reading level.
