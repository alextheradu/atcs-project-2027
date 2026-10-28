import type { Prisma } from "@/generated/prisma/client";
import type { CourseFilter } from "./schemas";

/** Builds the Prisma where clause for course search. Pure so it can be unit tested. */
export function buildCourseWhere(f: CourseFilter): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = {};
  if (!f.includeArchived) {
    where.archived = false;
    where.plannable = true;
  }
  if (f.department) where.department = f.department;
  if (f.level) where.level = f.level;
  if (f.duration) where.duration = f.duration;
  if (f.grade) where.gradesOffered = { has: f.grade };
  if (f.interest) where.interests = { some: { slug: f.interest } };
  if (f.q) {
    where.OR = [
      { name: { contains: f.q, mode: "insensitive" } },
      { description: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}
