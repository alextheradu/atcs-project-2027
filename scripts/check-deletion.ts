/**
 * Integration check against the local database: build a full synthetic account, export it, delete it,
 * then scan every table for any trace. Fixtures are fake and removed at the end.
 * Run: npx tsx --env-file=.env scripts/check-deletion.ts   (needs `docker compose up -d`)
 */
import { db } from "../src/lib/db";
import { eraseUser } from "../src/lib/deletion/erase";
import { hashEmail } from "../src/lib/deletion";
import { buildExport } from "../src/lib/export";

const tag = Math.random().toString(36).slice(2, 8);
const T_EMAIL = `del-target-${tag}@example.test`;
const T_LINKED = `del-linked-${tag}@example.test`;
const T_NAME = `Zed Targetson ${tag}`;
const O_EMAIL = `del-other-${tag}@example.test`;
const S_EMAIL = `del-staff-${tag}@pascack.org`;
const checks: [string, boolean][] = [];
const check = (name: string, ok: boolean) => { checks.push([name, ok]); console.log(`${ok ? "ok  " : "FAIL"} ${name}`); };

async function fixture(email: string, name: string, role: "STUDENT" | "COUNSELOR" = "STUDENT") {
  const u = await db.user.create({ data: { email, name, role, onboardedAt: new Date() } });
  await db.account.create({ data: { userId: u.id, type: "oidc", provider: "google", providerAccountId: `g-${u.id}`, access_token: "tok" } });
  await db.session.create({ data: { userId: u.id, sessionToken: `s-${u.id}`, expires: new Date(Date.now() + 1e8) } });
  const interest = await db.interestTag.upsert({ where: { slug: "check-interest" }, create: { slug: "check-interest", label: "Check" }, update: {} });
  await db.studentProfile.create({ data: { userId: u.id, cohort: "CURRENT", gradYear: 2029, intendedMajor: `Major ${email}`, interests: { connect: { id: interest.id } } } });
  await db.onboardingProgress.create({ data: { userId: u.id, step: 2, draft: { note: "draft" } } });
  await db.notificationPreference.create({ data: { userId: u.id, kind: "SYSTEM", email: true } });
  await db.pushSubscription.create({ data: { userId: u.id, endpoint: `https://fcm.googleapis.com/fcm/send/${u.id}`, p256dh: "k", auth: "a" } });
  const n = await db.notification.create({ data: { userId: u.id, kind: "SYSTEM", title: "hello", body: "b", data: { who: u.id } } });
  await db.notificationDelivery.create({ data: { notificationId: n.id, channel: "EMAIL" } });
  return u;
}

