"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, FileText, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "My Goals", href: "/roadmap", icon: Compass },
  { label: "Applications", href: "/roadmap/applications", icon: FileText },
  { label: "Scholarships & Bursaries", href: "/roadmap/scholarships", icon: GraduationCap },
];

export function RoadmapTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-black/5">
      {tabs.map((t) => {
        const active =
          t.href === "/roadmap"
            ? pathname === "/roadmap"
            : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
