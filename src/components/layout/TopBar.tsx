import Link from "next/link";
import { Bell, ChevronDown, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Course, User } from "@/lib/types";
import { CourseSwitcher } from "./CourseSwitcher";
import { RoleSwitcher } from "@/components/role/RoleSwitcher";

/**
 * Brightspace-style top bar: brand wordmark, course "waffle" switcher,
 * global search, notifications, and the account avatar.
 */
export function TopBar({ user, courses }: { user: User; courses: Course[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/5 bg-surface/90 px-4 backdrop-blur md:pl-6">
      <Link
        href="/dashboard"
        className="focus-ring flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink"
      >
        <span className="text-brand-600">Mo</span>Academy
      </Link>

      <CourseSwitcher courses={courses} />

      <div className="ml-auto flex items-center gap-1.5">
        <RoleSwitcher />
        <div className="relative hidden lg:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search courses, assignments…"
            className="focus-ring h-9 w-64 rounded-full border border-black/10 bg-surface-subtle pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint"
            aria-label="Search"
          />
        </div>

        <button
          className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />
        </button>

        <Link
          href="/account"
          className="focus-ring flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-surface-sunken"
        >
          <Avatar initials={user.initials} color={user.avatarColor} size={32} />
          <span className="hidden text-sm font-medium text-ink sm:block">
            {user.name.split(" ")[0]}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-ink-faint sm:block" />
        </Link>
      </div>
    </header>
  );
}
