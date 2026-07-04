"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye } from "lucide-react";
import { useRole } from "./RoleProvider";
import { ROLES, roleBlurb, roleLabel } from "@/lib/role";
import { cn } from "@/lib/utils";

/** "Viewing as" role preview switcher (Canvas-style Student View). */
export function RoleSwitcher() {
  const { role, setRole, hydrated } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "focus-ring flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-sunken",
          open && "bg-surface-sunken",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Switch the view you're previewing"
      >
        <Eye className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Viewing as</span>
        <span className="hidden font-semibold text-ink sm:inline">
          {hydrated ? roleLabel[role] : roleLabel.student}
        </span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-64 overflow-hidden rounded-xl border border-black/5 bg-surface shadow-cardhover"
        >
          <p className="border-b border-black/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Preview as
          </p>
          <ul className="py-1">
            {ROLES.map((r) => (
              <li key={r}>
                <button
                  onClick={() => {
                    setRole(r);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-subtle"
                  role="menuitem"
                >
                  <span className="mt-0.5 w-4">
                    {role === r && <Check className="h-4 w-4 text-brand-600" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {roleLabel[r]}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      {roleBlurb[r]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
