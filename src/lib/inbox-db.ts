// Supabase-backed real inbox messaging (see supabase/migrations/0021). Rows
// are flat; the app groups a thread by the other participant. Names are
// denormalized onto each message so reading a thread never requires
// cross-profile reads beyond what RLS already allows. Everything degrades to
// null/false so the board can fall back to the browser-local demo inbox.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface RemoteMessage {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  subject: string;
  body: string;
  sentAt: string;
  readAt?: string;
}

interface MessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name: string;
  recipient_name: string;
  subject: string;
  body: string;
  sent_at: string;
  read_at: string | null;
}

function mapRow(r: MessageRow): RemoteMessage {
  return {
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    senderName: r.sender_name,
    recipientName: r.recipient_name,
    subject: r.subject,
    body: r.body,
    sentAt: r.sent_at,
    readAt: r.read_at ?? undefined,
  };
}

/** All messages the signed-in user sent or received — or null when signed out/offline. */
export async function fetchMyMessages(): Promise<RemoteMessage[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("sent_at");
    if (error || !data) return null;
    return (data as unknown as MessageRow[]).map(mapRow);
  } catch {
    return null;
  }
}

/** Send a message as the signed-in user. Null when refused (not a course-mate). */
export async function sendRemoteMessage(input: {
  recipientId: string;
  recipientName: string;
  subject: string;
  body: string;
  senderName: string;
}): Promise<RemoteMessage | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: input.recipientId,
        sender_name: input.senderName,
        recipient_name: input.recipientName,
        subject: input.subject,
        body: input.body,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapRow(data as unknown as MessageRow);
  } catch {
    return null;
  }
}

/** Mark all unread messages from `peerId` to me as read. */
export async function markThreadRead(peerId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id)
      .eq("sender_id", peerId)
      .is("read_at", null);
    return !error;
  } catch {
    return false;
  }
}
