import { AdminConsole } from "@/components/admin/AdminConsole";
import {
  getAdminOverview,
  getAssignments,
  getCourses,
  getCurrentTerm,
  getCurrentUser,
} from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, assignments, overview, user, currentTerm] = await Promise.all([
    getCourses(),
    getAssignments(),
    getAdminOverview(),
    getCurrentUser(),
    getCurrentTerm(),
  ]);
  return (
    <AdminConsole
      courses={courses}
      assignments={assignments}
      overview={overview}
      currentUserId={user.id}
      currentTerm={currentTerm}
    />
  );
}
