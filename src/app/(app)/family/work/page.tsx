import { redirect } from "next/navigation";
import { ChildWork, type ChildWorkView } from "@/components/family/ChildWork";
import {
  getAuthState,
  getChildCourses,
  getGuardianChildren,
  getWorkFor,
} from "@/lib/data";
import { homeFor } from "@/lib/access";

export const metadata = { title: "Schoolwork" };

/**
 * A guardian's read-only view of their children's assignments — what's been
 * set, what's been handed in, and what's overdue. Submission state comes from
 * public.submissions, which guardians may read but not write (0017 + 0020).
 */
export default async function FamilyWorkPage() {
  const auth = await getAuthState();

  // The Family area belongs to guardians; anyone else goes to their own home.
  if (auth.authed && auth.role !== "parent") redirect(homeFor(auth.role));

  const children = await getGuardianChildren();
  const views: ChildWorkView[] = await Promise.all(
    children.map(async (child) => {
      const courses = await getChildCourses(child.id);
      return { child, work: await getWorkFor(child.id, courses) };
    }),
  );

  return <ChildWork views={views} />;
}
