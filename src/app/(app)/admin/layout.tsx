import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { requirePageUser } from "@/lib/auth/page";
import { CATALOG_SUBTABS, adminTabsFor } from "@/lib/nav";

/** Tabs only decide what is shown. Each admin page still checks the role itself. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const tabs = adminTabsFor(user.role);
  if (tabs.length === 0) notFound();
  const catalogTabs = CATALOG_SUBTABS.filter((t) => !t.roles || t.roles.includes(user.role));
  return (
    <div className="max-w-[1100px]">
      <AdminTabs tabs={tabs.map(({ href, label }) => ({ href, label }))} catalogTabs={catalogTabs.map(({ href, label }) => ({ href, label }))} />
      {children}
    </div>
  );
}
