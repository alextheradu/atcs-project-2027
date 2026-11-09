"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string };

/** The longest matching href wins, so /admin/catalog/requests selects Requests, not Classes. */
function activeHref(tabs: Tab[], pathname: string): string | undefined {
  return tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function TabRow({ tabs, active, label, small }: { tabs: Tab[]; active?: string; label: string; small?: boolean }) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center rounded-full px-3.5 transition-colors duration-150",
            small ? "h-8 text-[13px]" : "h-9 text-[14px]",
            t.href === active ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Admin's own tabs, and the catalog's sub-tabs while a catalog page is open. */
export function AdminTabs({ tabs, catalogTabs }: { tabs: Tab[]; catalogTabs: Tab[] }) {
  const pathname = usePathname();
  const hasCatalog = tabs.some((t) => t.href === "/admin/catalog");
  // Prerequisite links live at /admin/edges but belong to the catalog for anyone who can open the catalog.
  const inCatalog = hasCatalog && (pathname.startsWith("/admin/catalog") || pathname.startsWith("/admin/edges"));
  const top = inCatalog ? "/admin/catalog" : activeHref(tabs, pathname);
  return (
    <div className="mb-8 space-y-2">
      {tabs.length > 1 && <TabRow tabs={tabs} active={top} label="Admin" />}
      {inCatalog && catalogTabs.length > 1 && <TabRow tabs={catalogTabs} active={activeHref(catalogTabs, pathname)} label="Catalog" small />}
    </div>
  );
}
