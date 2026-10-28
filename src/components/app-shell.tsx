"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

interface ShellProps {
  nav: { href: string; label: string }[];
  user: { name: string | null; email: string; role: string };
  children: React.ReactNode;
}

function Breadcrumbs() {
  const parts = usePathname().split("/").filter(Boolean);
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted">
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
    <div className="min-h-screen">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r border-line bg-bg transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Course Planner
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X size={16} />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-md px-3 text-sm text-muted hover:bg-elevated hover:text-fg",
                  active && "bg-elevated text-fg shadow-[inset_2px_0_0_var(--accent)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-3">
          <div className="truncate text-sm">{user.name ?? user.email}</div>
          <div className="font-mono text-xs text-muted">{user.role}</div>
          <form action={signOutAction} className="mt-3">
            <Button size="sm" className="w-full" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/60 md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="md:pl-[232px]">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu size={16} />
          </Button>
          <Breadcrumbs />
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
