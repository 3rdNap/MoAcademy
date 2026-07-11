import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface ResetPasswordRequest {
  userId: string;
}

/** A readable temporary password: two words + digits, easy to relay. Mirrors
 *  create-user's generator so resets look the same as fresh accounts. */
function tempPassword(): string {
  const words = [
    "Maple", "River", "Solar", "Cedar", "Falcon", "Harbor",
    "Meadow", "Comet", "Orchid", "Summit", "Aspen", "Delta",
  ];
  const w = () => words[Math.floor(Math.random() * words.length)];
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * POST /api/admin/reset-password — an admin resets a forgotten login.
 * Addresses are institution-issued sign-in identities, not real mailboxes
 * (see create-user), so there's no email-reset flow; the admin generates a
 * fresh temporary password and hands it over directly, same as at creation.
 * Preserves existing user_metadata and re-flags must_change_password so the
 * person picks their own password on next sign-in. Service-role only; 503
 * when the key isn't configured.
 */
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "Account provisioning isn't configured — add SUPABASE_SERVICE_ROLE_KEY in Vercel." },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  let body: ResetPasswordRequest;
  try {
    body = (await req.json()) as ResetPasswordRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const userId = (body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "A user id is required." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey);

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !existing?.user) {
    return NextResponse.json(
      { error: getErr?.message ?? "Couldn't find that account." },
      { status: 404 },
    );
  }

  const password = tempPassword();
  const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(
    userId,
    {
      password,
      user_metadata: {
        ...existing.user.user_metadata,
        must_change_password: true,
      },
    },
  );
  if (updateErr || !updated?.user) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Couldn't reset the password." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, password });
}
