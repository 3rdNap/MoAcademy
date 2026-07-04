import { AppShell } from "@/components/layout/AppShell";

/**
 * Layout for the signed-in application: global nav rail, top bar, and the
 * routed page. The public landing page at / lives outside this group so it
 * can render without the app chrome.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
