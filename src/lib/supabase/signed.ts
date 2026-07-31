import { createSupabaseBrowserClient } from "./client";

/** A stored file value is either a bare Storage object path (which we sign) or
 *  an already-usable URL — a full http(s) link a teacher pasted, or a data:
 *  URL from the small-file fallback. Only bare paths need signing. */
export function isStoragePath(value: string | null | undefined): value is string {
  return !!value && !/^(https?:|data:|blob:)/i.test(value);
}

/** Resolve a stored file value to something an <img>/<a> can use: bare Storage
 *  paths become short-lived signed URLs (downloads are gated by RLS on private
 *  buckets — migration 0044); full/data URLs pass through untouched. Returns
 *  the original value if signing fails, so a still-public bucket keeps working. */
export async function resolveFileUrl(
  bucket: string,
  value: string | null | undefined,
  expiresIn = 3600,
): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isStoragePath(value)) return value;
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return value;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(value, expiresIn);
    if (error || !data?.signedUrl) return value;
    return data.signedUrl;
  } catch {
    return value;
  }
}
