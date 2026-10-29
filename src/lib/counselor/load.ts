import { db } from "@/lib/db";
import { computeWarnings } from "@/lib/plan-warnings";
import { summarize, type RequirementKind } from "@/lib/requirements";
import { getGraduationConfig } from "@/lib/requirements/config";
import { courseDemand, offTrackReasons, sortDemand, type DemandSort } from "./index";

const MAX_PLANS = 500;

/** Everything on the counselor dashboard. Callers must check the role first. */
export async function loadCounselor(opts: { gradYear?: number; sort: DemandSort }) {
  const [config, pending, primaries, demandRows, years] = await Promise.all([
    getGraduationConfig(),
    db.plan.findMany({
      where: { status: "SUBMITTED" },
      orderBy: { submittedAt: "asc" },
      take: 100,
      select: { id: true, name: true, submittedAt: true, owner: { select: { name: true, email: true } } },
    }),
    db.plan.findMany({
      where: { isPrimary: true, owner: { role: "STUDENT", ...(opts.gradYear ? { profile: { gradYear: opts.gradYear } } : {}) } },
      take: MAX_PLANS,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, status: true,
        owner: { select: { name: true, email: true, profile: { select: { gradYear: true } } } },
        entries: { select: { id: true, gradeLevel: true, status: true, credits: true, course: { select: { name: true, credits: true, gradesOffered: true, requirements: { select: { kind: true, credits: true, provisional: true } } } } } },
      },
    }),
    db.planEntry.findMany({
      where: { plan: { OR: [{ isPrimary: true }, { status: { in: ["SUBMITTED", "APPROVED"] } }], owner: { role: "STUDENT" } } },
      select: { courseId: true, gradeLevel: true, plan: { select: { ownerId: true, status: true, isPrimary: true } } },
    }),
    db.studentProfile.findMany({ where: { gradYear: { not: null }, user: { role: "STUDENT" } }, distinct: ["gradYear"], select: { gradYear: true }, orderBy: { gradYear: "asc" } }),
  ]);

  const offTrack = primaries
    .map((p) => {
      const tracked = p.entries.map((e) => ({
        id: e.id, gradeLevel: e.gradeLevel, status: e.status, credits: Number(e.credits), courseCredits: Number(e.course.credits),
        tags: e.course.requirements.map((r) => ({ kind: r.kind as RequirementKind, credits: Number(r.credits), provisional: r.provisional })),
      }));
      const summary = summarize(tracked, config.rules, config.settings);
      const warnings = computeWarnings(p.entries.map((e) => ({ id: e.id, name: e.course.name, gradeLevel: e.gradeLevel, credits: Number(e.credits), gradesOffered: e.course.gradesOffered })), config.settings);
      const reasons = offTrackReasons({ complete: summary.complete, missing: summary.missing, missingList: summary.missingList, warnings });
      return { planId: p.id, planName: p.name, student: p.owner.name ?? p.owner.email, gradYear: p.owner.profile?.gradYear ?? null, total: summary.total, required: summary.totalRequired, reasons };
    })
    .filter((s) => s.reasons.length > 0);

  const demand = courseDemand(demandRows.map((r) => ({ studentId: r.plan.ownerId, courseId: r.courseId, planStatus: r.plan.status, isPrimary: r.plan.isPrimary, gradeLevel: r.gradeLevel })));
  const names = new Map((await db.course.findMany({ where: { id: { in: demand.map((d) => d.courseId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const demandRowsNamed = sortDemand(demand.map((d) => ({ ...d, name: names.get(d.courseId) ?? "Unknown" })), opts.sort);

  return {
    pending: pending.map((p) => ({ id: p.id, name: p.name, student: p.owner.name ?? p.owner.email, submittedAt: p.submittedAt })),
    offTrack,
    scanned: primaries.length,
    demand: demandRowsNamed,
    gradYears: years.map((y) => y.gradYear as number),
  };
}
