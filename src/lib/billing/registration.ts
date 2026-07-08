import type { Quote } from "./pricing";

export type PaymentMethod = "card" | "eft" | "voucher";

export interface RegistrationLine {
  id: string;
  name: string;
  code: string;
  price: number;
}

/** A completed, paid registration — i.e. an invoice. */
export interface Registration {
  id: string;
  invoiceNo: string;
  createdAt: string;
  term: string;
  payerName: string;
  payerEmail: string;
  method: PaymentMethod;
  items: RegistrationLine[];
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
  /** "pending" = online payment started, awaiting PayFast confirmation. */
  status: "paid" | "pending";
}

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  card: "Card",
  eft: "Instant EFT",
  voucher: "Voucher",
};

/** The term a new registration is created against. */
export const CURRENT_TERM = "Fall 2026";

/** Sequential, human-readable invoice number, e.g. INV-2026-0007. */
export function nextInvoiceNo(existingCount: number, now = new Date()): string {
  const seq = String(existingCount + 1).padStart(4, "0");
  return `INV-${now.getFullYear()}-${seq}`;
}

/** Assemble a Registration record from a checkout. */
export function buildRegistration(args: {
  id: string;
  invoiceNo: string;
  payerName: string;
  payerEmail: string;
  method: PaymentMethod;
  items: RegistrationLine[];
  quote: Quote;
  now?: Date;
}): Registration {
  const { quote } = args;
  return {
    id: args.id,
    invoiceNo: args.invoiceNo,
    createdAt: (args.now ?? new Date()).toISOString(),
    term: CURRENT_TERM,
    payerName: args.payerName,
    payerEmail: args.payerEmail,
    method: args.method,
    items: args.items,
    subtotal: quote.subtotal,
    discountPct: quote.discountPct,
    discountAmount: quote.discountAmount,
    total: quote.total,
    status: "paid",
  };
}
