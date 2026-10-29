"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CSV_COLUMNS, courseToRow, parseCsv, rowToCourseInput, serializeCsv, type CourseRecord } from "./csv";
import { normalizeTitle } from "./normalize";
import { aliasSchema, courseInputSchema, type CourseInput } from "./schemas";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
const fail = (error: string): ActionResult => ({ ok: false, error });

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_CSV_ROWS = 1000;

const editor = () => requireRole("COUNSELOR", "ADMIN");

const include = { requirements: true, interests: { select: { slug: true } } } as const;

type CourseWithRelations = NonNullable<Awaited<ReturnType<typeof loadCourse>>>;
const loadCourse = (id: string) => db.course.findUnique({ where: { id }, include });

/** Plain JSON for the audit log (Decimal becomes number). */
function snapshot(c: CourseWithRelations) {
  return {
    slug: c.slug, name: c.name, department: c.department, level: c.level, duration: c.duration,
    credits: Number(c.credits), gradesOffered: c.gradesOffered, description: c.description,
    prereqText: c.prereqText, dualEnrollment: c.dualEnrollment, dualEnrollmentNote: c.dualEnrollmentNote, hasApExam: c.hasApExam,
    plannable: c.plannable, archived: c.archived, sourcePage: c.sourcePage,
    requirements: c.requirements.map((r) => ({ kind: r.kind, credits: Number(r.credits), provisional: r.provisional })),
    interests: c.interests.map((i) => i.slug).sort(),
  };
}

async function unknownInterests(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const found = await db.interestTag.findMany({ where: { slug: { in: slugs } }, select: { slug: true } });
  const have = new Set(found.map((f) => f.slug));
  return slugs.filter((s) => !have.has(s));
}

function scalar(c: CourseInput) {
  return {
    name: c.name, department: c.department, level: c.level, duration: c.duration, credits: c.credits,
    gradesOffered: c.gradesOffered, description: c.description, prereqText: c.prereqText,
    dualEnrollment: c.dualEnrollment, dualEnrollmentNote: c.dualEnrollmentNote, hasApExam: c.hasApExam, plannable: c.plannable, sourcePage: c.sourcePage,
  };
}

export async function createCourse(input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await editor();
  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid course.");
  const c = parsed.data;
  if (await db.course.findUnique({ where: { slug: c.slug }, select: { id: true } })) return fail("That slug is already used.");
  const bad = await unknownInterests(c.interests);
  if (bad.length) return fail(`Unknown interest tags: ${bad.join(", ")}`);

  const created = await db.$transaction(async (tx) => {
    const row = await tx.course.create({
      data: {
        slug: c.slug,
        ...scalar(c),
        requirements: { create: c.requirements },
        interests: { connect: c.interests.map((slug) => ({ slug })) },
      },
      include,
    });
    await writeAudit(
      { actor, action: "course.created", entityType: "Course", entityId: row.id, after: snapshot(row) },
      tx,
    );
    return row;
  });
  revalidatePath("/courses");
  revalidatePath("/admin/catalog");
  return { ok: true, data: { id: created.id } };
}

export async function updateCourse(id: string, input: unknown): Promise<ActionResult> {
  const actor = await editor();
  if (typeof id !== "string" || !id || id.length > 64) return fail("Invalid course.");
  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid course.");
  const c = parsed.data;

  const before = await loadCourse(id);
  if (!before) return fail("Course not found.");
  if (before.slug !== c.slug) return fail("The slug cannot be changed. Create a new course instead.");
  const bad = await unknownInterests(c.interests);
  if (bad.length) return fail(`Unknown interest tags: ${bad.join(", ")}`);

  await db.$transaction(async (tx) => {
    await tx.courseRequirement.deleteMany({ where: { courseId: id } });
    const after = await tx.course.update({
      where: { id },
      data: {
        ...scalar(c),
        requirements: { create: c.requirements },
        interests: { set: c.interests.map((slug) => ({ slug })) },
      },
      include,
    });
    await writeAudit(
      {
        actor, action: "course.updated", entityType: "Course", entityId: id,
        before: snapshot(before), after: snapshot(after),
      },
      tx,
    );
  });
  revalidatePath("/courses");
  revalidatePath(`/courses/${before.slug}`);
  revalidatePath("/admin/catalog");
  return { ok: true };
}

export async function setCourseArchived(id: string, archived: boolean): Promise<ActionResult> {
  const actor = await editor();
  if (typeof id !== "string" || !id || id.length > 64 || typeof archived !== "boolean") return fail("Invalid input.");
  const before = await loadCourse(id);
  if (!before) return fail("Course not found.");
  await db.$transaction(async (tx) => {
    await tx.course.update({ where: { id }, data: { archived } });
    await writeAudit(
      {
        actor, action: archived ? "course.archived" : "course.unarchived", entityType: "Course", entityId: id,
        before: { archived: before.archived }, after: { archived },
      },
      tx,
    );
  });
  revalidatePath("/courses");
  revalidatePath("/admin/catalog");
  return { ok: true };
}

