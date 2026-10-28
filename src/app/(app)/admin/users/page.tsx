// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { DeleteGrantButton, GrantForm } from "@/components/admin/grant-form";
import { PageHeader, Section } from "@/components/ui/page";
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
    <div>
      <PageHeader title="Users" description="Roles for staff only come from grants. Every change is audited." />

      <div className="space-y-10">
        <Section title="Pre-approved grants">
          <GrantForm />
          {grants.length > 0 && (
            <ul className="list mt-6">
              {grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="num text-[13px]">{g.email}</span> <span className="text-muted">{g.role.toLowerCase()}</span>
                    {g.departments.length > 0 && <span className="text-muted"> ({g.departments.join(", ").toLowerCase()})</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="num text-muted">{g.appliedAt ? "applied" : "waiting for sign-in"}</span>
                    <DeleteGrantButton id={g.id} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="All users">
          <form className="mb-4 flex gap-2" action="/admin/users">
            <input className="input !w-72" name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" />
            <button className="btn btn-sm" type="submit">Search</button>
          </form>
          <ul className="list">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm">{u.name ?? "No name"}</div>
                  <div className="num truncate text-muted">{u.email}</div>
                </div>
                <UserRoleForm userId={u.id} role={u.role} departments={u.departments} />
              </li>
            ))}
            {users.length === 0 && <li className="py-8 text-center text-sm text-muted">No users found.</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}
