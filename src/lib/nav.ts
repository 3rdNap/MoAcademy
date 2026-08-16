import type { ComponentType } from "react";
import {
  Calendar,
  ClipboardList,
  Compass,
  CreditCard,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  Library,
  ListChecks,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BrandMarkIcon } from "@/components/brand/BrandMark";
import { AREA_HREF, ROLE_AREAS, type AreaKey } from "./access";
import type { Role } from "./types";

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
}

/** Nav presentation for each area; the route policy lives in lib/access.ts. */
const AREA_NAV: Record<AreaKey, Omit<GlobalNavItem, "href">> = {
  dashboard: { label: "Dashboard", icon: Home, onMobileBar: true },
  family: { label: "Family", icon: Users, onMobileBar: true },
  work: { label: "Schoolwork", icon: ClipboardList, onMobileBar: true },
  admin: { label: "Admin", icon: ShieldCheck },
  courses: { label: "Courses", icon: LayoutGrid, onMobileBar: true },
  guides: { label: "Study Guides", icon: Library },
  assistant: { label: "Assistant", icon: BrandMarkIcon, onMobileBar: true },
  practice: { label: "Practice", icon: ListChecks },
  roadmap: { label: "Roadmap", icon: Compass, onMobileBar: true },
  calendar: { label: "Calendar", icon: Calendar, onMobileBar: true },
  inbox: { label: "Inbox", icon: Inbox, badgeKey: "inbox" },
  grades: { label: "Grades", icon: GraduationCap },
  billing: { label: "Billing", icon: CreditCard },
};

/** The global navigation rail, as this role should see it. */
export function navFor(role: Role): GlobalNavItem[] {
  return ROLE_AREAS[role].map((key) => ({
    ...AREA_NAV[key],
    href: AREA_HREF[key],
  }));
}

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
