// Core domain model for MoAcademy.
// These types are shared by the seed-data layer and the (optional) Supabase
// data source so pages can stay agnostic about where data comes from.

export type Role = "student" | "instructor" | "admin" | "parent";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string; // tailwind-friendly hex for the avatar fallback
  initials: string;
}

// Was a literal union of known terms; loosened to string because the active
// term is now admin-settable at runtime (app_settings, migration 0029).
export type CourseTerm = string;

export interface Course {
  id: string;
  code: string; // e.g. "CS-101"
  name: string;
  shortName: string;
  term: CourseTerm;
  description: string;
  /** Hex used for the course card banner + nav accent (Canvas-style color). */
  color: string;
  instructor: string;
  credits: number;
  published: boolean;
  /** 0–100 progress through course content for the current user. */
  progress: number;
}

export type ModuleItemType =
  | "page"
  | "assignment"
  | "quiz"
  | "discussion"
  | "file"
  | "link"
  | "video";

export interface ModuleItem {
  id: string;
  title: string;
  type: ModuleItemType;
  /** Optional due date for assignment/quiz items. */
  dueAt?: string;
  completed?: boolean;
  /** Minutes of estimated effort, shown Brightspace-style. */
  durationMin?: number;
  indent?: number;
  /** Rich content by type (migration 0034): page body, external/video URL,
   *  or the storage path of an uploaded file in the public course-files bucket. */
  body?: string;
  url?: string;
  filePath?: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  published: boolean;
  items: ModuleItem[];
}

export type SubmissionStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "late"
  | "missing";

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  type: Exclude<ModuleItemType, "page" | "file" | "link" | "video">;
  dueAt: string;
  availableAt?: string;
  points: number;
  status: SubmissionStatus;
  score?: number;
  description: string;
  /** Weighted grading bucket (assignment_groups, migration 0029). */
  groupId?: string;
}

export interface Announcement {
  id: string;
  courseId: string;
  title: string;
  author: string;
  postedAt: string;
  body: string;
}

export type ActivityKind =
  | "announcement"
  | "grade"
  | "submission"
  | "comment"
  | "due_soon"
  | "enrollment";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  courseId?: string;
  title: string;
  detail: string;
  at: string;
}

export interface CalendarEvent {
  id: string;
  courseId?: string;
  title: string;
  at: string;
  type: "assignment" | "quiz" | "event" | "office_hours";
}
