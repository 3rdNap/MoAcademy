"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, ShieldCheck, Users, X } from "lucide-react";
import { globalNav, type GlobalNavItem } from "@/lib/nav";
import { useRole } from "@/components/role/RoleProvider";
import { isAdmin, isParent } from "@/lib/role";
import { cn } from "@/lib/utils";

/** How many items fit comfortably in the mobile tab bar before "More". */
const MOBILE_PRIMARY = 4;

/**
 * Canvas-style vertical global navigation rail (desktop). Collapses to a
 * bottom tab bar on mobile, where only the primary items are shown and the
 * rest live behind a "More" sheet.
 */
export function GlobalNav() {
  const pathname = usePathname();
  const { role, hydrated } = useRole();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the More sheet whenever navigation happens.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Role-specific entries (surfaced after hydration to avoid a mismatch).
  const familyItem: GlobalNavItem = { label: "Family", href: "/family", icon: Users };
  const adminItem: GlobalNavItem = { label: "Admin", href: "/admin", icon: ShieldCheck };
  const items: GlobalNavItem[] = !hydrated
    ? globalNav
    : isParent(role)
      ? [globalNav[0], familyItem, ...globalNav.slice(1)]
      : isAdmin(role)
        ? [globalNav[0], adminItem, ...globalNav.slice(1)]
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

      {/* Mobile: primary tabs + a "More" sheet for the rest */}
      <MobileBar
        items={items}
        isActive={isActive}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
      />
    </>
  );
}

function MobileBar({
  items,
  isActive,
  moreOpen,
  setMoreOpen,
}: {
  items: GlobalNavItem[];
  isActive: (href: string) => boolean;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
}) {
  const primary = items.slice(0, MOBILE_PRIMARY);
  const overflow = items.slice(MOBILE_PRIMARY);
  const overflowActive = overflow.some((item) => isActive(item.href));

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="More navigation">
          <button
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-[3.75rem] rounded-t-2xl bg-brand-950 p-4 pb-2 text-white shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                More
              </p>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="focus-ring rounded-lg p-1 text-brand-200 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {overflow.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "focus-ring flex flex-col items-center gap-1 rounded-xl px-1 py-3 text-center text-[11px] font-medium",
                      active
                        ? "bg-white/15 text-white"
                        : "text-brand-200 hover:bg-white/10 hover:text-white",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-6 w-6" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <nav
        aria-label="Global"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-black/10 bg-brand-950 px-2 py-1 text-white md:hidden"
      >
        {primary.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "focus-ring flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium",
                active && !moreOpen ? "text-white" : "text-brand-200",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={active && !moreOpen ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          aria-expanded={moreOpen}
          className={cn(
            "focus-ring flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-medium",
            moreOpen || overflowActive ? "text-white" : "text-brand-200",
          )}
        >
          <MoreHorizontal
            className="h-5 w-5"
            strokeWidth={moreOpen || overflowActive ? 2.4 : 2}
          />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
