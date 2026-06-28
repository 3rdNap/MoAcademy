"use client";

import { Plus } from "lucide-react";
import { InstructorOnly } from "./InstructorOnly";

/** An instructor-only "add" button for page headers (e.g. + Module). */
export function NewItemButton({ label }: { label: string }) {
  return (
    <InstructorOnly>
      <button className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
        <Plus className="h-4 w-4" />
        {label}
      </button>
    </InstructorOnly>
  );
}
