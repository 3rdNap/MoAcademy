import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">Page not found</h1>
      <p className="mt-1 text-sm text-ink-muted">
        We couldn&apos;t find what you were looking for.
      </p>
      <Link
        href="/dashboard"
        className="focus-ring mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
