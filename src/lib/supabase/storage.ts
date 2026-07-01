import { createSupabaseBrowserClient } from "./client";

const BUCKET = "study-guides";

/**
 * Upload a study-guide file to Supabase Storage and return its public URL.
 * Returns null when Supabase isn't configured, the user isn't signed in, or the
 * upload fails — callers then fall back to storing the file in the browser.
 */
export async function uploadStudyFile(
  file: File,
  kind: "pdf" | "thumb",
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
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) return null;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl ?? null;
  } catch {
    return null;
  }
}
