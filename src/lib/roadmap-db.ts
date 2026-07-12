// Supabase-backed sync for the University Roadmap (targets + nested
// requirements, applications, scholarships — see supabase/migrations/0002 and
// 0025). Every row is strictly user-owned (own-rows RLS). Requirements live in
// a child table but nest inside TargetInstitution in the app, so target
// writes replace-all their requirement rows (small N). Every function returns
// null/false on any error or when signed out/unconfigured, so callers fall
// back to the browser-local roadmap store.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ApplicationEntry,
  ApplicationStatus,
  Priority,
  RequirementItem,
  Scholarship,
  TargetInstitution,
} from "@/lib/roadmap/types";

// ----- Targets + requirements ---------------------------------------------

interface RequirementRow {
  id: string;
  target_id: string;
  label: string;
  minimum: string | null;
  recommended: string | null;
  met: boolean;
  position: number;
}

interface TargetRow {
  id: string;
  institution: string;
  program: string;
  location: string | null;
  priority: Priority;
  min_aps: number | null;
  target_aps: number | null;
  current_aps: number | null;
  notes: string | null;
  roadmap_requirements?: RequirementRow[];
}

function mapRequirement(r: RequirementRow): RequirementItem {
  return {
    id: r.id,
    label: r.label,
    minimum: r.minimum ?? undefined,
    recommended: r.recommended ?? undefined,
    met: r.met,
  };
}

function mapTarget(r: TargetRow): TargetInstitution {
  const reqs = [...(r.roadmap_requirements ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  return {
    id: r.id,
    institution: r.institution,
    program: r.program,
    location: r.location ?? undefined,
    priority: r.priority,
    minAps: r.min_aps ?? undefined,
    targetAps: r.target_aps ?? undefined,
    currentAps: r.current_aps ?? undefined,
    notes: r.notes ?? undefined,
    requirements: reqs.map(mapRequirement),
  };
}

function targetToRow(t: Omit<TargetInstitution, "id">) {
  return {
    institution: t.institution,
    program: t.program ?? "",
    location: t.location ?? null,
    priority: t.priority,
    min_aps: t.minAps ?? null,
    target_aps: t.targetAps ?? null,
    current_aps: t.currentAps ?? null,
    notes: t.notes ?? null,
  };
}

function requirementRows(targetId: string, reqs: RequirementItem[]) {
  return reqs.map((r, i) => ({
    target_id: targetId,
    label: r.label,
    minimum: r.minimum ?? null,
    recommended: r.recommended ?? null,
    met: r.met,
    position: i,
  }));
}

export async function fetchRemoteTargets(): Promise<
  TargetInstitution[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_targets")
      .select("*, roadmap_requirements(*)")
      .order("created_at");
    if (error || !data) return null;
    return (data as unknown as TargetRow[]).map(mapTarget);
  } catch {
    return null;
  }
}

export async function addRemoteTarget(
  input: Omit<TargetInstitution, "id">,
): Promise<TargetInstitution | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_targets")
      .insert({ ...targetToRow(input), user_id: user.id })
      .select()
      .single();
    if (error || !data) return null;
    const target = data as unknown as TargetRow;
    let requirements: RequirementRow[] = [];
    if (input.requirements.length > 0) {
      const { data: reqData, error: reqErr } = await supabase
        .from("roadmap_requirements")
        .insert(requirementRows(target.id, input.requirements))
        .select();
      if (reqErr) return null;
      requirements = (reqData as unknown as RequirementRow[]) ?? [];
    }
    return mapTarget({ ...target, roadmap_requirements: requirements });
  } catch {
    return null;
  }
}

export async function updateRemoteTarget(
  id: string,
  input: Omit<TargetInstitution, "id">,
): Promise<TargetInstitution | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_targets")
      .update(targetToRow(input))
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return null;
    const target = data as unknown as TargetRow;
    // Replace-all requirements (small N): delete then re-insert with positions.
    const { error: delErr } = await supabase
      .from("roadmap_requirements")
      .delete()
      .eq("target_id", id);
    if (delErr) return null;
    let requirements: RequirementRow[] = [];
    if (input.requirements.length > 0) {
      const { data: reqData, error: reqErr } = await supabase
        .from("roadmap_requirements")
        .insert(requirementRows(id, input.requirements))
        .select();
      if (reqErr) return null;
      requirements = (reqData as unknown as RequirementRow[]) ?? [];
    }
    return mapTarget({ ...target, roadmap_requirements: requirements });
  } catch {
    return null;
  }
}

