import { AdminConsole } from "@/components/admin/AdminConsole";
import {
  getAdminOverview,
  getAssignments,
  getCourses,
  getCurrentUser,
} from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, assignments, overview, user] = await Promise.all([
    getCourses(),
    getAssignments(),
    getAdminOverview(),
    getCurrentUser(),
  ]);
  return (
    <AdminConsole
      courses={courses}
      assignments={assignments}
      overview={overview}
      currentUserId={user.id}
    />
  );
}
