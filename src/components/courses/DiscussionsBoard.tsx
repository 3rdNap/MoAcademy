"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  ChevronLeft,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  addRemoteReply,
  addRemoteTopic,
  fetchRemoteTopics,
  removeRemoteReply,
  type RemoteTopic,
} from "@/lib/discussions-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { initialsOf, relativeTime } from "@/lib/utils";
import type { Course } from "@/lib/types";

export interface SeedThread {
  id: string;
  title: string;
  module: string;
}

interface Topic {
  id: string;
  title: string;
  prompt: string;
  author: string;
  createdAt: string;
}

interface Reply {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: string;
  parentId?: string | null; // NULL/undefined = top-level reply; lets the demo thread too
}

type Source = "local" | "remote" | "seed";

// A reply flattened across remote + local sources, carrying its parent link
// so the detail view can rebuild the nested thread.
interface FlatReply {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  remote: boolean;
}

interface Thread {
  id: string;
  title: string;
  context: string;
  author: string;
  source: Source;
}

export function DiscussionsBoard({
  course,
  userName,
  seedThreads,
}: {
  course: Course;
  userName: string;
  seedThreads: SeedThread[];
}) {
  const topics = useLocalCollection<Topic>(
    `moacademy.discussions.topics.${course.id}`,
    [],
  );
  const replies = useLocalCollection<Reply>(
    `moacademy.discussions.replies.${course.id}`,
    [],
  );

  // Shared discussions (Supabase): signed-in users post for the whole class;
  // signed-out visitors keep the browser-local experience.
  const [remote, setRemote] = useState<RemoteTopic[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [pubNote, setPubNote] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRemoteTopics(course.id).then((r) => alive && setRemote(r));
    getSignedInUserId().then((id) => alive && setSignedIn(Boolean(id)));
    return () => {
      alive = false;
    };
  }, [course.id]);

  const [selected, setSelected] = useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", prompt: "" });
  const [composer, setComposer] = useState("");
  // Inline reply-to-reply: only one open at a time (the target reply's id).
  const [activeReplyTo, setActiveReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const threads: Thread[] = useMemo(
    () => [
      ...topics.items.map((t) => ({
        id: t.id,
        title: t.title,
        context: `Started by ${t.author}`,
        author: t.author,
        source: "local" as Source,
      })),
      ...(remote ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        context: `Started by ${t.author}`,
        author: t.author,
        source: "remote" as Source,
      })),
      ...seedThreads.map((t) => ({
        id: t.id,
        title: t.title,
        context: t.module,
        author: course.instructor,
        source: "seed" as Source,
      })),
    ],
    [topics.items, remote, seedThreads, course.instructor],
  );

  const remoteTopicFor = (threadId: string) =>
    remote?.find((t) => t.id === threadId);

  const replyCount = (threadId: string) =>
    replies.items.filter((r) => r.threadId === threadId).length +
    (remoteTopicFor(threadId)?.replies.length ?? 0);

  async function createTopic() {
    if (!draft.title.trim()) return;
    const title = draft.title.trim();
    const prompt = draft.prompt.trim() || "Share your thoughts below.";

    // Post to the whole class when signed in; otherwise keep it on-device.
    if (remote !== null && signedIn) {
      const created = await addRemoteTopic(course.id, {
        title,
        prompt,
        authorName: userName,
      });
      if (created) {
        setRemote((prev) => [created, ...(prev ?? [])]);
        setDraft({ title: "", prompt: "" });
        setNewTopicOpen(false);
        return;
      }
      setPubNote(
        "Couldn't post to the class — saved on this device instead.",
      );
    }

    topics.add({
      id: newId(),
      title,
      prompt,
      author: userName,
      createdAt: new Date().toISOString(),
    });
    setDraft({ title: "", prompt: "" });
    setNewTopicOpen(false);
  }

  // Post a reply to a topic (parentId undefined) or nested under another
  // reply (parentId set). Returns whether anything was posted.
  async function postReply(
    threadId: string,
    body: string,
    parentId?: string,
  ): Promise<boolean> {
    const text = body.trim();
    if (!text) return false;

    // Replies to shared topics go to the class when signed in.
    if (remoteTopicFor(threadId) && signedIn) {
      const created = await addRemoteReply(threadId, {
        body: text,
        authorName: userName,
        parentId,
      });
      if (created) {
        setRemote((prev) =>
          (prev ?? []).map((t) =>
            t.id === threadId ? { ...t, replies: [...t.replies, created] } : t,
          ),
        );
        return true;
      }
    }

    replies.add({
      id: newId(),
      threadId,
      author: userName,
      body: text,
      createdAt: new Date().toISOString(),
      parentId: parentId ?? null,
    });
    return true;
  }

  async function submitTopLevelReply(threadId: string) {
    if (await postReply(threadId, composer)) setComposer("");
  }

  async function submitInlineReply(threadId: string, parentId: string) {
    if (await postReply(threadId, replyBody, parentId)) {
      setReplyBody("");
      setActiveReplyTo(null);
    }
  }

  // Ids of a reply plus all its descendants, from a flat parentId list.
  function descendantIds<T extends { id: string; parentId?: string | null }>(
    rootId: string,
    rows: T[],
  ): string[] {
    const collected = [rootId];
    for (let i = 0; i < collected.length; i++) {
      for (const r of rows) {
        if (r.parentId === collected[i] && !collected.includes(r.id)) {
          collected.push(r.id);
        }
      }
    }
    return collected;
  }

  async function deleteReply(threadId: string, replyId: string, isRemote: boolean) {
    if (isRemote) {
      // Server cascade-deletes children; mirror that in local state so the
      // rendered sub-thread disappears without a refetch.
      const topic = remoteTopicFor(threadId);
      const doomed = new Set(
        topic ? descendantIds(replyId, topic.replies) : [replyId],
      );
      if (await removeRemoteReply(replyId)) {
        setRemote((prev) =>
          (prev ?? []).map((t) =>
            t.id === threadId
              ? { ...t, replies: t.replies.filter((r) => !doomed.has(r.id)) }
              : t,
          ),
        );
      }
      return;
    }
    // Local demo: drop the reply and its descendants to match a cascade.
    const threadReplies = replies.items.filter((r) => r.threadId === threadId);
    for (const id of descendantIds(replyId, threadReplies)) replies.remove(id);
  }

  // ----- Thread detail view -----
  if (selected) {
    const thread = threads.find((t) => t.id === selected);
    const localTopic = topics.items.find((t) => t.id === selected);
    const remoteTopic = remoteTopicFor(selected);
    const prompt = localTopic?.prompt ?? remoteTopic?.prompt;
    const threadReplies: FlatReply[] = [
      ...(remoteTopic?.replies ?? []).map((r) => ({
        id: r.id,
        author: r.author,
        body: r.body,
        createdAt: r.createdAt,
        parentId: r.parentId ?? null,
        remote: true,
      })),
      ...replies.items
        .filter((r) => r.threadId === selected)
        .map((r) => ({
          id: r.id,
          author: r.author,
          body: r.body,
          createdAt: r.createdAt,
          parentId: r.parentId ?? null,
          remote: false,
        })),
    ].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

    if (!thread) {
      setSelected(null);
      return null;
    }

    // Build a tree from the flat rows. Rows whose parent isn't present in this
    // thread (e.g. an orphan) fall back to top-level so nothing is dropped.
    const replyIds = new Set(threadReplies.map((r) => r.id));
    const childrenOf = (parentId: string | null) =>
      threadReplies.filter((r) => {
        const key = r.parentId && replyIds.has(r.parentId) ? r.parentId : null;
        return key === parentId;
      });

    // Cap indentation depth so deep chains stay readable on mobile; deeper
    // replies still render, just without extra left margin.
    const MAX_INDENT_DEPTH = 3;
    const renderReplies = (parentId: string | null, depth: number): ReactElement[] =>
      childrenOf(parentId).flatMap((r) => {
        const mine = r.author === userName;
        const indent = Math.min(depth, MAX_INDENT_DEPTH);
        return [
          <li
            key={r.id}
            className="space-y-3"
            style={indent ? { marginLeft: `${indent * 1.25}rem` } : undefined}
          >
            <div className="card flex gap-3 p-4">
              <Avatar
                initials={initialsOf(r.author)}
                color={mine ? "#10b6a3" : "#8b94a3"}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium text-ink">{r.author}</span>
                  {mine && (
                    <Badge tone="success" className="ml-2">
                      You
                    </Badge>
                  )}
                  <span className="ml-2 text-xs text-ink-faint">
                    {relativeTime(r.createdAt)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
                  {r.body}
                </p>
                <button
                  onClick={() => {
                    setActiveReplyTo((cur) => (cur === r.id ? null : r.id));
                    setReplyBody("");
                  }}
                  className="focus-ring mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                >
                  <MessageSquare className="h-3 w-3" /> Reply
                </button>
              </div>
              {mine && (
                <button
                  onClick={() => deleteReply(selected, r.id, r.remote)}
                  className="focus-ring h-fit rounded p-1 text-ink-faint hover:text-rose-600"
                  aria-label="Delete reply"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {activeReplyTo === r.id && (
              <div className="card p-3">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Reply to ${r.author}…`}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActiveReplyTo(null);
                      setReplyBody("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitInlineReply(selected, r.id)}
                    disabled={!replyBody.trim()}
                  >
                    <Send className="h-4 w-4" /> Reply
                  </Button>
                </div>
              </div>
            )}
          </li>,
          ...renderReplies(r.id, depth + 1),
        ];
      });

    return (
      <>
        <button
          onClick={() => {
            setSelected(null);
            setComposer("");
            setActiveReplyTo(null);
            setReplyBody("");
          }}
          className="focus-ring mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All discussions
        </button>

        <article className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar initials={initialsOf(thread.author)} color={course.color} />
            <div>
              <h1 className="text-lg font-semibold text-ink">{thread.title}</h1>
              <p className="text-xs text-ink-faint">
                {thread.author} · {thread.context}
              </p>
            </div>
          </div>
          {prompt && (
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {prompt}
            </p>
          )}
        </article>

        <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-faint">
          {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
        </h2>

        <ul className="space-y-3">
          {renderReplies(null, 0)}
          {threadReplies.length === 0 && (
            <li className="card p-6 text-center text-sm text-ink-faint">
              No replies yet — be the first to respond.
            </li>
          )}
        </ul>

        <div className="card mt-4 p-4">
          <p className="mb-2 text-sm font-medium text-ink">Add a reply</p>
          <Textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Write your response…"
          />
          <div className="mt-2 flex justify-end">
            <Button
              onClick={() => submitTopLevelReply(selected)}
              disabled={!composer.trim()}
            >
              <Send className="h-4 w-4" /> Post reply
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ----- Thread list view -----
  return (
    <>
      <PageHeader
        title="Discussions"
        subtitle={`${threads.length} discussion topics in ${course.code}.`}
        action={
          <Button onClick={() => setNewTopicOpen(true)}>
            <Plus className="h-4 w-4" /> New topic
          </Button>
        }
      />

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {threads.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquare className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">No discussions yet.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {threads.map((t) => {
            const count = replyCount(t.id);
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface-subtle"
              >
                <span
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: course.color }}
                >
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-ink">{t.title}</h3>
                    {t.source === "local" && <Badge tone="brand">New</Badge>}
                    {t.source === "remote" && <Badge tone="info">Class</Badge>}
                  </div>
                  <p className="text-xs text-ink-faint">{t.context}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={newTopicOpen}
        onClose={() => setNewTopicOpen(false)}
        title="Start a discussion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewTopicOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTopic} disabled={!draft.title.trim()}>
              Post topic
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Topic title *">
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. How did you approach the recursion lab?"
            />
          </Field>
          <Field label="Prompt">
            <Textarea
              value={draft.prompt}
              onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
              placeholder="Add context or a question to kick things off…"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
