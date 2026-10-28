import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Pick<typeof db, "auditLog">;

export interface AuditActor {
  id: string;
  name: string | null;
  email: string;
}

export interface AuditEntry {
  actor: AuditActor | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

/** Writes an audit row. Pass a transaction client to keep it atomic with the change. */
export async function writeAudit(entry: AuditEntry, tx: Tx = db) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actor?.id ?? null,
      actorLabel: entry.actor ? (entry.actor.name ?? entry.actor.email) : "system",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
    },
  });
}
