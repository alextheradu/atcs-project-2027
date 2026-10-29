import { db } from "@/lib/db";
import { EXPORT_KEYS, type ExportKey } from "@/lib/deletion/registry";

/** Most rows a long-running list will return. A note says so when a list hits it. */
const CAP = 1000;

type Section = unknown;
type Builder = (userId: string) => Promise<Section>;

const capped = <T>(rows: T[]) => ({ items: rows, truncated: rows.length >= CAP });
const host = (endpoint: string) => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "unknown";
  }
};

/**
 * One builder per export section. Every query is keyed by the signed-in user's id, and the Record type
 * makes TypeScript fail if a section in EXPORT_KEYS has no builder. Secrets (Google tokens, push keys,
 * session tokens) are never exported, and other people appear only as a role.
 */
const SECTIONS: Record<ExportKey, Builder> = {
  account: (userId) =>
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true, role: true, departments: true, ageConfirmed13At: true, onboardedAt: true, createdAt: true, updatedAt: true } }),

  signIns: async (userId) => {
    const [accounts, sessions] = await Promise.all([
      db.account.findMany({ where: { userId }, select: { provider: true, type: true } }),
      db.session.findMany({ where: { userId }, select: { expires: true } }),
    ]);
    return { accounts, sessions };
  },

  linkedEmails: (userId) => db.linkedEmail.findMany({ where: { userId }, select: { email: true, verifiedAt: true, createdAt: true } }),

  profile: (userId) =>
    db.studentProfile.findUnique({
      where: { userId },
      select: {
        cohort: true, gradYear: true, currentGrade: true, intendedMajor: true, eighthMath: true, eighthMathGrade: true, scienceGrade: true, englishGrade: true,
        historyGrade: true, languageStudied: true, languageLevel: true, selfReported: true, honestyConfirmedAt: true, snapshotExpiresAt: true, createdAt: true, updatedAt: true,
        interests: { select: { slug: true, label: true } },
      },
    }),

  onboarding: (userId) => db.onboardingProgress.findUnique({ where: { userId }, select: { step: true, draft: true, completedAt: true, updatedAt: true } }),

  policyAcceptances: async (userId) =>
    (await db.policyAcceptance.findMany({ where: { userId }, select: { acceptedAt: true, document: { select: { kind: true, version: true } } } })).map((a) => ({ kind: a.document.kind, version: a.document.version, acceptedAt: a.acceptedAt })),

  plans: async (userId) => {
    const plans = await db.plan.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      take: CAP,
      select: {
        name: true, isPrimary: true, status: true, submittedAt: true, decidedAt: true, createdAt: true, updatedAt: true,
        entries: { orderBy: [{ gradeLevel: "asc" }, { createdAt: "asc" }], select: { gradeLevel: true, status: true, grade: true, credits: true, source: true, note: true, overrideAppealId: true, course: { select: { name: true, slug: true } } } },
        comments: { orderBy: { createdAt: "asc" }, select: { body: true, createdAt: true, authorId: true, author: { select: { role: true } } } },
      },
    });
    return plans.map((p) => ({
      ...p,
      entries: p.entries.map(({ course, overrideAppealId, ...e }) => ({ ...e, course: course.name, slug: course.slug, approvedByAppeal: overrideAppealId !== null })),
      comments: p.comments.map((c) => ({ body: c.body, createdAt: c.createdAt, by: c.authorId === userId ? "you" : (c.author?.role.toLowerCase() ?? "deleted user") })),
    }));
  },

  // Comments the person wrote on plans they do not own (staff).
  comments: async (userId) =>
    capped(await db.planComment.findMany({ where: { authorId: userId, plan: { ownerId: { not: userId } } }, orderBy: { createdAt: "asc" }, take: CAP, select: { body: true, createdAt: true } })),

  appeals: async (userId) => {
    const rows = await db.appeal.findMany({
      where: { studentId: userId },
      orderBy: { createdAt: "asc" },
      take: CAP,
      select: {
        status: true, department: true, reportedGrade: true, reportedAverage: true, selfReported: true, unmetRules: true, submittedAt: true, decidedAt: true, decisionNote: true, createdAt: true,
        targetCourse: { select: { name: true } }, currentCourse: { select: { name: true } },
        answers: { select: { prompt: true, answer: true } },
      },
    });
    return rows.map(({ targetCourse, currentCourse, ...a }) => ({ ...a, targetCourse: targetCourse.name, currentCourse: currentCourse?.name ?? null }));
  },

  importRequests: (userId) => db.importRequest.findMany({ where: { studentId: userId }, orderBy: { createdAt: "asc" }, take: CAP, select: { title: true, status: true, createdAt: true, decidedAt: true } }),

  notifications: async (userId) =>
    capped(await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: CAP, select: { kind: true, title: true, body: true, url: true, readAt: true, createdAt: true } })),

  notificationPreferences: (userId) => db.notificationPreference.findMany({ where: { userId }, select: { kind: true, inApp: true, email: true, push: true } }),

  pushDevices: async (userId) =>
    (await db.pushSubscription.findMany({ where: { userId }, select: { endpoint: true, userAgent: true, createdAt: true, lastSeenAt: true } })).map((d) => ({ service: host(d.endpoint), userAgent: d.userAgent, createdAt: d.createdAt, lastSeenAt: d.lastSeenAt })),

  deletionRequests: (userId) => db.deletionRequest.findMany({ where: { userId }, orderBy: { requestedAt: "asc" }, select: { source: true, status: true, requestedAt: true, confirmedAt: true, scheduledFor: true, cancelledAt: true, completedAt: true } }),

  auditTrail: async (userId) =>
    capped(await db.auditLog.findMany({ where: { actorId: userId }, orderBy: { createdAt: "desc" }, take: CAP, select: { action: true, entityType: true, createdAt: true } })),

  // What staff did: counts and the few things they wrote. Never the students involved.
  staffActivity: async (userId) => {
    const [reviewedPlans, decidedAppeals, importDecisions, grantsCreated, aliases, settingsUpdated] = await Promise.all([
      db.plan.count({ where: { reviewerId: userId } }),
      db.appeal.count({ where: { decidedById: userId } }),
      db.importRequest.count({ where: { decidedById: userId } }),
      db.roleGrant.count({ where: { createdById: userId } }),
      db.courseAlias.findMany({ where: { createdById: userId }, orderBy: { createdAt: "asc" }, take: CAP, select: { alias: true, createdAt: true } }),
      db.appSetting.findMany({ where: { updatedById: userId }, select: { key: true, updatedAt: true } }),
    ]);
    return { reviewedPlans, decidedAppeals, importDecisions, grantsCreated, aliasesCreated: aliases, settingsUpdated };
  },
};

export interface DataExport {
  exportedAt: string;
  about: string;
  [key: string]: unknown;
}

/** Everything stored about one user, as a plain object ready for JSON. Own data only. */
export async function buildExport(userId: string, now = new Date()): Promise<DataExport> {
  const entries = await Promise.all(EXPORT_KEYS.map(async (k) => [k, await SECTIONS[k](userId)] as const));
  return {
    exportedAt: now.toISOString(),
    about: "Everything this site stores about you. Google sign-in tokens, push keys and session tokens are left out on purpose. Other people appear only as a role.",
    ...Object.fromEntries(entries),
  };
}
