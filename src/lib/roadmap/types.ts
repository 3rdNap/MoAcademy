// Domain model for the University Roadmap feature.
// All of this is user-owned, editable content — students populate it themselves
// because requirements, dates and offers change over time.

export type Priority = "reach" | "target" | "safety";

/** A single admission requirement, with both the minimum and the level that
 *  actually makes you competitive enough to "guarantee" a place. */
export interface RequirementItem {
  id: string;
  label: string;
  /** The published minimum (e.g. "50%", "Level 4"). */
  minimum?: string;
  /** The competitive bar to be safe (e.g. "75%", "Level 6"). */
  recommended?: string;
  met: boolean;
}

/** An institution + programme the student is aiming for. */
export interface TargetInstitution {
  id: string;
  institution: string;
  program: string;
  location?: string;
  priority: Priority;
  /** Minimum admission points score the institution publishes. */
  minAps?: number;
  /** Points that make admission safe/competitive (the "guarantee" target). */
  targetAps?: number;
  /** The student's current standing, for gap tracking. */
  currentAps?: number;
  requirements: RequirementItem[];
  notes?: string;
}

export type ApplicationStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "accepted"
  | "waitlisted"
  | "rejected";

/** An institution's application window and resources. */
export interface ApplicationEntry {
  id: string;
  institution: string;
  program?: string;
  /** ISO date the application portal opens. */
  opensAt?: string;
  /** ISO date applications close. */
  closesAt?: string;
  applyUrl?: string;
  /** A link to the prospectus PDF/page. */
  prospectusUrl?: string;
  /** Name of an uploaded prospectus file, if one was attached. */
  prospectusFileName?: string;
  /** Data URL of a small uploaded prospectus, kept locally. */
  prospectusData?: string;
  status: ApplicationStatus;
  notes?: string;
}

/** A scholarship or bursary opportunity. */
export interface Scholarship {
  id: string;
  name: string;
  provider: string;
  /** What it covers, e.g. "Full tuition + stipend". */
  coverage?: string;
  /** ISO closing date. */
  closesAt?: string;
  url?: string;
  requirements: string[];
  notes?: string;
}
