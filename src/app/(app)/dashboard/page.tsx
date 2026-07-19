import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CalendarClock,
  GraduationCap,
  Megaphone,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Widget } from "@/components/ui/Widget";
import { AdminHome } from "@/components/dashboard/AdminHome";
import { CourseCard } from "@/components/dashboard/CourseCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { UpcomingList } from "@/components/dashboard/UpcomingList";
import { RoadmapDeadlinesWidget } from "@/components/dashboard/RoadmapDeadlinesWidget";
import { PinnedCourses } from "@/components/dashboard/PinnedCourses";
import { StudyPlanWidget } from "@/components/dashboard/StudyPlanWidget";
import { RolePreviewBanner } from "@/components/role/RolePreviewBanner";
import { GuardianProvisioner } from "@/components/family/GuardianProvisioner";
import { InstructorDashboard } from "@/components/dashboard/InstructorDashboard";
import {
  getActivity,
  getAdminDashboard,
  getAdminOverview,
  getAnnouncements,
  getAuthState,
  getCourses,
  getCurrentTerm,
  getCurrentUser,
  getUpcoming,
} from "@/lib/data";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const auth = await getAuthState();

  // Admins get an institution-focused home instead of the student layout.
  if (auth.authed && auth.role === "admin") {
    const [user, overview, dashboard, currentTerm] = await Promise.all([
      getCurrentUser(),
      getAdminOverview(),
      getAdminDashboard(),
      getCurrentTerm(),
    ]);
    return (
      <AdminHome
        name={user.name}
        overview={overview}
        dashboard={dashboard}
        currentTerm={currentTerm}
      />
    );
  }

  // Parents/guardians land on their family view (their child's progress).
  if (auth.authed && auth.role === "parent") {
    redirect("/family");
  }

  // Instructors get a teaching home (grading backlog, teaching tools, the
  // courses they teach) instead of the student enrolment/study-plan layout.
  if (auth.authed && auth.role === "instructor") {
    const [user, courses, announcements] = await Promise.all([
      getCurrentUser(),
      getCourses(),
      getAnnouncements(),
    ]);
    return (
      <InstructorDashboard
        user={user}
        courses={courses}
        announcements={announcements}
      />
    );
  }

  const [user, courses, upcoming, activity, announcements] = await Promise.all([
    getCurrentUser(),
    getCourses(),
    getUpcoming(),
    getActivity(),
    getAnnouncements(),
  ]);

  const overdue = upcoming.filter(
    (a) => new Date(a.dueAt).getTime() < Date.now() && a.status !== "graded",
  ).length;

  return (
    <>
      <RolePreviewBanner />
      <GuardianProvisioner />
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        subtitle={
          courses.length === 0
            ? `Welcome to MoAcademy · ${formatDate(new Date().toISOString())}`
            : `You're enrolled in ${courses.length} course${
                courses.length === 1 ? "" : "s"
              } this term · ${formatDate(new Date().toISOString())}`
        }
        action={
          <Link
            href="/courses"
            className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            View all courses
          </Link>
        }
      />

      {/* Quick stat strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Due this week"
          value={String(upcoming.length)}
          tone="text-brand-600"
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Overdue"
          value={String(overdue)}
          tone={overdue ? "text-rose-600" : "text-emerald-600"}
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Active courses"
          value={String(courses.filter((c) => c.published).length)}
          tone="text-sky-600"
        />
        <StatCard
          icon={<Megaphone className="h-5 w-5" />}
          label="New announcements"
          value={String(announcements.length)}
          tone="text-amber-600"
        />
      </div>

      <PinnedCourses courses={courses} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Courses + planning */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
                Your courses
              </h2>
            </div>
            {courses.length === 0 ? (
              <div className="card flex flex-col items-start gap-2 p-6">
                <p className="font-semibold text-ink">No subjects yet</p>
                <p className="text-sm text-ink-muted">
                  You haven&apos;t been enrolled in any subjects yet. Your
                  administrator assigns your subjects, and they&apos;ll appear
                  here as courses with their content, deadlines and study guides.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>

          {/* Planning: roadmap deadlines (from the browser) */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Planning
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RoadmapDeadlinesWidget />
            </div>
          </section>
        </div>

        {/* Right column widgets */}
        <div className="space-y-6">
          <StudyPlanWidget upcoming={upcoming} courses={courses} />
          <Widget
            title="Upcoming"
            icon={<CalendarClock className="h-4 w-4 text-brand-600" />}
            action={
              <Link
                href="/calendar"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Calendar
              </Link>
            }
            bodyClassName="pt-1"
          >
            <UpcomingList items={upcoming.slice(0, 6)} courses={courses} />
          </Widget>

          <Widget
            title="Recent activity"
            icon={<Activity className="h-4 w-4 text-brand-600" />}
            bodyClassName="pt-1"
          >
            <ActivityFeed events={activity} />
          </Widget>

          <Widget
            title="Announcements"
            icon={<Megaphone className="h-4 w-4 text-brand-600" />}
          >
            <ul className="space-y-3">
              {announcements.map((an) => (
                <li key={an.id}>
                  <p className="text-sm font-medium text-ink">{an.title}</p>
                  <p className="text-xs text-ink-muted">
                    {an.author} · {relativeTime(an.postedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Widget>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle ${tone}`}>
        {icon}
      </span>
      <div>
        <p className="text-xl font-bold leading-none text-ink">{value}</p>
        <p className="mt-1 text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
