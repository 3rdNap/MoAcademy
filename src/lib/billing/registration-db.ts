// Supabase-backed registrations. When a student is signed in, paid
// registrations are stored in the registrations/registration_items tables
// (per-student RLS, money in cents) so invoices — and the subjects that gate
// study guides — follow them across devices. Every function degrades to
// null/false so callers can fall back to the browser-local copy.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PaymentMethod, Registration } from "./registration";

interface ItemRow {
  id: string;
  name: string;
  code: string;
  price_cents: number;
}

interface RegRow {
  id: string;
  invoice_no: string;
  term: string;
  subtotal_cents: number;
  discount_pct: number;
  total_cents: number;
  created_at: string;
  payer_name: string;
  payer_email: string;
  method: string;
  registration_items: ItemRow[] | null;
}

const toRands = (cents: number) => Math.round(cents) / 100;
const toCents = (rands: number) => Math.round(rands * 100);

function mapRow(r: RegRow): Registration {
  const subtotal = toRands(r.subtotal_cents);
  const total = toRands(r.total_cents);
  return {
    id: r.id,
    invoiceNo: r.invoice_no,
    createdAt: r.created_at,
    term: r.term,
    payerName: r.payer_name,
    payerEmail: r.payer_email,
    method: (r.method as PaymentMethod) || "card",
    items: (r.registration_items ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code,
      price: toRands(i.price_cents),
    })),
    subtotal,
    discountPct: r.discount_pct,
    discountAmount: Math.round((subtotal - total) * 100) / 100,
    total,
    status: "paid",
  };
}

/** The signed-in student's registrations, newest first — or null. */
export async function fetchRemoteRegistrations(): Promise<
  Registration[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("registrations")
      .select("*, registration_items(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as RegRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Store a paid registration server-side. False when refused/offline. */
export async function addRemoteRegistration(
  reg: Registration,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("registrations").insert({
      id: reg.id,
      user_id: user.id,
      invoice_no: reg.invoiceNo,
      term: reg.term,
      subject_count: reg.items.length,
      subtotal_cents: toCents(reg.subtotal),
      discount_pct: reg.discountPct,
      total_cents: toCents(reg.total),
      status: "paid",
      payer_name: reg.payerName,
      payer_email: reg.payerEmail,
      method: reg.method,
      created_at: reg.createdAt,
    });
    if (error) return false;
    const { error: itemsError } = await supabase
      .from("registration_items")
      .insert(
        reg.items.map((i) => ({
          registration_id: reg.id,
          name: i.name,
          code: i.code,
          price_cents: toCents(i.price),
        })),
      );
    return !itemsError;
  } catch {
    return false;
  }
}

export async function removeRemoteRegistration(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("registrations")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/** Subject names across the signed-in student's registrations, or null. */
export async function fetchRemoteRegisteredSubjects(): Promise<string[] | null> {
  const regs = await fetchRemoteRegistrations();
  if (regs === null) return null;
  return [...new Set(regs.flatMap((r) => r.items.map((i) => i.name)))];
}