export async function removeRemoteTarget(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    // roadmap_requirements cascade on target delete.
    const { error } = await supabase
      .from("roadmap_targets")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

// ----- Applications --------------------------------------------------------

interface ApplicationRow {
  id: string;
  institution: string;
  program: string | null;
  opens_at: string | null;
  closes_at: string | null;
  apply_url: string | null;
  prospectus_url: string | null;
  prospectus_file_name: string | null;
  prospectus_data: string | null;
  status: ApplicationStatus;
  notes: string | null;
}

function mapApplication(r: ApplicationRow): ApplicationEntry {
  return {
    id: r.id,
    institution: r.institution,
    program: r.program ?? undefined,
    opensAt: r.opens_at ?? undefined,
    closesAt: r.closes_at ?? undefined,
    applyUrl: r.apply_url ?? undefined,
    prospectusUrl: r.prospectus_url ?? undefined,
    prospectusFileName: r.prospectus_file_name ?? undefined,
    prospectusData: r.prospectus_data ?? undefined,
    status: r.status,
    notes: r.notes ?? undefined,
  };
}

function applicationToRow(a: Omit<ApplicationEntry, "id">) {
  return {
    institution: a.institution,
    program: a.program ?? null,
    opens_at: a.opensAt ?? null,
    closes_at: a.closesAt ?? null,
    apply_url: a.applyUrl ?? null,
    prospectus_url: a.prospectusUrl ?? null,
    prospectus_file_name: a.prospectusFileName ?? null,
    prospectus_data: a.prospectusData ?? null,
    status: a.status,
    notes: a.notes ?? null,
  };
}

export async function fetchRemoteApplications(): Promise<
  ApplicationEntry[] | null
> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_applications")
      .select("*")
      .order("created_at");
    if (error || !data) return null;
    return (data as unknown as ApplicationRow[]).map(mapApplication);
  } catch {
    return null;
  }
}

export async function addRemoteApplication(
  input: Omit<ApplicationEntry, "id">,
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
      .insert({ ...applicationToRow(input), user_id: user.id })
      .select()
      .single();
    if (error || !data) return null;
    return mapApplication(data as unknown as ApplicationRow);
  } catch {
    return null;
  }
}

export async function updateRemoteApplication(
  id: string,
  input: Omit<ApplicationEntry, "id">,
): Promise<ApplicationEntry | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("roadmap_applications")
      .update(applicationToRow(input))
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return null;
    return mapApplication(data as unknown as ApplicationRow);
  } catch {
    return null;
  }
}

export async function removeRemoteApplication(id: string): Promise<boolean> {
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

// ----- Scholarships --------------------------------------------------------

interface ScholarshipRow {
  id: string;
  name: string;
  provider: string;
  coverage: string | null;
  closes_at: string | null;
  url: string | null;
  requirements: string[];
  notes: string | null;
}

function mapScholarship(r: ScholarshipRow): Scholarship {
  return {
    id: r.id,
    name: r.name,
    provider: r.provider,
    coverage: r.coverage ?? undefined,
    closesAt: r.closes_at ?? undefined,
    url: r.url ?? undefined,
    requirements: r.requirements ?? [],
    notes: r.notes ?? undefined,
  };
}

function scholarshipToRow(s: Omit<Scholarship, "id">) {
  return {
    name: s.name,
    provider: s.provider ?? "",
    coverage: s.coverage ?? null,
    closes_at: s.closesAt ?? null,
    url: s.url ?? null,
    requirements: s.requirements ?? [],
    notes: s.notes ?? null,
  };
}

export async function fetchRemoteScholarships(): Promise<Scholarship[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_scholarships")
      .select("*")
      .order("created_at");
    if (error || !data) return null;
    return (data as unknown as ScholarshipRow[]).map(mapScholarship);
  } catch {
    return null;
  }
}

export async function addRemoteScholarship(
  input: Omit<Scholarship, "id">,
): Promise<Scholarship | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("roadmap_scholarships")
      .insert({ ...scholarshipToRow(input), user_id: user.id })
      .select()
      .single();
    if (error || !data) return null;
    return mapScholarship(data as unknown as ScholarshipRow);
  } catch {
    return null;
  }
}

export async function updateRemoteScholarship(
  id: string,
  input: Omit<Scholarship, "id">,
): Promise<Scholarship | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("roadmap_scholarships")
      .update(scholarshipToRow(input))
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return null;
    return mapScholarship(data as unknown as ScholarshipRow);
  } catch {
    return null;
  }
}

export async function removeRemoteScholarship(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("roadmap_scholarships")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
