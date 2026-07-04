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
      {/* Full logo lockup: mark | ACADEMY / SMART LEARNING */}
      <Link
        href="/dashboard"
        className="focus-ring flex shrink-0 items-center gap-2.5"
        aria-label="MoAcademy home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mo-mark.png" alt="mo" className="h-7 w-auto" />
        <span aria-hidden className="h-9 w-px bg-ink/70" />
        {/* ACADEMY dominates (~4:1 vs the slogan), set in Poppins — the
            logo's typeface */}
        <span className="flex flex-col justify-center gap-[3px] font-display">
          <span className="text-xl font-extrabold leading-none tracking-tight text-ink">
            ACADEMY
          </span>
          <span className="text-[6px] font-medium uppercase leading-none tracking-[0.34em] text-ink-muted">
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
