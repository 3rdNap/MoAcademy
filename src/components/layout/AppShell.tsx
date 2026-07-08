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
      {/* First focusable element: keyboard/screen-reader users can jump
          straight past the nav to the page content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-cardhover"
      >
        Skip to main content
      </a>
      <div className="min-h-full">
        <GlobalNav />
        <div className="md:pl-[84px] print:!pl-0">
          <TopBar user={user} courses={courses} />
          {/* Full-bleed content: no width cap, just a small even gutter on
              both sides so pages fill the screen. */}
          <main
            id="main-content"
            tabIndex={-1}
            className="w-full px-4 pb-24 pt-6 outline-none md:px-6 md:pb-10 print:!p-0"
          >
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
