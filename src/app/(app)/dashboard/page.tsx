// Depends on the signed-in user, so it blocks on the session by design.
export const instant = false;

import { requirePageUser } from "@/lib/auth/page";

export default async function Dashboard() {
  const user = await requirePageUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome{user.name ? `, ${user.name}` : ""}</h1>
      <p className="mt-2 text-muted">
        Planner, requirements, and pathways arrive in the next phases. Signed in as{" "}
        <span className="font-mono text-fg">{user.role}</span>.
      </p>
    </div>
  );
}
