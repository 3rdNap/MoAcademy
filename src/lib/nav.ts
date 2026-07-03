import {
  Calendar,
  Compass,
  CreditCard,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  Library,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface GlobalNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "inbox";
  /** Shown directly on the mobile bottom bar; the rest go in the More sheet. */
  onMobileBar?: boolean;
}

/** Canvas-style global navigation rail items. */
export const globalNav: GlobalNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home, onMobileBar: true },
  { label: "Courses", href: "/courses", icon: LayoutGrid, onMobileBar: true },
  { label: "Study Guides", href: "/study-guides", icon: Library },
  { label: "Assistant", href: "/assistant", icon: Sparkles, onMobileBar: true },
  { label: "Roadmap", href: "/roadmap", icon: Compass, onMobileBar: true },
  { label: "Calendar", href: "/calendar", icon: Calendar, onMobileBar: true },
  { label: "Inbox", href: "/inbox", icon: Inbox, badgeKey: "inbox" },
  { label: "Grades", href: "/grades", icon: GraduationCap },
  { label: "Billing", href: "/billing", icon: CreditCard },
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
