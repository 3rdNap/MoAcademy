import { FamilyDashboard } from "@/components/family/FamilyDashboard";
import {
  getActivity,
  getAnnouncements,
  getAssignments,
  getCourses,
} from "@/lib/data";

export const metadata = { title: "Family" };

export default async function FamilyPage() {
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
