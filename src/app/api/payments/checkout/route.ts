import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { subjects } from "@/lib/billing/subjects";
import { quote } from "@/lib/billing/pricing";
import {
  buildPaymentFields,
  isPayFastConfigured,
  isSandbox,
} from "@/lib/payments/payfast";

export const runtime = "nodejs";

/** GET — lets the checkout UI know whether online payment is available. */
export async function GET() {
  return NextResponse.json({
    enabled: isPayFastConfigured(),
    sandbox: isSandbox(),
  });
}

interface CheckoutRequest {
  subjectIds: string[];
  payer: { name: string; email: string };
}

/**
 * POST — start a real payment. Recomputes the price server-side from the
 * subject catalog (client totals are never trusted), records a PENDING
 * registration for the signed-in student, and returns the signed PayFast
 * form fields for the browser to submit. The ITN webhook flips the
 * registration to paid once PayFast confirms the money.
 */
export async function POST(req: Request) {
  if (!isPayFastConfigured()) {
    return NextResponse.json(
      { error: "Online payment isn't configured yet." },
      { status: 503 },
    );
  }

  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const chosen = subjects.filter((s) => body.subjectIds?.includes(s.id));
  if (chosen.length === 0) {
    return NextResponse.json({ error: "No subjects selected." }, { status: 400 });
  }
  const name = body.payer?.name?.trim();
  const email = body.payer?.email?.trim();
  if (!name || !email) {
    return NextResponse.json(
      { error: "Payer name and email are required." },
      { status: 400 },
    );
  }

  // Authoritative price, computed from the catalog on the server.
  const q = quote(chosen.map((s) => s.price));

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Accounts aren't configured on this deployment." },
      { status: 503 },
    );
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to pay online — or use the demo checkout." },
      { status: 401 },
    );
  }

  // Record the pending registration (RLS: the student inserts their own row).
  const { count } = await supabase
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  const invoiceNo = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: reg, error: regError } = await supabase
    .from("registrations")
    .insert({
      user_id: user.id,
      invoice_no: invoiceNo,
      term: "Fall 2026",
      subject_count: chosen.length,
      subtotal_cents: Math.round(q.subtotal * 100),
      discount_pct: q.discountPct,
      total_cents: Math.round(q.total * 100),
      status: "pending",
      payer_name: name,
      payer_email: email,
      method: "card",
    })
    .select()
    .single();
  if (regError || !reg) {
    return NextResponse.json(
      { error: "Couldn't start the payment — please try again." },
      { status: 500 },
    );
  }
  await supabase.from("registration_items").insert(
    chosen.map((s) => ({
      registration_id: reg.id as string,
      name: s.name,
      code: s.code,
      price_cents: Math.round(s.price * 100),
    })),
  );

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const { url, fields } = buildPaymentFields({
    mPaymentId: reg.id as string,
    amount: q.total,
    itemName: `MoAcademy registration ${invoiceNo} (${chosen.length} subject${chosen.length === 1 ? "" : "s"})`,
    buyerName: name,
    buyerEmail: email,
    siteUrl,
  });

  return NextResponse.json({ url, fields, sandbox: isSandbox() });
}
