/**
 * Integration check against the local database: many workers claiming at once must never share a row.
 * Run: npx tsx scripts/check-delivery-claims.ts   (needs `docker compose up -d`)
 */
import { db } from "../src/lib/db";
import { claimDue } from "../src/lib/notify/deliver";

async function main() {
  const user = await db.user.upsert({ where: { email: "claims-check@pascack.org" }, create: { email: "claims-check@pascack.org", role: "STUDENT" }, update: {} });
  const n = await db.notification.create({ data: { userId: user.id, kind: "SYSTEM", title: "claim check", body: "x" } });
  await db.notificationDelivery.createMany({ data: Array.from({ length: 60 }, () => ({ notificationId: n.id, channel: "EMAIL" as const })) });
  const ids = (await db.notificationDelivery.findMany({ where: { notificationId: n.id }, select: { id: true } })).map((d) => d.id);

  const batches = await Promise.all(Array.from({ length: 8 }, () => claimDue(10)));
  const mine = batches.map((b) => b.filter((id) => ids.includes(id)));
  const all = mine.flat();
  const unique = new Set(all);
  console.log(`claimed ${all.length} rows across 8 workers, ${unique.size} unique`);
  const again = (await claimDue(100)).filter((id) => ids.includes(id));
  console.log(`a second pass right after claims ${again.length} of the same rows (must be only rows nobody had claimed yet)`);

  await db.notification.delete({ where: { id: n.id } });
  await db.user.delete({ where: { id: user.id } });
  if (all.length !== unique.size) throw new Error("A row was claimed twice");
  if (again.some((id) => unique.has(id))) throw new Error("A claimed row was claimed again");
  console.log("ok: exclusive");
}
main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
