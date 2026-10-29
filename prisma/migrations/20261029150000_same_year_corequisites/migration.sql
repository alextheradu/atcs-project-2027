-- Upgrade only untouched seeded economics rules. Preserve staff edits and cleared rules.

UPDATE "Course"
SET "rules" = "rules" || '{"timing":"sameYear"}'::jsonb
WHERE "slug" = 'ap-microeconomics'
  AND "rules" = '{"type": "coreq", "courses": ["ap-macroeconomics"], "note": "The PDF says students must also take AP Macroeconomics."}'::jsonb;

UPDATE "Course"
SET "rules" = "rules" || '{"timing":"sameYear"}'::jsonb
WHERE "slug" = 'ap-macroeconomics'
  AND "rules" = '{"type": "coreq", "courses": ["ap-microeconomics"], "note": "Taken as a pair with AP Microeconomics (p26)."}'::jsonb;
