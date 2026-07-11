import { FamilyDashboard } from "@/components/family/FamilyDashboard";
import { GuardianFamily, type ChildView } from "@/components/family/GuardianFamily";
import {
  getActivity,
  getAnnouncements,
  getAnnouncementsForCourses,
  getAssignments,
  getAssignmentsForCourses,
  getAuthState,
  getChildCourses,
  getChildGrades,
  getCourses,
  getGuardianChildren,
} from "@/lib/data";
import { daysUntil } from "@/lib/utils";

export const metadata = { title: "Family" };

export default async function FamilyPage() {
  const auth = await getAuthState();

  // Real parent/guardian accounts see their linked children (migration 0017).
  if (auth.authed && auth.role === "parent") {
    const children = await getGuardianChildren();
    const childrenData: ChildView[] = await Promise.all(
      children.map(async (child) => {
        const courses = await getChildCourses(child.id);
        const courseIds = courses.map((c) => c.id);
        const [assignments, announcements, grades] = await Promise.all([
          getAssignmentsForCourses(courseIds),
          getAnnouncementsForCourses(courseIds),
          getChildGrades(child.id),
        ]);
        const upcoming = assignments
          .filter((a) => daysUntil(a.dueAt) >= 0 && daysUntil(a.dueAt) <= 14)
          .slice(0, 8);
        return {
          child,
          courses,
          upcoming,
          announcements: announcements.slice(0, 6),
          grades,
        };
      }),
    );
    return <GuardianFamily childrenData={childrenData} />;
  }

  // Anonymous demo: the seeded sibling dashboard.
  const [courses, assignments, announcements, activity] = await Promise.all([
    getCourses(),
    getAssignments(),
    getAnnouncements(),
    getActivity(),
  ]);

  return (
    <FamilyDashboard
      courses={courses}
      assignments={assignments}
      announcements={announcements}
      activity={activity}
    />
  );
}
