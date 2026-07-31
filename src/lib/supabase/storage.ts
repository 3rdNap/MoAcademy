import { subjects } from "@/lib/billing/subjects";
import { createSupabaseBrowserClient } from "./client";

const BUCKET = "study-guides";

/**
 * Upload a study-guide file to Supabase Storage and return its object *path*
 * (not a public URL): downloads are gated by RLS on the now-private bucket
 * (migration 0044), so callers resolve the path to a signed URL on read.
 * The subject code is baked into the path (`<uid>/<code>/<kind>/<uuid>-name`)
 * so the storage read policy can scope access by enrolment.
 *
 * Returns null when Supabase isn't configured, the user isn't signed in, or
 * the upload fails — callers then fall back to storing the file in the browser.
 */
export async function uploadStudyFile(
  file: File,
  kind: "pdf" | "thumb",
  subjectName: string,
): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const code = subjects.find((s) => s.name === subjectName)?.code ?? "_";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${code}/${kind}/${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) return null;

    return path;
  } catch {
    return null;
  }
}
