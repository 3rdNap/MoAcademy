import type { ComponentType } from "react";
import {
  Calendar,
  Compass,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  Library,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { MoMarkIcon } from "@/components/layout/MoMarkIcon";
import type { Role } from "@/lib/types";

/** Lucide icons and the logo-mark icon both fit this shape. */
export type NavIcon =
  | LucideIcon
  | ComponentType<{ className?: string; strokeWidth?: number }>;

export interface GlobalNavItem {
  label: string;
  href: string;
  icon: NavIcon;
  badgeKey?: "inbox";
  /** Shown directly on the mobile bottom bar; the rest go in the More sheet. */
  onMobileBar?: boolean;
  /** Roles that see this item; absent = every role. */
  roles?: Role[];
}

/** Canvas-style global navigation rail items. */
export const globalNav: GlobalNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, onMobileBar: true },
  { label: "Courses", href: "/courses", icon: LayoutGrid, onMobileBar: true },
  { label: "Study Guides", href: "/study-guides", icon: Library },
  { label: "Assistant", href: "/assistant", icon: MoMarkIcon, onMobileBar: true },
  { label: "Practice", href: "/practice", icon: ListChecks, roles: ["student"] },
  { label: "Roadmap", href: "/roadmap", icon: Compass, onMobileBar: true, roles: ["student"] },
  { label: "Calendar", href: "/calendar", icon: Calendar, onMobileBar: true },
  { label: "Inbox", href: "/inbox", icon: Inbox, badgeKey: "inbox" },
  // "Grades" is the student's personal standing; parents use /family, and
  // instructors/admins reach gradebooks from courses/dashboard, not this rail item.
  { label: "Grades", href: "/grades", icon: GraduationCap, roles: ["student"] },
];

export interface CourseNavItem {
  label: string;
  segment: string; // appended to /courses/[id]
}

/** Per-course left navigation, mirroring Canvas course nav. */
export const courseNav: CourseNavItem[] = [
  { label: "Home", segment: "" },
  { label: "Announcements", segment: "announcements" },
  { label: "Modules", segment: "modules" },
  { label: "Assignments", segment: "assignments" },
  { label: "Grades", segment: "grades" },
  { label: "Discussions", segment: "discussions" },
  { label: "People", segment: "people" },
];
