import { AdminConsole } from "@/components/admin/AdminConsole";
import {
  getAdminEnrollments,
  getAdminOverview,
  getAssignments,
  getCourses,
  getCurrentTerm,
  getCurrentUser,
} from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, assignments, overview, enrollments, user, currentTerm] =
    await Promise.all([
      getCourses(),
      getAssignments(),
      getAdminOverview(),
      getAdminEnrollments(),
      getCurrentUser(),
      getCurrentTerm(),
    ]);
  return (
    <AdminConsole
      courses={courses}
      assignments={assignments}
      overview={overview}
      enrollments={enrollments}
      currentUserId={user.id}
      currentTerm={currentTerm}
    />
  );
}
