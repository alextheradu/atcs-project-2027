"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { signOutAction } from "@/lib/account/actions";
import { cn } from "@/lib/utils";

interface ShellProps {
  nav: { href: string; label: string; count?: number }[];
  menu: { href: string; label: string }[];
  home: string;
  user: { name: string | null; email: string; role: string };
  children: React.ReactNode;
}

/** Pages that belong to a nav item without sharing its URL prefix. */
const ALSO_ACTIVE: Record<string, string[]> = {
  "/board": ["/plans"],
  "/students": ["/counselor", "/review"],
};

function useIsActive() {
  const pathname = usePathname();
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  return (href: string) => under(href) || (ALSO_ACTIVE[href] ?? []).some(under);
}

function Count({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <>
      <span aria-hidden className="num text-[12px] font-medium text-muted">{n > 99 ? "99+" : n}</span>
      <span className="sr-only">, {n} waiting</span>
    </>
  );
}

/** The menu under the user's name: their pages that are not places (settings, help, import) and sign out. */
function NameMenu({ user, menu }: Pick<ShellProps, "user" | "menu">) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const name = user.name?.split(" ")[0] || user.email;

  // Close after navigating. Compared during render, the way React recommends, instead of in an effect.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 max-w-[180px] items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-muted transition-colors hover:bg-fill-2 hover:text-fg"
      >
        <span className="truncate">{name}</span>
        <ChevronDown size={14} aria-hidden className={cn("shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-56 rounded-[14px] bg-fill-2 p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.45)]">
          <div className="px-3 pb-2 pt-1.5">
            <div className="truncate text-[14px] font-semibold">{user.name ?? user.email}</div>
            {user.name && <div className="truncate text-[13px] text-muted">{user.email}</div>}
          </div>
          <ul>
            {menu.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="flex h-10 items-center rounded-[10px] px-3 text-[14px] transition-colors hover:bg-fill-3">
                  {m.label}
                </Link>
              </li>
            ))}
            <li>
              <form action={signOutAction}>
                <button type="submit" className="flex h-10 w-full items-center rounded-[10px] px-3 text-left text-[14px] text-muted transition-colors hover:bg-fill-3 hover:text-fg">
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppShell({ nav, menu, home, user, children }: ShellProps) {
  const pathname = usePathname();
  const isActive = useIsActive();

  return (
    <div className="min-h-dvh">
      <a href="#content" className="skip-link print:hidden">Skip to content</a>

      <header className="sticky top-0 z-30 bg-bg print:hidden">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 md:px-8">
          <Link href={home} className="mr-4 text-[16px] font-bold tracking-[-0.02em]">
            Course Planner
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-full px-3.5 text-[14px] transition-colors duration-150",
                    active ? "bg-fill-2 font-semibold text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                  <Count n={item.count} />
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto">
            <NameMenu user={user} menu={menu} />
          </div>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex gap-1 bg-bg px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:hidden print:hidden"
      >
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[14px] transition-colors duration-150",
                active ? "bg-fill-2 font-semibold text-fg" : "text-muted",
              )}
            >
              <span className="truncate">{item.label}</span>
              <Count n={item.count} />
            </Link>
          );
        })}
      </nav>

      <main
        id="content"
        key={pathname}
        className="page-enter mx-auto max-w-[1280px] px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-8"
      >
        {children}
      </main>
    </div>
  );
}
