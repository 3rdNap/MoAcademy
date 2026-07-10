import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** A readable temporary password: two short words + digits, easy to relay. */
function tempPassword(): string {
  const words = [
    "Maple",
    "River",
    "Solar",
    "Cedar",
    "Falcon",
    "Harbor",
    "Meadow",
    "Comet",
    "Orchid",
    "Summit",
  ];
  const w = () => words[Math.floor(Math.random() * words.length)];
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `${w()}-${w()}-${digits}`;
}

/**
 * POST /api/guardians/provision — create (or link) a parent/guardian account
 * for the signed-in student. Student-driven: the student entered their
 * guardian's name + email at signup (stored in their own auth metadata), and
 * this route reads *that* metadata — it never trusts a caller-supplied target
 * student, so a student can only add a guardian to themselves.
 *
 * The parent account is created with a temporary password returned once to the
 * student to relay; the parent changes it after signing in. Privileged, so it
 * runs entirely server-side with the service-role key. Returns 503 (no-op)
 * when the service key isn't configured.
 */
export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "Guardian accounts aren't configured on this deployment." },
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

  // Only students get a guardian, and only for themselves.
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role && me.role !== "student") {
    return NextResponse.json({ ok: true, skipped: "not-a-student" });
  }

  const guardianName =
    (user.user_metadata?.guardian_name as string | undefined)?.trim() ?? "";
  const guardianEmail =
    (user.user_metadata?.guardian_email as string | undefined)
      ?.trim()
      .toLowerCase() ?? "";
  if (!guardianEmail || !guardianEmail.includes("@")) {
    return NextResponse.json({ ok: true, skipped: "no-guardian" });
  }
  if (guardianEmail === (user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "A guardian must use a different email from the student." },
      { status: 400 },
    );
  }

  const admin = createClient(url, serviceKey);

  // Already linked? Idempotent — don't create a second account or leak a new
  // password (the first one was shown once at creation).
  const { data: existingLinks } = await admin
    .from("guardian_links")
    .select("id")
    .eq("student_id", user.id)
    .limit(1);
  if (existingLinks && existingLinks.length > 0) {
    return NextResponse.json({ ok: true, alreadyProvisioned: true });
  }

  // Reuse an existing account with that email (e.g. a parent of two children)
  // instead of trying to recreate it.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("email", guardianEmail)
    .maybeSingle();

  let guardianId: string;
  let createdPassword: string | null = null;

  if (existingProfile) {
    guardianId = existingProfile.id as string;
    // Promote a brand-new account to parent; never demote a real student/staff
    // account that happens to share the email.
    if (existingProfile.role !== "parent") {
      if (existingProfile.role === "student") {
        await admin
          .from("profiles")
          .update({ role: "parent" })
          .eq("id", guardianId);
      }
    }
  } else {
    const password = tempPassword();
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: guardianEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: guardianName || guardianEmail, role: "parent" },
      });
    if (createErr || !created?.user) {
      return NextResponse.json(
        { error: "Couldn't create the guardian account." },
        { status: 500 },
      );
    }
    guardianId = created.user.id;
    createdPassword = password;
    // The signup trigger writes a profile but coerces role to 'student'; set it
    // to 'parent' now, and make sure the display name is right.
    await admin
      .from("profiles")
      .update({ role: "parent", full_name: guardianName || guardianEmail })
      .eq("id", guardianId);
  }

  const { error: linkErr } = await admin
    .from("guardian_links")
    .upsert(
      { guardian_id: guardianId, student_id: user.id },
      { onConflict: "guardian_id,student_id" },
    );
  if (linkErr) {
    return NextResponse.json(
      { error: "Couldn't link the guardian to your account." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    guardianEmail,
    guardianName: guardianName || null,
    // Present only when we just created the account.
    tempPassword: createdPassword,
    existingAccount: !createdPassword,
  });
}
