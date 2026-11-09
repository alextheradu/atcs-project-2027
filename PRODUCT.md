# Product

## Register

product

## Users

High school students at Pascack Valley (grades 9 to 12) and incoming 8th graders planning their courses, usually on a laptop or phone in the evening, sometimes with a parent beside them. They are not experts: they want to know "will I graduate" and "can I take this class" without reading a 78 page PDF. Counselors and department supervisors use it at work on a desktop to see who is off track, which courses are in demand, and which placement appeals need a decision. Admins (the owner and teachers) manage roles, the catalog and settings.

## Product Purpose

An unofficial planning tool: build a four year course plan, track credits against graduation requirements, check which courses a student qualifies for, import past courses from a transcript, and file placement appeals. Counselors review plans and manage the catalog. Success is a student who understands exactly what is missing for graduation, and a counselor who can see the whole picture without opening a spreadsheet. It never claims to be an official placement. Everything is deterministic; no AI features.

## Brand Personality

Clear, calm, friendly. Three words: simple, clear, trustworthy. It should feel like a well made tool a student can use without help: one Board, plain sentences, nothing decorative that does not mean something. One expressive element, the contd sticker button (hard lip, lift and tilt, squish on press), carries the personality. Voice is plain and direct, no exclamation marks, no "Oops", no marketing words.

## Anti-references

- Generic AI dashboards: gradients, glows, dot grids, glass, tinted pill badges, big-number stat boxes, three equal feature tiles, a badge above the hero headline.
- Hairline separators between every row, and mono fonts for labels and numbers (the previous "ledger" look).
- Warm brown-black or navy surfaces.
- Too many pages and menu items. Students get two places; everything else comes to them in context.
- School-district portal energy: dense grey tables, beige forms, clip art.
- Playful "student app" styling with mascots or confetti inside task screens.
- References for the feel: BetterCanvas dark mode (neutral charcoal), Vercel, Supabase, Railway, Render and memeity (clean dev-tool layouts), and `hackclub/contd` (the source of the buttons).

## Design Principles

1. **One Board answers "will I graduate".** Subjects down the side, grades across the top, empty spots for what is missing. A student should never have to open a menu to find out what they still need.
2. **Space and soft fills, not lines and boxes.** Structure comes from spacing and one step of fill. A container needs a reason.
3. **Say what is true and what is guessed.** Anything unverified (self-reported grades, unconfirmed requirement tags, assumed credits) is labeled as such where the student sees it. Warnings inform; only authorization and data integrity block.
4. **Color means something.** Neutral everywhere. Blue only marks things you can act on or the current selection. Subject colors only mark classes. Green, yellow, orange and red are status and always mean the same thing; red is never a primary action.
5. **Fast beats fancy.** Interactions respond immediately. Motion is short, eased out, and never on repeated or keyboard driven actions.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Primary buttons use a white label on `#2f6fe4` (about 4.6:1); blue text on the page uses the lighter `#7aa5ff`. Visible focus ring on every interactive element, full keyboard operation including drag and drop alternatives, a skip-to-content link. Respect `prefers-reduced-motion` (keep opacity changes, drop movement). Status is never conveyed by color alone (dot plus label). Students may be 13 to 18 and many use phones, so touch targets are at least 36px and layouts work at 360px wide. Plain language at roughly a 8th grade reading level.
