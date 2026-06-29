"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
        <TriangleAlert className="h-6 w-6" />
      </span>
      <h1 className="mt-3 text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        An unexpected error occurred while loading this page. You can try again
        or head back to your dashboard.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={reset}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
        <Link
          href="/dashboard"
          className="focus-ring inline-flex items-center rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-subtle dark:border-white/10"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
