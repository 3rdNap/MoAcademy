"use client";

import Link from "next/link";
import { CreditCard, Receipt } from "lucide-react";
import { Widget } from "@/components/ui/Widget";
import { Button } from "@/components/ui/Button";
import { useLocalCollection } from "@/lib/local-store";
import { formatMoney } from "@/lib/billing/pricing";
import { formatDate } from "@/lib/utils";
import type { Registration } from "@/lib/billing/registration";

/** Shows the student's registration/payment status on the dashboard. */
export function BillingStatusWidget() {
  const { items, hydrated } = useLocalCollection<Registration>(
    "moacademy.billing.registrations",
    [],
  );

  const subjectCount = items.reduce((n, r) => n + r.items.length, 0);
  const totalPaid = items.reduce((n, r) => n + r.total, 0);
  const latest = items[0];

  return (
    <Widget
      title="Billing"
      icon={<CreditCard className="h-4 w-4 text-brand-600" />}
      action={
        items.length > 0 ? (
          <Link
            href="/billing/registrations"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Invoices
          </Link>
        ) : undefined
      }
    >
      {hydrated && items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <p className="text-sm text-ink-muted">
            You haven&apos;t registered any subjects yet. Registration is per
            subject — the more you take, the less you pay each.
          </p>
          <Link href="/billing">
            <Button size="sm">
              <CreditCard className="h-4 w-4" /> Register subjects
            </Button>
          </Link>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-subtle p-3">
              <p className="text-2xl font-bold leading-none text-ink">
                {subjectCount}
              </p>
              <p className="mt-1 text-xs text-ink-muted">Subjects registered</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-2xl font-bold leading-none text-emerald-700">
                {formatMoney(totalPaid)}
              </p>
              <p className="mt-1 text-xs text-emerald-700/80">Total paid</p>
            </div>
          </div>
          {latest && (
            <Link
              href="/billing/registrations"
              className="mt-3 flex items-center gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-surface-subtle"
            >
              <Receipt className="h-4 w-4 text-ink-faint" />
              <span className="text-ink-muted">
                Latest: {latest.invoiceNo} · {formatDate(latest.createdAt)}
              </span>
            </Link>
          )}
        </div>
      )}
    </Widget>
  );
}
