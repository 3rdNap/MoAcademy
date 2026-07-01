import { AdminConsole } from "@/components/admin/AdminConsole";
import { getAssignments, getCourses } from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [courses, assignments] = await Promise.all([
    getCourses(),
    getAssignments(),
  ]);
  return <AdminConsole courses={courses} assignments={assignments} />;
}
