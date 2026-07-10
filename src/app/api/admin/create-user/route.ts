import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ROLES = ["student", "instructor", "admin", "parent"] as const;
type RoleValue = (typeof ROLES)[number];

/** The institution's login domain. Addresses are sign-in identities, not (yet)
 *  real mailboxes — see the account-provisioning docs. */
const EMAIL_DOMAIN = "moacademy.com";

interface CreateUserRequest {
  fullName: string;
  role: RoleValue;
  guardianName?: string;
  guardianEmail?: string;
}

/** first.last from a display name, accent- and punctuation-stripped. */
function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/[\s_]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

/** A readable temporary password: two words + digits, easy to relay. */
function tempPassword(): string {
  const words = [
    "Maple", "River", "Solar", "Cedar", "Falcon", "Harbor",
    "Meadow", "Comet", "Orchid", "Summit", "Aspen", "Delta",
  ];
  const w = () => words[Math.floor(Math.random() * words.length)];
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Find the first free name@moacademy.com, appending a number on collision. */
async function uniqueEmail(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  const safeBase = base || "user";
  const { data } = await admin
    .from("profiles")
    .select("email")
    .ilike("email", `${safeBase}%@${EMAIL_DOMAIN}`);
  const taken = new Set(
    (data ?? []).map((r) => String(r.email).toLowerCase()),
  );
  let candidate = `${safeBase}@${EMAIL_DOMAIN}`;
  let n = 1;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${safeBase}${n}@${EMAIL_DOMAIN}`;
  }
  return candidate;
}

/**
 * POST /api/admin/create-user — an admin provisions an account (Brightspace
 * style): the institution issues the identity, not the person. Generates a
 * name@moacademy.com login and a temporary password (returned once to the
 * admin to hand over), sets the role, and flags must_change_password so the
 * user picks their own password on first sign-in. Service-role only; 503 when
 * the key isn't configured.
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

  let body: CreateUserRequest;
  try {
    body = (await req.json()) as CreateUserRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const fullName = (body.fullName ?? "").trim();
  if (!fullName) {
    return NextResponse.json({ error: "A full name is required." }, { status: 400 });
  }
  if (!ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey);
  const email = await uniqueEmail(admin, slugifyName(fullName));
  const password = tempPassword();

  const metadata: Record<string, unknown> = {
    full_name: fullName,
    role: body.role,
    must_change_password: true,
  };
  // A student can be given a guardian at creation; that account is provisioned
  // when the student first signs in (see GuardianProvisioner).
  if (body.role === "student" && body.guardianEmail?.trim()) {
    metadata.guardian_name = (body.guardianName ?? "").trim();
    metadata.guardian_email = body.guardianEmail.trim().toLowerCase();
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (createErr || !created?.user) {
    return NextResponse.json(
      { error: createErr?.message ?? "Couldn't create the account." },
      { status: 500 },
    );
  }

  // The signup trigger writes a profile but coerces the role to 'student';
  // set the requested role and display name authoritatively.
  await admin
    .from("profiles")
    .update({ role: body.role, full_name: fullName })
    .eq("id", created.user.id);

  return NextResponse.json({
    ok: true,
    name: fullName,
    email,
    tempPassword: password,
    role: body.role,
  });
}
