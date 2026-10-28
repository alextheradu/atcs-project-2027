// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { DeleteGrantButton, GrantForm } from "@/components/admin/grant-form";
import { UserRoleForm } from "@/components/admin/user-role-form";
import { searchUsers } from "@/lib/admin/users";
import { requirePageRole } from "@/lib/auth/page";
import { db } from "@/lib/db";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePageRole("ADMIN");
  const { q = "" } = await searchParams;
  const [users, grants] = await Promise.all([
    searchUsers(q.slice(0, 100)),
    db.roleGrant.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-muted">Roles for staff only come from grants. Every change is audited.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Pre-approved grants</h2>
        <GrantForm />
        {grants.length > 0 && (
          <ul className="card divide-y divide-line">
            {grants.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="truncate">
                  <span className="font-mono">{g.email}</span> <span className="text-muted">{g.role}</span>
                  {g.departments.length > 0 && <span className="text-muted"> ({g.departments.join(", ")})</span>}
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">{g.appliedAt ? "applied" : "waiting for sign-in"}</span>
                  <DeleteGrantButton id={g.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <form className="flex gap-2" action="/admin/users">
          <input className="input !w-72" name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
        <ul className="card divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{u.name ?? "No name"}</div>
                <div className="truncate font-mono text-xs text-muted">{u.email}</div>
              </div>
              <UserRoleForm userId={u.id} role={u.role} departments={u.departments} />
            </li>
          ))}
          {users.length === 0 && <li className="px-4 py-6 text-sm text-muted">No users found.</li>}
        </ul>
      </section>
    </div>
  );
}
