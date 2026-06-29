"use client";

import { useMemo, useState } from "react";
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
}

interface Thread {
  id: string;
  title: string;
  context: string;
  author: string;
  local: boolean;
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

  const [selected, setSelected] = useState<string | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", prompt: "" });
  const [composer, setComposer] = useState("");

  const threads: Thread[] = useMemo(
    () => [
      ...topics.items.map((t) => ({
        id: t.id,
        title: t.title,
        context: `Started by ${t.author}`,
        author: t.author,
        local: true,
      })),
      ...seedThreads.map((t) => ({
        id: t.id,
        title: t.title,
        context: t.module,
        author: course.instructor,
        local: false,
      })),
    ],
    [topics.items, seedThreads, course.instructor],
  );

  const replyCount = (threadId: string) =>
    replies.items.filter((r) => r.threadId === threadId).length;

  function createTopic() {
    if (!draft.title.trim()) return;
    topics.add({
      id: newId(),
      title: draft.title.trim(),
      prompt: draft.prompt.trim() || "Share your thoughts below.",
      author: userName,
      createdAt: new Date().toISOString(),
    });
    setDraft({ title: "", prompt: "" });
    setNewTopicOpen(false);
  }

  function postReply(threadId: string) {
    if (!composer.trim()) return;
    replies.add({
      id: newId(),
      threadId,
      author: userName,
      body: composer.trim(),
      createdAt: new Date().toISOString(),
    });
    setComposer("");
  }

  // ----- Thread detail view -----
  if (selected) {
    const thread = threads.find((t) => t.id === selected);
    const topic = topics.items.find((t) => t.id === selected);
    const threadReplies = replies.items
      .filter((r) => r.threadId === selected)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

    if (!thread) {
      setSelected(null);
      return null;
    }

    return (
      <>
        <button
          onClick={() => {
            setSelected(null);
            setComposer("");
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
          {topic?.prompt && (
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              {topic.prompt}
            </p>
          )}
        </article>

        <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-ink-faint">
          {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
        </h2>

        <ul className="space-y-3">
          {threadReplies.map((r) => {
            const mine = r.author === userName;
            return (
              <li key={r.id} className="card flex gap-3 p-4">
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
                </div>
                {mine && (
                  <button
                    onClick={() => replies.remove(r.id)}
                    className="focus-ring h-fit rounded p-1 text-ink-faint hover:text-rose-600"
                    aria-label="Delete reply"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
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
              onClick={() => postReply(selected)}
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
                    {t.local && <Badge tone="brand">New</Badge>}
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
