import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Accounts" };

/**
 * Public self-signup is closed: MoAcademy is an institution, so accounts are
 * issued by an administrator (name@moacademy.com + a temporary password), not
 * created by visitors. This page explains that and points to sign-in.
 */
export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center">
      <div className="card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-xl font-bold text-ink">
          Accounts are issued by your institution
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          MoAcademy doesn&apos;t use public sign-up. Your administrator creates
          your account and gives you a MoAcademy login
          (<span className="font-medium">name@moacademy.com</span>) and a
          temporary password. You&apos;ll set your own password the first time
          you sign in.
        </p>
        <Link
          href="/login"
          className="focus-ring mt-5 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Go to sign in
        </Link>
        <p className="mt-4 text-xs text-ink-faint">
          Need an account or lost your password? Contact your administrator.
        </p>
      </div>
    </div>
  );
}
