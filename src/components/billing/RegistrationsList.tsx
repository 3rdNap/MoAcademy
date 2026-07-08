"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, Printer, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useLocalCollection } from "@/lib/local-store";
import { formatMoney } from "@/lib/billing/pricing";
import {
  fetchRemoteRegistrations,
  removeRemoteRegistration,
} from "@/lib/billing/registration-db";
import {
  paymentMethodLabel,
  type Registration,
} from "@/lib/billing/registration";
import { formatDate } from "@/lib/utils";

export function RegistrationsList() {
  const {
    items: local,
    remove,
    hydrated,
  } = useLocalCollection<Registration>("moacademy.billing.registrations", []);

  // Merge in server-side invoices for the signed-in student (they win on id
  // clashes — a checkout stores both copies).
  const [remote, setRemote] = useState<Registration[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRemoteRegistrations().then((r) => alive && setRemote(r));
    return () => {
      alive = false;
    };
  }, []);

  const remoteIds = useMemo(
    () => new Set((remote ?? []).map((r) => r.id)),
    [remote],
  );
  const items = useMemo(
    () => [...(remote ?? []), ...local.filter((r) => !remoteIds.has(r.id))],
    [remote, local, remoteIds],
  );

  async function removeRegistration(id: string) {
    if (remoteIds.has(id)) {
      if (await removeRemoteRegistration(id)) {
        setRemote((prev) => (prev ?? []).filter((r) => r.id !== id));
      }
    }
    remove(id); // clears any local copy of the same invoice too
  }

  const totalPaid = items
    .filter((r) => r.status !== "pending")
    .reduce((sum, r) => sum + r.total, 0);

  if (hydrated && items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Receipt className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-ink">No registrations yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Register your subjects and your paid invoices will appear here.
          </p>
        </div>
        <Link href="/billing">
          <Button>
            <CreditCard className="h-4 w-4" /> Register subjects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-surface-subtle px-4 py-3 text-sm">
          <span className="text-ink-muted">
            <span className="font-semibold text-ink">{items.length}</span>{" "}
            registration{items.length === 1 ? "" : "s"}
          </span>
          <span className="text-ink-muted">
            Total paid:{" "}
            <span className="font-semibold text-ink">
              {formatMoney(totalPaid)}
            </span>
          </span>
        </div>
      )}

      <div className="space-y-4">
        {items.map((r) => (
          <article key={r.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 bg-surface-subtle px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-ink">{r.invoiceNo}</h2>
                  {r.status === "pending" ? (
                    <Badge tone="warning">Processing</Badge>
                  ) : (
                    <Badge tone="success">Paid</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-faint">
                  {formatDate(r.createdAt)} · {r.term} ·{" "}
                  {paymentMethodLabel[r.method]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => window.print()}
                  className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/10 px-3 text-xs font-semibold text-ink hover:bg-surface"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => removeRegistration(r.id)}
                  className="focus-ring rounded-md p-1.5 text-ink-faint hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Delete registration"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="px-4 py-3">
              <ul className="divide-y divide-black/5">
                {r.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between py-1.5 text-sm"
                  >
                    <span className="text-ink-muted">
                      {it.name}{" "}
                      <span className="text-ink-faint">· {it.code}</span>
                    </span>
                    <span className="text-ink">{formatMoney(it.price)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 space-y-1 border-t border-black/5 pt-3 text-sm">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal ({r.items.length} subjects)</span>
                  <span>{formatMoney(r.subtotal)}</span>
                </div>
                {r.discountPct > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Bulk discount ({r.discountPct}%)</span>
                    <span>−{formatMoney(r.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-black/5 pt-1.5 text-base font-bold text-ink">
                  <span>Total paid</span>
                  <span>{formatMoney(r.total)}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
