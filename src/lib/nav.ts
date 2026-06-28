import {
  Calendar,
  Compass,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

export interface GlobalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "inbox";
}

/** Canvas-style global navigation rail items. */
export const globalNav: GlobalNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Courses", href: "/courses", icon: LayoutGrid },
  { label: "Roadmap", href: "/roadmap", icon: Compass },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Inbox", href: "/inbox", icon: Inbox, badgeKey: "inbox" },
  { label: "Grades", href: "/grades", icon: GraduationCap },
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
