import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ROLES = ["student", "instructor", "admin"] as const;
type RoleValue = (typeof ROLES)[number];

interface SetRoleRequest {
  userId: string;
  role: RoleValue;
}

/**
 * POST /api/admin/set-role — change another user's role. Privileged, so it's
 * done entirely server-side: the caller's session is verified as an admin,
 * then the write uses the service-role key. Guards prevent self-lockout and
 * removing the last admin. Without the service key it returns 503 (the UI then
 * shows read-only role badges).
 */
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      {
        error:
          "Role management isn't configured — add SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      },
      { status: 503 },
    );
  }

  // Verify the caller is a signed-in admin.
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

  let body: SetRoleRequest;
  try {
    body = (await req.json()) as SetRoleRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body.userId || !ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (body.userId === user.id) {
    return NextResponse.json(
      { error: "You can't change your own role." },
      { status: 400 },
    );
  }

  const admin = createClient(url, serviceKey);

  // Don't allow removing the last remaining admin.
  if (body.role !== "admin") {
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", body.userId)
      .maybeSingle();
    if (target?.role === "admin") {
      const { count } = await admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Can't remove the last admin." },
          { status: 400 },
        );
      }
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't update the role." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, role: body.role });
}
