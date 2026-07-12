import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CURRENT_TERM } from "@/lib/billing/registration";
import { subjects } from "@/lib/billing/subjects";

export const runtime = "nodejs";

const ENROL_ROLES = ["student", "instructor"] as const;
type EnrolRole = (typeof ENROL_ROLES)[number];

const VALID_CODES = new Set(subjects.map((s) => s.code));

/** Verify the caller is a signed-in admin; returns the service client or a
 *  NextResponse error to short-circuit. */
async function requireAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return {
      error: NextResponse.json(
        { error: "Enrolment isn't configured — add SUPABASE_SERVICE_ROLE_KEY in Vercel." },
        { status: 503 },
      ),
    };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Not configured." }, { status: 503 }) };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  }
  return { admin: createClient(url, serviceKey) };
}

/** The institution's active term (app_settings, migration 0029), read via the
 *  service-role client this route already holds. Falls back to CURRENT_TERM. */
async function getEnrolTerm(admin: SupabaseClient): Promise<string> {
  try {
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "current_term")
      .maybeSingle();
    return (data as unknown as { value: string } | null)?.value ?? CURRENT_TERM;
  } catch {
    return CURRENT_TERM;
  }
}

/** GET /api/admin/enroll?userId=…&role=student — the user's current subject codes. */
export async function GET(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const role = (searchParams.get("role") ?? "student") as EnrolRole;
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const term = await getEnrolTerm(admin);
  const { data } = await admin
    .from("subject_enrollments")
    .select("subject_code")
    .eq("user_id", userId)
    .eq("role", role)
    .eq("term", term);

  return NextResponse.json({
    subjectCodes: (data ?? []).map((r) => r.subject_code as string),
  });
}

interface EnrollRequest {
  userId: string;
  role?: EnrolRole;
  subjectCodes: string[];
}

/**
 * POST /api/admin/enroll — replace a user's enrolments for the current term.
 * Body: { userId, role, subjectCodes[] }. Admin-only, service-role.
 */
export async function POST(req: Request) {
  const { admin, error } = await requireAdmin();
  if (error) return error;

  let body: EnrollRequest;
  try {
    body = (await req.json()) as EnrollRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const role: EnrolRole = ENROL_ROLES.includes(body.role as EnrolRole)
    ? (body.role as EnrolRole)
    : "student";
  if (!body.userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  const codes = Array.from(
    new Set((body.subjectCodes ?? []).filter((c) => VALID_CODES.has(c))),
  );

  const term = await getEnrolTerm(admin);

  // Replace the set for this (user, role, term): clear then insert.
  const { error: delErr } = await admin
    .from("subject_enrollments")
    .delete()
    .eq("user_id", body.userId)
    .eq("role", role)
    .eq("term", term);
  if (delErr) {
    return NextResponse.json({ error: "Couldn't update enrolments." }, { status: 500 });
  }

  if (codes.length > 0) {
    const rows = codes.map((subject_code) => ({
      user_id: body.userId,
      subject_code,
      role,
      term,
    }));
    const { error: insErr } = await admin.from("subject_enrollments").insert(rows);
    if (insErr) {
      return NextResponse.json({ error: "Couldn't save enrolments." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, subjectCodes: codes });
}
