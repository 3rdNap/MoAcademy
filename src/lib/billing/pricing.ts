// Subject-based pricing for MoAcademy registration.
//
// Principles (per product requirements):
//  - There is NO free plan. Registering is always paid, minimum one subject.
//  - Price scales with how many subjects you register.
//  - Bulk is cheaper: a volume discount means the total is LESS than the sum of
//    the individual subject prices, so the effective price per subject drops as
//    you add more subjects.

export const CURRENCY = "ZAR";

/** Format an amount as South African Rand, no cents. */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Volume-discount tiers: the more subjects, the bigger the discount. */
export const DISCOUNT_TIERS: { min: number; max: number | null; pct: number }[] =
  [
    { min: 1, max: 1, pct: 0 },
    { min: 2, max: 2, pct: 5 },
    { min: 3, max: 3, pct: 10 },
    { min: 4, max: 4, pct: 15 },
    { min: 5, max: 5, pct: 20 },
    { min: 6, max: 6, pct: 25 },
    { min: 7, max: null, pct: 30 },
  ];

/** Discount percentage for a given number of registered subjects. */
export function discountPctFor(count: number): number {
  if (count <= 1) return 0;
  return Math.min(30, (count - 1) * 5);
}

export interface Quote {
  count: number;
  /** Sum of each subject's individual list price (no discount). */
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  /** What you actually pay. */
  total: number;
  /** total / count — falls as you add subjects. */
  effectivePerSubject: number;
  /** Plain-price average per subject before discount, for comparison. */
  listPerSubject: number;
  /** subtotal − total. */
  savings: number;
}

/** Build a quote from the selected subjects' list prices. */
export function quote(prices: number[]): Quote {
  const count = prices.length;
  const subtotal = prices.reduce((sum, p) => sum + p, 0);
  const discountPct = discountPctFor(count);
  const discountAmount = Math.round((subtotal * discountPct) / 100);
  const total = subtotal - discountAmount;
  return {
    count,
    subtotal,
    discountPct,
    discountAmount,
    total,
    effectivePerSubject: count ? Math.round(total / count) : 0,
    listPerSubject: count ? Math.round(subtotal / count) : 0,
    savings: discountAmount,
  };
}
