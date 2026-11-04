"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/account/actions";
import { phoneTabs } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface ShellProps {
  nav: { href: string; label: string; group: string; count?: number }[];
  user: { name: string | null; email: string; role: string };
  unread?: number;
  children: React.ReactNode;
}

const LABEL_AFTER: Record<string, string> = { plans: "Plan", catalog: "Course" };
/** A database id in the URL is not something to show. Name it after what it is. */
const isId = (s: string) => /^[a-z0-9]{20,}$/i.test(s) && /\d/.test(s);
/** A course slug title-cases badly ("Ap Language And Composition"); the page heading has the real name. */
const isCourseSlug = (raw: string[], i: number) => i === 1 && raw[0] === "courses";

function Breadcrumbs() {
  const raw = usePathname().split("/").filter(Boolean);
  const parts = raw.map((p, i) => (isId(p) ? (LABEL_AFTER[raw[i - 1]] ?? "Details") : isCourseSlug(raw, i) ? "Course" : p));
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-muted">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>/</span>}
          <span className={cn(i === parts.length - 1 && "text-fg", "capitalize")}>{p.replace(/-/g, " ")}</span>
        </span>
      ))}
    </nav>
  );
}

/** Phone tab text. The waiting count sits as a superscript so it never steals width from the label. */
function TabLabel({ label, count }: { label: string; count?: number }) {
  return (
    <span className="relative min-w-0">
      <span className="block truncate">{label}</span>
      {count !== undefined && (
        <>
          <span aria-hidden className="num absolute -right-2.5 -top-2 text-[10px] font-normal text-muted">{count > 99 ? "99+" : count}</span>
          <span className="sr-only">, {count} open</span>
        </>
      )}
    </span>
  );
}

export function AppShell({ nav, user, unread = 0, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const tabs = phoneTabs(nav);
  const rest = nav.filter((n) => !tabs.includes(n));
  // More stands in for every page that has no tab of its own, so it carries their active state and waiting work.
  const moreActive = rest.some((n) => isActive(n.href));
  const moreCount = rest.reduce((sum, n) => sum + (n.count ?? 0), 0);

  return (
    <div className="min-h-dvh">
      <a href="#content" className="skip-link print:hidden">Skip to content</a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[232px] print:hidden flex-col border-r border-line bg-bg transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/dashboard" className="text-[14px] font-semibold">
            Course Planner
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X size={16} />
          </Button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-3" aria-label="Main">
          {[...new Set(nav.map((n) => n.group))].map((group) => (
            <div key={group}>
              <div className="eyebrow px-3 pb-1.5">{group}</div>
              <div className="space-y-0.5">
                {nav
                  .filter((n) => n.group === group)
                  .map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex h-8 items-center justify-between gap-3 px-3 text-[13px] text-muted transition-colors duration-150 ease-out hover:text-fg",
                          active && "font-semibold text-fg",
                        )}
                      >
                        {item.label}
                        {item.count !== undefined && (
                          <span className="num text-muted" aria-label={`${item.count} open`}>{item.count}</span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-elevated text-xs font-medium uppercase">
              {(user.name ?? user.email).charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px]">{user.name ?? user.email}</div>
              <div className="num text-muted">{user.role.toLowerCase()}</div>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <Button size="sm" variant="ghost" className="w-full justify-start" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/60 md:hidden print:hidden" onClick={() => setOpen(false)} aria-hidden />}


      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {tabs.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 min-w-0 flex-1 items-center justify-center px-1 text-[12px] transition-colors duration-150 ease-out",
                active ? "font-semibold text-fg" : "text-muted",
              )}
            >
              <TabLabel label={item.label} count={item.count} />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-14 min-w-0 flex-1 items-center justify-center px-1 text-[12px] transition-colors duration-150 ease-out",
            moreActive ? "font-semibold text-fg" : "text-muted",
          )}
        >
          <TabLabel label="More" count={moreCount || undefined} />
        </button>
      </nav>

      <div className="md:pl-[232px] print:pl-0">
        <header className="sticky top-0 z-10 flex h-12 print:hidden items-center gap-3 border-b border-line bg-bg px-4 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={16} />
          </Button>
          <Breadcrumbs />
          <Link href="/notifications" className="ml-auto flex h-9 items-center gap-2 rounded-md px-2 text-[13px] text-muted transition-colors hover:text-fg" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
            <Bell size={15} aria-hidden />
            {unread > 0 && <span className="num rounded-full bg-accent px-1.5 text-[11px] font-medium text-bg">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        </header>
        <main id="content" key={pathname} className={cn("page-enter mx-auto px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10", /^\/(plans\/[^/]+|pathways)/.test(pathname) ? "max-w-[1440px]" : "max-w-[1100px]")}>{children}</main>
      </div>
    </div>
  );
}
