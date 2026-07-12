import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Enrolment & fees" };

/**
 * MoAcademy runs as an institution: students don't self-register or pay for
 * subjects here. Enrolment is handled by the academy office, so this page is
 * an informational notice (the route stays so old links don't 404).
 */
export default function BillingPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <GraduationCap className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-bold text-ink">Enrolment &amp; fees</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Subjects are assigned by the academy office — there&apos;s no
          self-registration or checkout. Once you&apos;re enrolled, your
          subjects appear automatically as courses with their content,
          deadlines and study guides.
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Fee arrangements are handled directly with the office. Contact your
          administrator to enrol in or drop a subject, or to discuss fees.
        </p>
        <Link
          href="/courses"
          className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to my courses
        </Link>
      </div>
    </div>
  );
}