async function main() {
  // Leftovers from an interrupted earlier run.
  await db.user.deleteMany({ where: { OR: [{ email: { startsWith: "del-target-" } }, { email: { startsWith: "del-other-" } }, { email: { startsWith: "del-staff-" } }] } });
  const course = await db.course.findFirstOrThrow();
  const policy = await db.policyDocument.findFirst();
  const T = await fixture(T_EMAIL, T_NAME);
  const O = await fixture(O_EMAIL, `Olive Other ${tag}`);
  const S = await fixture(S_EMAIL, `Sam Staff ${tag}`, "COUNSELOR");

  await db.linkedEmail.create({ data: { userId: T.id, email: T_LINKED, verifiedAt: new Date() } });
  await db.roleGrant.create({ data: { email: T_LINKED, role: "STUDENT", createdById: S.id } });
  await db.verificationToken.create({ data: { identifier: T_EMAIL, token: `v-${tag}`, expires: new Date(Date.now() + 1e8) } });
  if (policy) await db.policyAcceptance.create({ data: { userId: T.id, documentId: policy.id } });

  const plan = await db.plan.create({ data: { ownerId: T.id, name: `T plan ${tag}`, isPrimary: true, reviewerId: S.id } });
  const entry = await db.planEntry.create({ data: { planId: plan.id, courseId: course.id, gradeLevel: 9, credits: 5, note: "mine" } });
  await db.planComment.create({ data: { planId: plan.id, entryId: entry.id, authorId: S.id, body: "staff note" } });
  await db.planComment.create({ data: { planId: plan.id, authorId: T.id, body: "student reply" } });
  const oPlan = await db.plan.create({ data: { ownerId: O.id, name: `O plan ${tag}`, isPrimary: true } });
  await db.planEntry.create({ data: { planId: oPlan.id, courseId: course.id, gradeLevel: 9, credits: 5 } });

  const appeal = await db.appeal.create({ data: { studentId: T.id, targetCourseId: course.id, department: course.department, status: "APPROVED", decidedById: S.id, decisionNote: "ok", answers: { create: [{ prompt: "why", answer: "because" }] } } });
  await db.planEntry.update({ where: { id: entry.id }, data: { overrideAppealId: appeal.id } });
  await db.appeal.create({ data: { studentId: O.id, targetCourseId: course.id, department: course.department, answers: { create: [{ prompt: "why", answer: "other student's answer" }] } } });
  await db.importRequest.create({ data: { studentId: T.id, title: "Odd Course", normalizedTitle: `odd ${tag}`, decidedById: S.id, status: "DISMISSED" } });
  await db.courseAlias.create({ data: { alias: `alias ${tag}`, courseId: course.id, createdById: S.id } });
  await db.appSetting.upsert({ where: { key: `check-${tag}` }, create: { key: `check-${tag}`, value: {}, updatedById: T.id }, update: {} });
  await db.deletionRequest.create({ data: { userId: T.id, emailHash: hashEmail(T_EMAIL, "s"), status: "COMPLETED" } });

  // Audit rows: the actor, the subject, an email in a snapshot, an id in a snapshot, an unrelated row.
  const auditRows = await db.auditLog.createManyAndReturn({ select: { id: true }, data: [
    { actorId: T.id, actorLabel: T_NAME, action: "plan.created", entityType: "Plan", entityId: plan.id },
    { actorId: T.id, actorLabel: T_EMAIL, action: "user.email_linked", entityType: "User", entityId: T.id },
    { actorId: S.id, actorLabel: S_EMAIL, action: "user.role_changed", entityType: "User", entityId: T.id, before: { role: "STUDENT" }, after: { role: "STUDENT", email: T_EMAIL } },
    { actorId: S.id, actorLabel: S_EMAIL, action: "grant.created", entityType: "RoleGrant", entityId: "g1", after: { email: T_LINKED } },
    { actorId: S.id, actorLabel: S_EMAIL, action: "appeal.decided", entityType: "Appeal", entityId: appeal.id, after: { studentId: T.id } },
    { actorId: O.id, actorLabel: O_EMAIL, action: "plan.created", entityType: "Plan", entityId: oPlan.id, after: { name: "other" } },
  ] });
  const auditBefore = await db.auditLog.count({ where: { OR: [{ actorId: { in: [T.id, S.id, O.id] } }, { entityId: { in: [T.id, plan.id, appeal.id, oPlan.id, "g1"] } }] } });

  // ---- export ----
  const exp = JSON.stringify(await buildExport(T.id));
  check("export has the student's email, plan, appeal answer, comment and linked email", [T_EMAIL, `T plan ${tag}`, "because", "student reply", "staff note", T_LINKED, "Odd Course"].every((s) => exp.includes(s)));
  check("export has no other student's data", ![O_EMAIL, `O plan ${tag}`, "other student's answer", O.id].some((s) => exp.includes(s)));
  check("export has no staff identity (only a role)", !exp.includes(S_EMAIL) && !exp.includes(`Sam Staff ${tag}`) && exp.includes("counselor"));
  check("export has no tokens or keys", !['"tok"', '"p256dh"', `s-${T.id}`].some((s) => exp.includes(s)) && !exp.includes("access_token"));
  check("export names the push service, not the endpoint", exp.includes("fcm.googleapis.com") && !exp.includes(`/fcm/send/${T.id}`));
  const sExp = JSON.stringify(await buildExport(S.id));
  check("staff export lists what they wrote and counts, not students", sExp.includes("staff note") && sExp.includes(`alias ${tag}`) && !sExp.includes(`T plan ${tag}`) && !sExp.includes(T_EMAIL));

  // ---- delete ----
  const erased = await db.$transaction((tx) => eraseUser(tx, T.id));
  check("erase reports success", erased === true);

  const tables = (await db.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_%'`).map((r) => r.table_name);
  const patterns = [T.id, T_EMAIL, T_LINKED, T_NAME, `Major ${T_EMAIL}`];
  const traces: string[] = [];
  for (const t of tables) {
    const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "${t}" x WHERE x::text ILIKE ANY($1::text[])`, patterns.map((p) => `%${p}%`));
    if (Number(rows[0].n) > 0) traces.push(`${t}:${rows[0].n}`);
  }
  check(`no row in any of ${tables.length} tables mentions the user id, email, linked email or name (${traces.join(", ") || "clean"})`, traces.length === 0);

  check("user row is gone", (await db.user.findUnique({ where: { id: T.id } })) === null);
  check("their plan, entries and appeal are gone", (await db.plan.count({ where: { name: `T plan ${tag}` } })) === 0 && (await db.appeal.count({ where: { id: appeal.id } })) === 0 && (await db.planEntry.count({ where: { id: entry.id } })) === 0);
  check("role grant for the linked email is gone", (await db.roleGrant.count({ where: { email: T_LINKED } })) === 0);
  check("audit rows all remain", (await db.auditLog.count({ where: { OR: [{ actorLabel: "deleted user" }, { actorId: { in: [S.id, O.id] } }, { entityId: { in: [plan.id, appeal.id, oPlan.id, "g1"] } }] } })) >= auditBefore - 1);
  check("their audit rows now read 'deleted user'", (await db.auditLog.count({ where: { actorLabel: "deleted user", actorId: null } })) >= 2);
  check("staff audit row about the user kept, subject and snapshot cleared", await db.auditLog.findFirst({ where: { action: "user.role_changed", actorId: S.id } }).then((r) => !!r && r.after === null && r.entityId === null));
  check("deletion request kept with the hash only", await db.deletionRequest.findFirst({ where: { emailHash: hashEmail(T_EMAIL, "s") } }).then((r) => !!r && r.userId === null));
  check("comments on the deleted student's plan went with the plan", (await db.planComment.count({ where: { body: { in: ["staff note", "student reply"] } } })) === 0);
  const keptDecision = await db.importRequest.count({ where: { studentId: T.id } });
  check("import requests of the student are gone", keptDecision === 0);
  check("the other student is untouched", (await db.plan.count({ where: { ownerId: O.id } })) === 1 && (await db.appeal.count({ where: { studentId: O.id } })) === 1 && (await db.notification.count({ where: { userId: O.id } })) === 1 && (await db.pushSubscription.count({ where: { userId: O.id } })) === 1);
  check("staff user and their alias are untouched", (await db.courseAlias.count({ where: { alias: `alias ${tag}` } })) === 1 && (await db.user.count({ where: { id: S.id } })) === 1);
  check("settings row kept without the id", (await db.appSetting.findUnique({ where: { key: `check-${tag}` } }))?.updatedById === null);

  // ---- staff deletion keeps review history anonymized ----
  const plan2 = await db.plan.create({ data: { ownerId: O.id, name: `O plan2 ${tag}`, reviewerId: S.id } });
  await db.planComment.create({ data: { planId: plan2.id, authorId: S.id, body: "kept staff note" } });
  const appeal2 = await db.appeal.create({ data: { studentId: O.id, targetCourseId: course.id, department: course.department, status: "DENIED", decidedById: S.id } });
  await db.$transaction((tx) => eraseUser(tx, S.id));
  const kept = await db.planComment.findFirst({ where: { body: "kept staff note" } });
  check("deleting staff keeps their comment on the student's plan, author cleared", !!kept && kept.authorId === null);
  check("deleting staff keeps the appeal decision, decider cleared", (await db.appeal.findUnique({ where: { id: appeal2.id } }))?.decidedById === null);
  check("deleting staff clears the plan reviewer", (await db.plan.findUnique({ where: { id: plan2.id } }))?.reviewerId === null);
  check("deleting staff clears alias creator, alias stays", (await db.courseAlias.findUnique({ where: { alias: `alias ${tag}` } }))?.createdById === null);
  const sTraces: string[] = [];
  for (const t of tables) {
    const rows = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM "${t}" x WHERE x::text ILIKE ANY($1::text[])`, [S.id, S_EMAIL, `Sam Staff ${tag}`].map((p) => `%${p}%`));
    if (Number(rows[0].n) > 0) sTraces.push(t);
  }
  check(`no trace of the staff member anywhere (${sTraces.join(", ") || "clean"})`, sTraces.length === 0);

  // cleanup
  await db.user.delete({ where: { id: O.id } });
  await db.courseAlias.deleteMany({ where: { alias: `alias ${tag}` } });
  await db.appSetting.deleteMany({ where: { key: `check-${tag}` } });
  await db.deletionRequest.deleteMany({ where: { emailHash: hashEmail(T_EMAIL, "s") } });
  await db.interestTag.deleteMany({ where: { slug: "check-interest" } });
  await db.auditLog.deleteMany({ where: { id: { in: auditRows.map((r) => r.id) } } });

  const failed = checks.filter(([, ok]) => !ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
