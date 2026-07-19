import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CURRENT_TERM } from "@/lib/billing/registration";
import { subjects } from "@/lib/billing/subjects";
import { slugifyName, tempPassword, uniqueEmail } from "@/lib/admin/provision";

export const runtime = "nodejs";

const IMPORT_ROLES = ["student", "instructor", "parent"] as const;
type ImportRole = (typeof IMPORT_ROLES)[number];

/** Roles whose enrolment rows are meaningful (parents aren't enrolled). */
const ENROL_ROLES = new Set(["student", "instructor"]);

const VALID_CODES = new Set(subjects.map((s) => s.code));

/** Cohorts are onboarded in one operation; cap the batch so a single request
 *  can't spawn thousands of accounts. */
const MAX_ROWS = 100;

interface ImportRow {
  name: string;
  role: ImportRole;
  subjects: string[];
}

interface RowResult {
  name: string;
  email?: string;
  password?: string;
  role: string;
  subjects: string[];
  ok: boolean;
  error?: string;
}

/** The institution's active term (app_settings, migration 0029). Falls back to
 *  CURRENT_TERM — read the same way as enroll/route.ts. */
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

/**
 * POST /api/admin/bulk-import — provision a whole cohort in one operation.
 * Body: { rows: { name, role, subjects[] }[] } (subjects = catalogue CODES).
 * Each row is processed sequentially: validate, derive a unique login, create
 * the auth user with a temporary password + must_change_password, mirror the
 * profile row, then write current-term enrolments. A row failure never aborts
 * the batch — every row's outcome (with credentials for successes) is returned.
 * Same guards as create-user; service-role only, 503 when unconfigured.
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

  let body: { rows?: ImportRow[] };
  try {
    body = (await req.json()) as { rows?: ImportRow[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const rows = Array.isArray(body.rows) ? body.rows : null;
  if (!rows) {
    return NextResponse.json({ error: "A rows array is required." }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows — import at most ${MAX_ROWS} at a time.` },
      { status: 413 },
    );
  }

  const admin = createClient(url, serviceKey);
  const term = await getEnrolTerm(admin);
  // Logins claimed earlier in this batch aren't in profiles yet; track them so
  // two same-named people in the same upload don't collide.
  const reserved = new Set<string>();
  const results: RowResult[] = [];

  for (const raw of rows) {
    const name = (raw?.name ?? "").trim();
    const role = raw?.role;
    const codes = Array.from(
      new Set((Array.isArray(raw?.subjects) ? raw.subjects : []).map((c) => String(c).trim().toUpperCase()).filter(Boolean)),
    );

    if (!name) {
      results.push({ name: "", role: String(role ?? ""), subjects: codes, ok: false, error: "A name is required." });
      continue;
    }
    if (!IMPORT_ROLES.includes(role)) {
      results.push({ name, role: String(role ?? ""), subjects: codes, ok: false, error: "Unknown role." });
      continue;
    }
    const badCodes = codes.filter((c) => !VALID_CODES.has(c));
    if (badCodes.length > 0) {
      results.push({ name, role, subjects: codes, ok: false, error: `Unknown subject code(s): ${badCodes.join(", ")}` });
      continue;
    }
    // Parents aren't enrolled in subjects.
    const enrolCodes = ENROL_ROLES.has(role) ? codes : [];

    try {
      const email = await uniqueEmail(admin, slugifyName(name), reserved);
      const password = tempPassword();

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role, must_change_password: true },
      });
      if (createErr || !created?.user) {
        results.push({ name, role, subjects: codes, ok: false, error: createErr?.message ?? "Couldn't create the account." });
        continue;
      }
      reserved.add(email);

      // The signup trigger writes a profile but coerces the role to 'student';
      // set the requested role and display name authoritatively.
      await admin
        .from("profiles")
        .update({ role, full_name: name })
        .eq("id", created.user.id);

      if (enrolCodes.length > 0) {
        const enrolRows = enrolCodes.map((subject_code) => ({
          user_id: created.user.id,
          subject_code,
          role,
          term,
        }));
        const { error: enrolErr } = await admin
          .from("subject_enrollments")
          .insert(enrolRows);
        if (enrolErr) {
          // Account exists; report the partial failure rather than hiding it.
          results.push({ name, email, password, role, subjects: enrolCodes, ok: false, error: "Account created, but enrolment failed." });
          continue;
        }
      }

      results.push({ name, email, password, role, subjects: enrolCodes, ok: true });
    } catch {
      results.push({ name, role, subjects: codes, ok: false, error: "Couldn't create the account." });
    }
  }

  return NextResponse.json({ ok: true, results });
}
