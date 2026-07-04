import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Course, User } from "@/lib/types";
import { CourseSwitcher } from "./CourseSwitcher";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";
import { RoleSwitcher } from "@/components/role/RoleSwitcher";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Brightspace-style top bar: brand wordmark, course "waffle" switcher,
 * global search, notifications, and the account avatar.
 */
export function TopBar({ user, courses }: { user: User; courses: Course[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/5 bg-surface/90 px-4 backdrop-blur md:pl-6">
      <Link
        href="/dashboard"
        className="focus-ring flex items-center gap-2"
        aria-label="MoAcademy home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mo-mark.png" alt="mo" className="h-6 w-auto" />
        <span className="hidden flex-col justify-center sm:flex">
          <span className="text-sm font-black leading-none tracking-tight text-ink">
            ACADEMY
          </span>
          <span className="text-[8px] font-medium uppercase tracking-[0.28em] text-ink-faint">
            Smart Learning
          </span>
        </span>
      </Link>

      <CourseSwitcher courses={courses} />

      <div className="ml-auto flex items-center gap-1.5">
        <RoleSwitcher />
        <GlobalSearch />

        <ThemeToggle />
        <NotificationBell />

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
