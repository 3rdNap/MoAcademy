import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { isPayFastConfigured, isSandbox } from "@/lib/payments/payfast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/status — a safe, public health/config check. Reports ONLY whether
 * each integration is wired up (booleans), never any key or value. Lets you
 * confirm from a browser that a deployment actually picked up its environment
 * variables — e.g. open /api/status and check `supabase: true` after adding
 * the Supabase keys and redeploying.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    supabase: hasSupabaseEnv(),
    assistant: Boolean(process.env.ANTHROPIC_API_KEY),
    payments: isPayFastConfigured() ? (isSandbox() ? "sandbox" : "live") : "off",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    checkedAt: new Date().toISOString(),
  });
}
