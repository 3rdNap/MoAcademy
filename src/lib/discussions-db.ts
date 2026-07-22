// Supabase-backed course discussions (see supabase/migrations/0013). Topics
// and replies are student-generated: signed-in users post as themselves,
// authors delete their own, teaching roles moderate. Everything degrades to
// null/false so the board can fall back to the browser-local store.

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface RemoteReply {
  id: string;
  author: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  parentId: string | null; // NULL = top-level reply to the topic (migration 0040)
}

export interface RemoteTopic {
  id: string;
  title: string;
  prompt: string;
  author: string;
  authorId: string | null;
  createdAt: string;
  replies: RemoteReply[];
}

interface ReplyRow {
  id: string;
  topic_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

interface TopicRow {
  id: string;
  course_key: string;
  title: string;
  prompt: string;
  author_id: string | null;
  author_name: string;
  created_at: string;
  discussion_replies: ReplyRow[] | null;
}

function mapReply(r: ReplyRow): RemoteReply {
  return {
    id: r.id,
    author: r.author_name,
    authorId: r.author_id,
    body: r.body,
    createdAt: r.created_at,
    parentId: r.parent_id,
  };
}

function mapTopic(r: TopicRow): RemoteTopic {
  return {
    id: r.id,
    title: r.title,
    prompt: r.prompt,
    author: r.author_name,
    authorId: r.author_id,
    createdAt: r.created_at,
    replies: (r.discussion_replies ?? [])
      .map(mapReply)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
  };
}

/** Shared topics (with replies) for a course, newest topic first — or null. */
export async function fetchRemoteTopics(
  courseKey: string,
): Promise<RemoteTopic[] | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("discussion_topics")
      .select("*, discussion_replies(*)")
      .eq("course_key", courseKey)
      .order("created_at", { ascending: false });
    if (error || !data) return null;
    return (data as unknown as TopicRow[]).map(mapTopic);
  } catch {
    return null;
  }
}

/** Post a topic as the signed-in user. Null when signed out / refused. */
export async function addRemoteTopic(
  courseKey: string,
  input: { title: string; prompt: string; authorName: string },
): Promise<RemoteTopic | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("discussion_topics")
      .insert({
        course_key: courseKey,
        title: input.title,
        prompt: input.prompt,
        author_id: user.id,
        author_name: input.authorName,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapTopic({ ...(data as unknown as TopicRow), discussion_replies: [] });
  } catch {
    return null;
  }
}

/** Post a reply as the signed-in user. Null when signed out / refused. */
export async function addRemoteReply(
  topicId: string,
  input: { body: string; authorName: string; parentId?: string },
): Promise<RemoteReply | null> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("discussion_replies")
      .insert({
        topic_id: topicId,
        parent_id: input.parentId ?? null,
        author_id: user.id,
        author_name: input.authorName,
        body: input.body,
      })
      .select()
      .single();
    if (error || !data) return null;
    return mapReply(data as unknown as ReplyRow);
  } catch {
    return null;
  }
}

export async function removeRemoteReply(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("discussion_replies")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}

export async function removeRemoteTopic(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from("discussion_topics")
      .delete()
      .eq("id", id);
    return !error;
  } catch {
    return false;
  }
}
