import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApplicationEntry, ApplicationStatus } from "@/lib/roadmap/types";

// Server-backed University Roadmap applications.
//
// The roadmap started life in localStorage, which made it invisible to anyone
// but the student on that one browser — including their guardian, who most
// wants to know whether the applications are actually in. These helpers move
// the applications to the table 0002 defined, with 0021 adding the guardian
// read path. Every call returns null when Supabase isn't configured, nobody is
// signed in, or the migration hasn't been applied, which is the boards' signal
// to stay on their local copy.

interface ApplicationRow {
  id: string;
  institution: string;
  program: string | null;
  opens_at: string | null;
  closes_at: string | null;
  apply_url: string | null;
  prospectus_url: string | null;
  status: ApplicationStatus;
  notes: string | null;
}

const mapRow = (r: ApplicationRow): ApplicationEntry => ({
  id: r.id,
  institution: r.institution,
  program: r.program ?? undefined,
  opensAt: r.opens_at ?? undefined,
  closesAt: r.closes_at ?? undefined,
  applyUrl: r.apply_url ?? undefined,
  prospectusUrl: r.prospectus_url ?? undefined,
  status: r.status ?? "not_started",
  notes: r.notes ?? undefined,
});

const toRow = (e: ApplicationEntry) => ({
  institution: e.institution,
  program: e.program ?? null,
  opens_at: e.opensAt || null,
  closes_at: e.closesAt || null,
  apply_url: e.applyUrl ?? null,
  prospectus_url: e.prospectusUrl ?? null,
  status: e.status,
  notes: e.notes ?? null,
});

const SELECT =
  "id, institution, program, opens_at, closes_at, apply_url, prospectus_url, status, notes";

/** The signed-in student's applications, soonest deadline first. */
export async function fetchMyApplications(): Promise<ApplicationEntry[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_applications")
      .select(SELECT)
      .eq("user_id", user.id)
      .order("closes_at", { nullsFirst: false });
    if (error || !data) return null;
    return (data as unknown as ApplicationRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Save a new application; null when it couldn't be stored server-side. */
export async function addMyApplication(
  entry: ApplicationEntry,
): Promise<ApplicationEntry | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_applications")
      .insert({ user_id: user.id, ...toRow(entry) })
      .select(SELECT)
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as ApplicationRow);
  } catch {
    return null;
  }
}

/** Update one of the student's own applications. */
export async function updateMyApplication(
  entry: ApplicationEntry,
): Promise<ApplicationEntry | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("roadmap_applications")
      .update(toRow(entry))
      .eq("id", entry.id)
      .select(SELECT)
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as ApplicationRow);
  } catch {
    return null;
  }
}

/** Withdraw an application. False when it couldn't be removed server-side. */
export async function removeMyApplication(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("roadmap_applications")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