/** Hard delete. Blocked when any plan entry or appeal references the course. Archive instead. */
export async function deleteCourse(id: string): Promise<ActionResult> {
  const actor = await editor();
  if (typeof id !== "string" || !id || id.length > 64) return fail("Invalid course.");
  const before = await loadCourse(id);
  if (!before) return fail("Course not found.");

  const [entries, appeals] = await Promise.all([
    db.planEntry.count({ where: { courseId: id } }),
    db.appeal.count({ where: { OR: [{ targetCourseId: id }, { currentCourseId: id }] } }),
  ]);
  if (entries > 0 || appeals > 0) {
    return fail(`In use by ${entries} plan entries and ${appeals} appeals. Archive it instead.`);
  }
  await db.$transaction(async (tx) => {
    await tx.course.delete({ where: { id } });
    await writeAudit({ actor, action: "course.deleted", entityType: "Course", entityId: id, before: snapshot(before) }, tx);
  });
  revalidatePath("/courses");
  revalidatePath("/admin/catalog");
  return { ok: true };
}

export async function addAlias(input: unknown): Promise<ActionResult> {
  const actor = await editor();
  const parsed = aliasSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a course and an alias.");
  const alias = normalizeTitle(parsed.data.alias);
  if (alias.length < 2) return fail("That alias is too short.");
  if (!(await db.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } }))) return fail("Course not found.");
  if (await db.courseAlias.findUnique({ where: { alias } })) return fail("That alias already points at a course.");

  await db.$transaction(async (tx) => {
    const row = await tx.courseAlias.create({ data: { alias, courseId: parsed.data.courseId, createdById: actor.id } });
    await writeAudit(
      { actor, action: "alias.added", entityType: "CourseAlias", entityId: row.id, after: { alias, courseId: parsed.data.courseId } },
      tx,
    );
  });
  revalidatePath("/admin/catalog");
  return { ok: true };
}

export async function removeAlias(aliasId: string): Promise<ActionResult> {
  const actor = await editor();
  if (typeof aliasId !== "string" || !aliasId || aliasId.length > 64) return fail("Invalid alias.");
  const row = await db.courseAlias.findUnique({ where: { id: aliasId } });
  if (!row) return fail("Alias not found.");
  await db.$transaction(async (tx) => {
    await tx.courseAlias.delete({ where: { id: aliasId } });
    await writeAudit(
      { actor, action: "alias.removed", entityType: "CourseAlias", entityId: aliasId, before: { alias: row.alias, courseId: row.courseId } },
      tx,
    );
  });
  revalidatePath("/admin/catalog");
  return { ok: true };
}

export async function exportCatalogCsv(): Promise<string> {
  await editor();
  const courses = await db.course.findMany({ orderBy: [{ department: "asc" }, { name: "asc" }], include });
  const rows = courses.map((c) => courseToRow({ ...snapshot(c), archived: c.archived } as CourseRecord));
  return serializeCsv([...CSV_COLUMNS], rows);
}

/** All or nothing: any invalid row means nothing is written. Creates new slugs and updates existing ones. */
export async function importCatalogCsv(csv: unknown): Promise<ActionResult<{ created: number; updated: number }> & { errors?: string[] }> {
  const actor = await editor();
  if (typeof csv !== "string" || csv.length === 0) return fail("Choose a CSV file.");
  if (csv.length > MAX_CSV_BYTES) return fail("That file is too large (2 MB max).");

  const table = parseCsv(csv);
  if (table.length < 2) return fail("The file has no rows.");
  if (table.length - 1 > MAX_CSV_ROWS) return fail(`Too many rows (${MAX_CSV_ROWS} max).`);
  const [header, ...rows] = table;

  const errors: string[] = [];
  const valid: CourseRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const line = i + 2;
    const r = rowToCourseInput(header, row);
    if (!r.ok) return void errors.push(`Row ${line}: ${r.error}`);
    const p = courseInputSchema.safeParse(r.value);
    if (!p.success) return void errors.push(`Row ${line}: ${p.error.issues[0]?.path.join(".")} ${p.error.issues[0]?.message}`);
    if (seen.has(p.data.slug)) return void errors.push(`Row ${line}: duplicate slug ${p.data.slug}`);
    seen.add(p.data.slug);
    valid.push({ ...p.data, archived: r.value.archived });
  });

  const tagSlugs = [...new Set(valid.flatMap((v) => v.interests))];
  const bad = await unknownInterests(tagSlugs);
  if (bad.length) errors.push(`Unknown interest tags: ${bad.join(", ")}`);
  if (errors.length) return { ok: false, error: `${errors.length} problems found. Nothing was imported.`, errors: errors.slice(0, 20) };

  let created = 0;
  let updated = 0;
  await db.$transaction(async (tx) => {
    for (const c of valid) {
      const existing = await tx.course.findUnique({ where: { slug: c.slug }, select: { id: true } });
      if (existing) {
        await tx.courseRequirement.deleteMany({ where: { courseId: existing.id } });
        await tx.course.update({
          where: { id: existing.id },
          data: { ...scalar(c), archived: c.archived, requirements: { create: c.requirements }, interests: { set: c.interests.map((slug) => ({ slug })) } },
        });
        updated++;
      } else {
        await tx.course.create({
          data: { slug: c.slug, ...scalar(c), archived: c.archived, requirements: { create: c.requirements }, interests: { connect: c.interests.map((slug) => ({ slug })) } },
        });
        created++;
      }
    }
    await writeAudit({ actor, action: "catalog.csv_import", entityType: "Course", after: { created, updated } }, tx);
  });
  revalidatePath("/courses");
  revalidatePath("/admin/catalog");
  return { ok: true, data: { created, updated } };
}
