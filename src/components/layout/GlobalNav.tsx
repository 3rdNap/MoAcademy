"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { globalNav, type GlobalNavItem } from "@/lib/nav";
import { useRole } from "@/components/role/RoleProvider";
import { isParent } from "@/lib/role";
import { cn } from "@/lib/utils";

/**
 * Canvas-style vertical global navigation rail (desktop). Collapses to a
 * bottom tab bar on mobile.
 */
export function GlobalNav() {
  const pathname = usePathname();
  const { role, hydrated } = useRole();

  // Parents get a "Family" entry (surfaced after hydration to avoid mismatch).
  const familyItem: GlobalNavItem = {
    label: "Family",
    href: "/family",
    icon: Users,
  };
  const items: GlobalNavItem[] =
    hydrated && isParent(role)
      ? [globalNav[0], familyItem, ...globalNav.slice(1)]
      : globalNav;

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/" || pathname.startsWith("/dashboard")
      : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Global"
        className="fixed inset-y-0 left-0 z-40 hidden w-[84px] flex-col items-center bg-brand-950 py-4 text-white md:flex"
      >
        <Link
          href="/dashboard"
          className="focus-ring mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-black tracking-tight"
          aria-label="MoAcademy home"
        >
          Mo
        </Link>
        <ul className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "focus-ring group flex w-[72px] flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-brand-200 hover:bg-white/10 hover:text-white",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Global"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-black/10 bg-brand-950 px-2 py-1 text-white md:hidden"
      >
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium",
                active ? "text-white" : "text-brand-200",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
