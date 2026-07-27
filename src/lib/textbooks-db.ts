// Supabase-backed textbook reading list. Rows live in public.textbooks
// (migration 0042): any signed-in user reads; admins and the subject's
// instructors manage (RLS enforced). Cover images / PDFs go to the public
// textbook-files bucket. Every function degrades to null/false so callers can
// fall back to the anonymous empty state.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Textbook {
  id: string;
  subjectCode: string;
  title: string;
  author: string;
  edition: string;
  isbn: string;
  description: string;
  required: boolean;
  coverUrl?: string;
  resourceUrl?: string;
  filePath?: string;
}

export type TextbookInput = Omit<Textbook, "id">;

interface TextbookRow {
  id: string;
  subject_code: string;
  title: string;
  author: string;
  edition: string;
  isbn: string;
  description: string;
  required: boolean;
  cover_url: string | null;
  resource_url: string | null;
  file_path: string | null;
}

function mapRow(r: TextbookRow): Textbook {
  return {
    id: r.id,
    subjectCode: r.subject_code,
    title: r.title,
    author: r.author,
    edition: r.edition,
    isbn: r.isbn,
    description: r.description,
    required: r.required,
    coverUrl: r.cover_url ?? undefined,
    resourceUrl: r.resource_url ?? undefined,
    filePath: r.file_path ?? undefined,
  };
}

function toRow(t: Partial<TextbookInput>) {
  const row: Record<string, unknown> = {};
  if (t.subjectCode !== undefined) row.subject_code = t.subjectCode;
  if (t.title !== undefined) row.title = t.title;
  if (t.author !== undefined) row.author = t.author;
  if (t.edition !== undefined) row.edition = t.edition;
  if (t.isbn !== undefined) row.isbn = t.isbn;
  if (t.description !== undefined) row.description = t.description;
  if (t.required !== undefined) row.required = t.required;
  if (t.coverUrl !== undefined) row.cover_url = t.coverUrl || null;
  if (t.resourceUrl !== undefined) row.resource_url = t.resourceUrl || null;
  if (t.filePath !== undefined) row.file_path = t.filePath || null;
  return row;
}

/** The signed-in user's id, or null when signed out / unconfigured. */
export async function getSignedInUserId(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** All textbooks (RLS: any signed-in user reads), by subject then title — or null. */
export async function fetchTextbooks(): Promise<Textbook[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("textbooks")
      .select("*")
      .order("subject_code", { ascending: true })
      .order("title", { ascending: true });
    if (error || !data) return null;
    return (data as unknown as TextbookRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Add a textbook. Null if the write was refused (not admin / not the subject's instructor). */
export async function addTextbook(
  input: TextbookInput,
): Promise<Textbook | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("textbooks")
      .insert({ ...toRow(input), created_by: user.id })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as TextbookRow);
  } catch {
    return null;
  }
}

export async function updateTextbook(
  id: string,
  patch: Partial<TextbookInput>,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("textbooks")
      .update(toRow(patch))
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeTextbook(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("textbooks").delete().eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Upload a cover image or PDF to the public textbook-files bucket and return
 * its public URL. Files land in the uploader's own folder (RLS requires it).
 * Null when signed out / unconfigured / the upload fails.
 */
export async function uploadTextbookFile(
  file: File,
  kind: "cover" | "pdf",
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${kind}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("textbook-files")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) return null;

    const { data } = supabase.storage
      .from("textbook-files")
      .getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}
