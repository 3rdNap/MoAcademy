"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Check,
  CreditCard,
  Info,
  Receipt,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useLocalCollection } from "@/lib/local-store";
import { CheckoutModal } from "@/components/billing/CheckoutModal";
import { subjects, type Subject } from "@/lib/billing/subjects";
import {
  DISCOUNT_TIERS,
  discountPctFor,
  formatMoney,
  quote,
} from "@/lib/billing/pricing";
import type {
  Registration,
  RegistrationLine,
} from "@/lib/billing/registration";

const STORAGE_KEY = "moacademy.billing.selected";

export function BillingDashboard({
  defaultName = "",
  defaultEmail = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const registrations = useLocalCollection<Registration>(
    "moacademy.billing.registrations",
    [],
  );
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Persist the student's selection in the browser.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSelected(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
    } catch {
      /* ignore */
    }
  }, [selected, hydrated]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  const selectedSubjects = useMemo(
    () => subjects.filter((s) => selected.includes(s.id)),
    [selected],
  );
  const q = useMemo(
    () => quote(selectedSubjects.map((s) => s.price)),
    [selectedSubjects],
  );

  const lines: RegistrationLine[] = selectedSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    price: s.price,
  }));

  function handlePaid(reg: Registration) {
    registrations.add(reg);
    setSelected([]);
  }

  // Group catalog by category for display.
  const byCategory = useMemo(() => {
    return subjects.reduce<Record<string, Subject[]>>((acc, s) => {
      (acc[s.category] ??= []).push(s);
      return acc;
    }, {});
  }, []);

  // What the next subject would unlock, to nudge bulk registration.
  const nextTierPct = discountPctFor(q.count + 1);
  const nextUnlocks = nextTierPct > q.discountPct;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Catalog */}
      <div>
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Registration is <span className="font-semibold">per subject</span> —
            there is no free plan. The more subjects you register, the{" "}
            <span className="font-semibold">lower the price per subject</span>,
            so your total is always less than the subjects added up separately.
          </p>
        </div>

        {Object.entries(byCategory).map(([category, list]) => (
          <section key={category} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {category}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {list.map((s) => {
                const isOn = selected.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    aria-pressed={isOn}
                    className={cn(
                      "focus-ring flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      isOn
                        ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-200"
                        : "border-black/10 bg-surface hover:bg-surface-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                        isOn
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-black/20 bg-surface",
                      )}
                    >
                      {isOn && <Check className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {s.name}
                      </span>
                      <span className="block text-xs text-ink-faint">
                        {s.code} · per term
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {formatMoney(s.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Tier explainer */}
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
            <BadgePercent className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">
              How bulk pricing works
            </h2>
          </header>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2 font-semibold">Subjects registered</th>
                <th className="px-4 py-2 font-semibold">Discount</th>
                <th className="px-4 py-2 text-right font-semibold">
                  You pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {DISCOUNT_TIERS.map((t) => {
                const active =
                  q.count >= t.min && (t.max === null || q.count <= t.max);
                return (
                  <tr
                    key={t.min}
                    className={active ? "bg-brand-50/60" : undefined}
                  >
                    <td className="px-4 py-2 text-ink">
                      {t.max === null ? `${t.min}+ subjects` : t.max === 1 ? "1 subject" : `${t.min} subjects`}
                      {active && (
                        <Badge tone="brand" className="ml-2">
                          You&apos;re here
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {t.pct === 0 ? (
                        <span className="text-ink-faint">Full price</span>
                      ) : (
                        <span className="font-medium text-emerald-600">
                          {t.pct}% off
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-ink-muted">
                      {100 - t.pct}% of list
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {/* Summary / checkout */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-black/5 px-4 py-3">
            <CreditCard className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-ink">
              Registration summary
            </h2>
          </header>

          <div className="px-4 py-4">
            {q.count === 0 ? (
              <p className="py-6 text-center text-sm text-ink-faint">
                Select at least one subject to register. There is no free plan —
                pick the subjects you want and your price appears here.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {selectedSubjects.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-ink-muted">{s.name}</span>
                      <span className="text-ink">{formatMoney(s.price)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-1.5 border-t border-black/5 pt-3 text-sm">
                  <Row label={`Subtotal (${q.count} subjects)`}>
                    {formatMoney(q.subtotal)}
                  </Row>
                  {q.discountPct > 0 && (
                    <Row
                      label={
                        <span className="flex items-center gap-1 text-emerald-600">
                          <Tag className="h-3.5 w-3.5" />
                          Bulk discount ({q.discountPct}%)
                        </span>
                      }
                    >
                      <span className="text-emerald-600">
                        −{formatMoney(q.discountAmount)}
                      </span>
                    </Row>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-black/5 pt-3">
                  <span className="text-sm font-medium text-ink">
                    Total per term
                  </span>
                  <span className="text-2xl font-bold text-ink">
                    {formatMoney(q.total)}
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <p className="font-semibold">
                    {formatMoney(q.effectivePerSubject)} per subject
                  </p>
                  {q.savings > 0 ? (
                    <p className="text-xs">
                      That&apos;s {formatMoney(q.listPerSubject)} list — you save{" "}
                      {formatMoney(q.savings)} in total.
                    </p>
                  ) : (
                    <p className="text-xs">
                      Add another subject to unlock a discount.
                    </p>
                  )}
                </div>

                {nextUnlocks && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-brand-700">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Add one more subject to reach {nextTierPct}% off.
                  </p>
                )}

                <Button
                  className="mt-4 w-full"
                  onClick={() => setCheckoutOpen(true)}
                >
                  <CreditCard className="h-4 w-4" />
                  Pay {formatMoney(q.total)}
                </Button>
                <p className="mt-2 text-center text-xs text-ink-faint">
                  Billed per term · cancel before the term starts
                </p>
              </>
            )}
          </div>
        </div>

        {registrations.items.length > 0 && (
          <Link
            href="/billing/registrations"
            className="focus-ring mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-black/10 bg-surface px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-subtle"
          >
            <Receipt className="h-4 w-4" />
            My registrations ({registrations.items.length})
          </Link>
        )}
      </aside>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={lines}
        quote={q}
        registrationsCount={registrations.items.length}
        defaultName={defaultName}
        defaultEmail={defaultEmail}
        onPaid={handlePaid}
      />
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
