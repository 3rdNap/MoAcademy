import { AdminConsole } from "@/components/admin/AdminConsole";
import { getAdminOverview, getAssignments, getCourses } from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, assignments, overview] = await Promise.all([
    getCourses(),
    getAssignments(),
    getAdminOverview(),
  ]);
  return (
    <AdminConsole
      courses={courses}
      assignments={assignments}
      overview={overview}
    />
  );
}
