// PayFast integration core (server-only — imported by API routes, never by
// client components). Configured entirely through environment variables; when
// they're absent every entry point reports "not configured" and the app keeps
// its demo checkout.
//
//   PAYFAST_MERCHANT_ID   from the PayFast dashboard
//   PAYFAST_MERCHANT_KEY  from the PayFast dashboard
//   PAYFAST_PASSPHRASE    the passphrase set in the dashboard (recommended)
//   PAYFAST_SANDBOX       "false" to go live; anything else uses the sandbox
//   NEXT_PUBLIC_SITE_URL  e.g. https://moacademy.vercel.app (for return URLs)

import { createHash } from "crypto";

export function isPayFastConfigured(): boolean {
  return Boolean(
    process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY,
  );
}

export function isSandbox(): boolean {
  return process.env.PAYFAST_SANDBOX !== "false";
}

export function processUrl(): string {
  return isSandbox()
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";
}

export function validateUrl(): string {
  return isSandbox()
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate";
}

/**
 * PayFast's urlencoding for signatures: RFC 3986 with spaces as "+" and
 * uppercase hex escapes.
 */
function pfEncode(value: string): string {
  return encodeURIComponent(value.trim())
    .replace(/%20/g, "+")
    .replace(/'/g, "%27")
    .replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

/**
 * MD5 signature over the fields in their given order (blank values skipped),
 * with the passphrase appended last when set — exactly how PayFast computes
 * it on their side for both the redirect form and ITN callbacks.
 */
export function payfastSignature(
  fields: [string, string][],
  passphrase?: string,
): string {
  const parts = fields
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${pfEncode(v)}`);
  if (passphrase) parts.push(`passphrase=${pfEncode(passphrase)}`);
  return createHash("md5").update(parts.join("&")).digest("hex");
}

export interface PaymentRequest {
  /** Our registration id — comes back on the ITN as m_payment_id. */
  mPaymentId: string;
  /** Rand amount, e.g. 2375 or 2375.5 — formatted to 2dp for PayFast. */
  amount: number;
  itemName: string;
  buyerName: string;
  buyerEmail: string;
  siteUrl: string;
}

/**
 * The ordered form fields (signature included) for a redirect to PayFast's
 * payment page. Field order follows PayFast's attribute documentation order —
 * the order is part of the signature contract.
 */
export function buildPaymentFields(req: PaymentRequest): {
  url: string;
  fields: Record<string, string>;
} {
  const site = req.siteUrl.replace(/\/$/, "");
  const [nameFirst, ...rest] = req.buyerName.trim().split(/\s+/);
  const ordered: [string, string][] = [
    ["merchant_id", process.env.PAYFAST_MERCHANT_ID ?? ""],
    ["merchant_key", process.env.PAYFAST_MERCHANT_KEY ?? ""],
    ["return_url", `${site}/billing/registrations?payment=success`],
    ["cancel_url", `${site}/billing?payment=cancelled`],
    ["notify_url", `${site}/api/payments/notify`],
    ["name_first", nameFirst ?? ""],
    ["name_last", rest.join(" ")],
    ["email_address", req.buyerEmail.trim()],
    ["m_payment_id", req.mPaymentId],
    ["amount", req.amount.toFixed(2)],
    ["item_name", req.itemName.slice(0, 100)],
  ];
  const signature = payfastSignature(ordered, process.env.PAYFAST_PASSPHRASE);
  const fields = Object.fromEntries(ordered.filter(([, v]) => v !== ""));
  fields.signature = signature;
  return { url: processUrl(), fields };
}

/**
 * Verify an ITN (Instant Transaction Notification) payload: recompute the
 * signature over the posted fields in their received order, excluding the
 * signature field itself.
 */
export function verifyItnSignature(
  posted: [string, string][],
  passphrase = process.env.PAYFAST_PASSPHRASE,
): boolean {
  const signature = posted.find(([k]) => k === "signature")?.[1];
  if (!signature) return false;
  const withoutSig = posted.filter(([k]) => k !== "signature");
  return payfastSignature(withoutSig, passphrase) === signature;
}
