"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Landmark, Ticket } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { newId } from "@/lib/local-store";
import { formatMoney, type Quote } from "@/lib/billing/pricing";
import {
  buildRegistration,
  nextInvoiceNo,
  paymentMethodLabel,
  type PaymentMethod,
  type Registration,
  type RegistrationLine,
} from "@/lib/billing/registration";

const methods: { id: PaymentMethod; icon: typeof CreditCard }[] = [
  { id: "card", icon: CreditCard },
  { id: "eft", icon: Landmark },
  { id: "voucher", icon: Ticket },
];

export function CheckoutModal({
  open,
  onClose,
  items,
  quote,
  registrationsCount,
  defaultName,
  defaultEmail,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  items: RegistrationLine[];
  quote: Quote;
  registrationsCount: number;
  defaultName: string;
  defaultEmail: string;
  onPaid: (reg: Registration) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [paid, setPaid] = useState<Registration | null>(null);

  function pay() {
    if (!name.trim() || !email.trim()) return;
    const reg = buildRegistration({
      id: newId(),
      invoiceNo: nextInvoiceNo(registrationsCount),
      payerName: name.trim(),
      payerEmail: email.trim(),
      method,
      items,
      quote,
    });
    onPaid(reg);
    setPaid(reg);
  }

  function close() {
    setPaid(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={paid ? "Payment successful" : "Checkout"}
      description={
        paid
          ? undefined
          : `Registering ${items.length} subject${items.length === 1 ? "" : "s"} for the term.`
      }
      footer={
        paid ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button onClick={pay} disabled={!name.trim() || !email.trim()}>
              <CreditCard className="h-4 w-4" />
              Pay {formatMoney(quote.total)}
            </Button>
          </>
        )
      }
    >
      {paid ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <div>
            <p className="font-semibold text-ink">
              {formatMoney(paid.total)} paid
            </p>
            <p className="text-sm text-ink-muted">
              Invoice {paid.invoiceNo} · {paid.items.length} subjects registered
            </p>
          </div>
          <p className="text-xs text-ink-faint">
            A receipt has been saved to “My Registrations”.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Order summary */}
          <div className="rounded-lg border border-black/5 bg-surface-subtle p-3">
            <ul className="space-y-1 text-sm">
              {items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span className="text-ink-muted">{it.name}</span>
                  <span className="text-ink">{formatMoney(it.price)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 space-y-1 border-t border-black/5 pt-2 text-sm">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span>{formatMoney(quote.subtotal)}</span>
              </div>
              {quote.discountPct > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Bulk discount ({quote.discountPct}%)</span>
                  <span>−{formatMoney(quote.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-black/5 pt-1 font-semibold text-ink">
                <span>Total</span>
                <span>{formatMoney(quote.total)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Payment method
            </p>
            <div className="grid grid-cols-3 gap-2">
              {methods.map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    aria-pressed={active}
                    className={cn(
                      "focus-ring flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-colors",
                      active
                        ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                        : "border-black/10 text-ink-muted hover:bg-surface-subtle",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {paymentMethodLabel[m.id]}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-center text-xs text-ink-faint">
            This is a demo checkout — no real payment is processed.
          </p>
        </div>
      )}
    </Modal>
  );
}
