import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";

const read = <T>(file: string): T => JSON.parse(readFileSync(path.resolve("prisma/seed", file), "utf8")) as T;

interface CourseSeed {
  slug: string;
  name: string;
  department: never;
  level: never;
  duration: never;
  credits: number;
  gradesOffered: number[];
  description: string;
  prereqText: string | null;
  dualEnrollmentNote: string | null;
  hasApExam: boolean;
  plannable: boolean;
  sourcePage: number | null;
  requirements: { kind: never; credits: number; provisional: boolean }[];
  interests: string[];
}

/**
 * Prerequisite rules and pathway edges are applied once per seed version. After that, admins own
 * them (rule builder, edge editor) and a re-seed must not bring back what they removed. Bump
 * `RULES_SEED` to apply a revised set; it only fills courses that have no rule yet.
 */
const RULES_SEED = "seed.rules.v1";

async function seedRules(): Promise<string> {
  if (await db.appSetting.findUnique({ where: { key: RULES_SEED } })) return "rules already seeded";
  const bySlug = new Map((await db.course.findMany({ select: { id: true, slug: true, rules: true } })).map((c) => [c.slug, c]));

  let ruleCount = 0;
  for (const r of read<{ slug: string; rules: object }[]>("rules.json")) {
    const c = bySlug.get(r.slug);
    if (!c) throw new Error(`rule target missing: ${r.slug}`);
    if (c.rules !== null) continue;
    await db.course.update({ where: { id: c.id }, data: { rules: r.rules } });
    ruleCount++;
  }

  let edgeCount = 0;
  for (const e of read<{ from: string; to: string; track: never; kind: never; appealable: boolean; note?: string }[]>("edges.json")) {
    const from = bySlug.get(e.from);
    const to = bySlug.get(e.to);
    if (!from || !to) throw new Error(`edge endpoint missing: ${e.from} -> ${e.to}`);
    await db.courseEdge.upsert({
      where: { fromId_toId: { fromId: from.id, toId: to.id } },
      create: { fromId: from.id, toId: to.id, track: e.track, kind: e.kind, appealable: e.appealable, note: e.note },
      update: {},
    });
    edgeCount++;
  }

  await db.appSetting.create({ data: { key: RULES_SEED, value: new Date().toISOString() } });
  return `${ruleCount} rules, ${edgeCount} edges`;
}

/**
 * Idempotent. Courses, tags and aliases are create-only so a re-seed never overwrites
 * edits a counselor made in the catalog admin.
 */
async function main() {
  const mode = process.env.SIGNUP_MODE_DEFAULT || "DOMAIN_ALLOWLIST";
  await db.appSetting.upsert({ where: { key: "signupMode" }, create: { key: "signupMode", value: mode }, update: {} });

  // Staff and current students. The four sending-district domains are added later by an admin.
  await db.allowedDomain.upsert({
    where: { domain: "pascack.org" },
    create: { domain: "pascack.org", cohort: "CURRENT", label: "Pascack students and staff" },
    update: {},
  });

  for (const r of read<{ kind: never; label: string; requiredCredits: number; notes: string }[]>("requirements.json")) {
    await db.requirementRule.upsert({ where: { kind: r.kind }, create: r, update: {} });
  }

  for (const t of read<{ slug: string; label: string }[]>("interest-tags.json")) {
    await db.interestTag.upsert({ where: { slug: t.slug }, create: t, update: {} });
  }

  let created = 0;
  for (const c of read<CourseSeed[]>("courses.json")) {
    if (await db.course.findUnique({ where: { slug: c.slug }, select: { id: true } })) continue;
    const { requirements, interests, ...data } = c;
    await db.course.create({
      data: {
        ...data,
        requirements: { create: requirements },
        interests: { connect: interests.map((slug) => ({ slug })) },
      },
    });
    created++;
  }

  let aliases = 0;
  for (const a of read<{ alias: string; courseSlug: string }[]>("aliases.json")) {
    const course = await db.course.findUnique({ where: { slug: a.courseSlug }, select: { id: true } });
    if (!course) throw new Error(`alias target missing: ${a.courseSlug}`);
    await db.courseAlias.upsert({ where: { alias: a.alias }, create: { alias: a.alias, courseId: course.id }, update: {} });
    aliases++;
  }

  const rules = await seedRules();
  console.log(`seed ok: ${created} new courses, ${aliases} aliases checked, ${rules}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
