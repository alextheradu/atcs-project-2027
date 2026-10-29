"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

interface ShellProps {
  nav: { href: string; label: string; group: string }[];
  user: { name: string | null; email: string; role: string };
  children: React.ReactNode;
}

const LABEL_AFTER: Record<string, string> = { plans: "Plan", catalog: "Course" };
/** A database id in the URL is not something to show. Name it after what it is. */
const isId = (s: string) => /^[a-z0-9]{20,}$/i.test(s) && /\d/.test(s);

function Breadcrumbs() {
  const raw = usePathname().split("/").filter(Boolean);
  const parts = raw.map((p, i) => (isId(p) ? (LABEL_AFTER[raw[i - 1]] ?? "Details") : p));
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

export function AppShell({ nav, user, children }: ShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      <a href="#content" className="skip-link">Skip to content</a>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r border-line bg-bg transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
            <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-fg font-mono text-[10px] font-bold text-bg">
              C
            </span>
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
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-8 items-center rounded-md pl-7 pr-3 text-[13px] text-muted transition-colors duration-150 ease-out hover:bg-raised hover:text-fg",
                          active && "bg-raised font-medium text-fg",
                        )}
                      >
                        {active && <span aria-hidden className="absolute left-3 size-1.5 rounded-full bg-accent" />}
                        {item.label}
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

      {open && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}


      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {nav
          .filter((n) => n.group === "Workspace")
          .map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px] transition-colors duration-150 ease-out",
                  active ? "font-medium text-fg" : "text-muted",
                )}
              >
                <span aria-hidden className={cn("size-1.5 rounded-full transition-colors duration-150", active ? "bg-accent" : "bg-transparent")} />
                {item.label}
              </Link>
            );
          })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px] text-muted"
        >
          <span aria-hidden className="size-1.5" />
          More
        </button>
      </nav>

      <div className="md:pl-[232px]">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-line bg-bg px-4 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={16} />
          </Button>
          <Breadcrumbs />
        </header>
        <main id="content" key={pathname} className={cn("page-enter mx-auto px-4 pb-28 pt-8 md:px-8 md:pb-16 md:pt-10", /^\/(plans\/[^/]+|pathways)/.test(pathname) ? "max-w-[1440px]" : "max-w-[1100px]")}>{children}</main>
      </div>
    </div>
  );
}
