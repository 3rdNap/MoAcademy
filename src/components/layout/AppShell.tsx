import { GlobalNav } from "./GlobalNav";
import { TopBar } from "./TopBar";
import { RoleProvider } from "@/components/role/RoleProvider";
import { getCourses, getCurrentUser } from "@/lib/data";

/**
 * The persistent application chrome: global rail + top bar, with the routed
 * page rendered in the main content area. Wrapped in RoleProvider so the whole
 * app can adapt to the previewed role (student vs. instructor).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const [user, courses] = await Promise.all([getCurrentUser(), getCourses()]);

  return (
    <RoleProvider>
      <div className="min-h-full">
        <GlobalNav />
        <div className="md:pl-[84px] print:!pl-0">
          <TopBar user={user} courses={courses} />
          {/* Full-bleed content: no width cap, just a small even gutter on
              both sides so pages fill the screen. */}
          <main className="w-full px-4 pb-24 pt-6 md:px-6 md:pb-10 print:!p-0">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
