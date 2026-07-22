import { AdminConsole } from "@/components/admin/AdminConsole";
import {
  getAdminEnrollments,
  getAdminOverview,
  getAssignments,
  getAuthState,
  getAutomationAgents,
  getAutomationLog,
  getCourses,
  getCurrentTerm,
  getCurrentUser,
} from "@/lib/data";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const [
    courses,
    assignments,
    overview,
    enrollments,
    user,
    auth,
    currentTerm,
    agents,
    automationLog,
  ] = await Promise.all([
    getCourses(),
    getAssignments(),
    getAdminOverview(),
    getAdminEnrollments(),
    getCurrentUser(),
    getAuthState(),
    getCurrentTerm(),
    getAutomationAgents(),
    getAutomationLog(),
  ]);
  return (
    <AdminConsole
      courses={courses}
      assignments={assignments}
      overview={overview}
      enrollments={enrollments}
      currentUserId={user.id}
      authedRole={auth.authed ? auth.role : null}
      currentTerm={currentTerm}
      agents={agents ?? []}
      automationLog={automationLog ?? []}
    />
  );
}
