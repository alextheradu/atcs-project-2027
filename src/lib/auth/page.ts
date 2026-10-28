import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./index";
import type { Role } from "./policy";

/** For pages and layouts. Redirects anonymous visitors, hides pages from the wrong role. */
export async function requirePageUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requirePageRole(...roles: Role[]) {
  const user = await requirePageUser();
  if (!roles.includes(user.role)) notFound();
  return user;
}
