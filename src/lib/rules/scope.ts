/** Who may edit which course's rules and pathway edges. Pure. */
import type { Department, Role } from "@/lib/auth/policy";

interface Actor {
  role: Role;
  departments: readonly Department[];
}

/** Admins edit everything. Supervisors edit only their own departments. Nobody else edits. */
export function canEditDepartment(actor: Actor, department: Department): boolean {
  if (actor.role === "ADMIN") return true;
  if (actor.role === "SUPERVISOR") return actor.departments.includes(department);
  return false;
}

/** An edge touches two courses. A supervisor needs both in scope so they cannot rewire another department. */
export function canEditEdge(actor: Actor, from: Department, to: Department): boolean {
  return canEditDepartment(actor, from) && canEditDepartment(actor, to);
}

/** True when adding from -> to would close a loop in the pathway graph. */
export function wouldCycle(edges: readonly { from: string; to: string }[], from: string, to: string): boolean {
  if (from === to) return true;
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const n = stack.pop()!;
    if (n === from) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(next.get(n) ?? []));
  }
  return false;
}
