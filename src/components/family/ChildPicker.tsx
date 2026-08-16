"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { GuardianChild } from "@/lib/data";
import { initialsOf } from "@/lib/utils";

/** Shared child selector for guardians following more than one student. */
export function ChildPicker({
  views,
  childId,
  onSelect,
}: {
  views: { child: GuardianChild }[];
  childId: string;
  onSelect: (id: string) => void;
}) {
  if (views.length < 2) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Children">
      {views.map(({ child }) => {
        const active = child.id === childId;
        return (
          <button
            key={child.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(child.id)}
            className={`focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-black/10 text-ink-muted hover:bg-surface-subtle dark:border-white/10"
            }`}
          >
            <Avatar
              initials={initialsOf(child.name || child.email)}
              color={child.avatarColor}
              size={20}
            />
            {child.name || child.email}
          </button>
        );
      })}
    </div>
  );
}
