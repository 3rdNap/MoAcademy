import type { SupabaseClient } from "@supabase/supabase-js";

// Server-only account-provisioning helpers shared by the admin create-user and
// bulk-import routes so the login-derivation and password logic can't drift.
// Keep this free of "use client" and Next-specific imports.

/** The institution's login domain. Addresses are sign-in identities, not (yet)
 *  real mailboxes — see the account-provisioning docs. */
export const EMAIL_DOMAIN = "moacademy.com";

/** first.last from a display name, accent- and punctuation-stripped. */
export function slugifyName(name: string): string {
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
export function tempPassword(): string {
  const words = [
    "Maple", "River", "Solar", "Cedar", "Falcon", "Harbor",
    "Meadow", "Comet", "Orchid", "Summit", "Aspen", "Delta",
  ];
  const w = () => words[Math.floor(Math.random() * words.length)];
  return `${w()}-${w()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Find the first free name@moacademy.com, appending a number on collision.
 * `reserved` holds addresses already claimed earlier in the same batch (they
 * aren't in the profiles table yet), so bulk imports don't hand two people the
 * same login. Addresses added to a fresh account should be recorded in
 * `reserved` by the caller afterwards.
 */
export async function uniqueEmail(
  admin: SupabaseClient,
  base: string,
  reserved?: Set<string>,
): Promise<string> {
  const safeBase = base || "user";
  const { data } = await admin
    .from("profiles")
    .select("email")
    .ilike("email", `${safeBase}%@${EMAIL_DOMAIN}`);
  const taken = new Set(
    (data ?? []).map((r) => String(r.email).toLowerCase()),
  );
  if (reserved) for (const e of reserved) taken.add(e.toLowerCase());
  let candidate = `${safeBase}@${EMAIL_DOMAIN}`;
  let n = 1;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${safeBase}${n}@${EMAIL_DOMAIN}`;
  }
  return candidate;
}
