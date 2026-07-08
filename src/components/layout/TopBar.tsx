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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-black/5 bg-surface/90 px-3 backdrop-blur sm:gap-3 sm:px-4 md:pl-6 print:hidden">
      {/* Full logo lockup: mark | ACADEMY / SMART LEARNING. Slightly compact
          on phones so the whole bar fits a 360px viewport without forcing a
          horizontal overflow (which shrinks the entire page). */}
      <Link
        href="/dashboard"
        className="focus-ring flex shrink-0 items-center gap-2 sm:gap-2.5"
        aria-label="MoAcademy home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mo-mark.png" alt="mo" className="h-6 w-auto sm:h-7" />
        <span aria-hidden className="h-8 w-px bg-ink/70 sm:h-9" />
        {/* ACADEMY dominates (~4:1 vs the slogan), set in Poppins — the
            logo's typeface */}
        <span className="flex flex-col justify-center gap-[3px] font-display">
          <span className="text-base font-extrabold leading-none tracking-tight text-ink sm:text-xl">
            ACADEMY
          </span>
          <span className="text-[5px] font-medium uppercase leading-none tracking-[0.32em] text-ink-muted sm:text-[6px] sm:tracking-[0.34em]">
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
          className="focus-ring flex items-center gap-2 rounded-full p-1 hover:bg-surface-sunken sm:pr-2"
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
