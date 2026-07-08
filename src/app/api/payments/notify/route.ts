import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isPayFastConfigured,
  validateUrl,
  verifyItnSignature,
} from "@/lib/payments/payfast";

export const runtime = "nodejs";

/**
 * PayFast ITN (Instant Transaction Notification) webhook — the ONLY place a
 * registration is marked paid for real money. Four independent checks before
 * any write, per PayFast's integration guidance:
 *
 *   1. the payload signature verifies against our passphrase,
 *   2. the merchant id matches ours,
 *   3. PayFast's validate endpoint confirms the payload came from them,
 *   4. the amount PayFast collected matches the pending registration's total.
 *
 * Always answers 200 so PayFast doesn't hammer retries; failures are logged
 * and simply leave the registration pending for manual review.
 */
export async function POST(req: Request) {
  if (!isPayFastConfigured()) return new NextResponse(null, { status: 200 });

  const raw = await req.text();
  // Preserve received order — it's part of the signature contract.
  const posted: [string, string][] = raw
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      const k = decodeURIComponent(pair.slice(0, i));
      const v = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, "%20"));
      return [k, v] as [string, string];
    });
  const field = (k: string) => posted.find(([key]) => key === k)?.[1] ?? "";

  const ok = (reason: string, extra?: unknown) => {
    if (reason !== "done") console.error("payfast itn rejected:", reason, extra ?? "");
    return new NextResponse(null, { status: 200 });
  };

  if (!verifyItnSignature(posted)) return ok("bad signature");
  if (field("merchant_id") !== process.env.PAYFAST_MERCHANT_ID) {
    return ok("merchant mismatch");
  }
  if (field("payment_status") !== "COMPLETE") {
    return ok("status " + field("payment_status"));
  }

  // Server-to-server confirmation with PayFast that this payload is theirs.
  try {
    const res = await fetch(validateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: raw,
    });
    const text = (await res.text()).trim();
    if (!text.startsWith("VALID")) return ok("postback " + text.slice(0, 20));
  } catch (err) {
    return ok("postback unreachable", err);
  }

  // Marking paid crosses user boundaries, so it needs the service role.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return ok("service key missing");
  const admin = createClient(url, serviceKey);

  const regId = field("m_payment_id");
  const { data: reg } = await admin
    .from("registrations")
    .select("id,total_cents,status")
    .eq("id", regId)
    .maybeSingle();
  if (!reg) return ok("unknown registration " + regId);
  if (reg.status === "paid") return ok("done"); // idempotent replay

  const paidCents = Math.round(parseFloat(field("amount_gross")) * 100);
  if (paidCents !== reg.total_cents) {
    return ok(`amount mismatch: got ${paidCents}, expected ${reg.total_cents}`);
  }

  await admin.from("registrations").update({ status: "paid" }).eq("id", regId);
  return ok("done");
}
