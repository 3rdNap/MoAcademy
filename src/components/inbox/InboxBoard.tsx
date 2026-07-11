"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Inbox as InboxIcon,
  PenSquare,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useLocalCollection, newId } from "@/lib/local-store";
import {
  fetchMyMessages,
  markThreadRead,
  sendRemoteMessage,
  type RemoteMessage,
} from "@/lib/inbox-db";
import { getSignedInUserId } from "@/lib/study-guides-db";
import { initialsOf, relativeTime } from "@/lib/utils";

export interface SeedConversation {
  id: string;
  with: string;
  courseCode?: string;
  color?: string;
  subject: string;
  preview: string;
  at: string;
  unread: boolean;
}

export interface InboxRecipient {
  id?: string;
  name: string;
}

interface LocalConversation {
  id: string;
  with: string;
  subject: string;
  at: string;
}

interface Message {
  id: string;
  conversationId: string;
  author: string;
  body: string;
  at: string;
  mine?: boolean;
}

interface Conversation {
  id: string;
  with: string;
  subject: string;
  courseCode?: string;
  color?: string;
  at: string;
  local: boolean;
  remote?: boolean;
  peerId?: string;
  seedPreview?: string;
}

export function InboxBoard({
  userName,
  seedConversations,
  recipients,
}: {
  userName: string;
  seedConversations: SeedConversation[];
  recipients: InboxRecipient[];
}) {
  const localConvos = useLocalCollection<LocalConversation>(
    "moacademy.inbox.conversations",
    [],
  );
  const messages = useLocalCollection<Message>("moacademy.inbox.messages", []);
  const read = useLocalCollection<{ id: string }>("moacademy.inbox.read", []);

  const [selected, setSelected] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState({ to: "", subject: "", body: "" });
  const [composer, setComposer] = useState("");

  // Real threads (Supabase): signed-in users get their actual messages;
  // signed-out visitors keep the browser-local demo inbox.
  const [remote, setRemote] = useState<RemoteMessage[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [pubNote, setPubNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSignedInUserId().then((id) => {
      if (!alive) return;
      setSignedIn(Boolean(id));
      setMyId(id);
    });
    fetchMyMessages().then((msgs) => alive && setRemote(msgs));
    return () => {
      alive = false;
    };
  }, []);

  // Deep link from the People page: /inbox?to=Name opens the composer.
  useEffect(() => {
    try {
      const to = new URLSearchParams(window.location.search).get("to");
      if (to) {
        setDraft((d) => ({ ...d, to }));
        setComposeOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const remoteConversations: Conversation[] = useMemo(() => {
    if (!remote || !myId) return [];
    const byPeer = new Map<string, RemoteMessage[]>();
    for (const m of remote) {
      const peerId = m.senderId === myId ? m.recipientId : m.senderId;
      const list = byPeer.get(peerId) ?? [];
      list.push(m);
      byPeer.set(peerId, list);
    }
    return Array.from(byPeer.entries()).map(([peerId, msgs]) => {
      const sorted = [...msgs].sort(
        (a, b) => +new Date(a.sentAt) - +new Date(b.sentAt),
      );
      const last = sorted[sorted.length - 1];
      return {
        id: `peer-${peerId}`,
        with: last.senderId === myId ? last.recipientName : last.senderName,
        subject: last.subject || "(no subject)",
        at: last.sentAt,
        local: false,
        remote: true,
        peerId,
      };
    });
  }, [remote, myId]);

  const conversations: Conversation[] = useMemo(
    () => [
      ...remoteConversations,
      ...localConvos.items.map((c) => ({
        id: c.id,
        with: c.with,
        subject: c.subject,
        at: c.at,
        local: true,
      })),
      ...seedConversations.map((c) => ({
        id: c.id,
        with: c.with,
        subject: c.subject,
        courseCode: c.courseCode,
        color: c.color,
        at: c.at,
        local: false,
        seedPreview: c.preview,
      })),
    ],
    [remoteConversations, localConvos.items, seedConversations],
  );

  const threadMessages = (c: Conversation): Message[] => {
    if (c.remote && c.peerId) {
      return (remote ?? [])
        .filter(
          (m) => (m.senderId === myId ? m.recipientId : m.senderId) === c.peerId,
        )
        .sort((a, b) => +new Date(a.sentAt) - +new Date(b.sentAt))
        .map((m) => ({
          id: m.id,
          conversationId: c.id,
          author: m.senderName,
          body: m.body,
          at: m.sentAt,
          mine: m.senderId === myId,
        }));
    }
    const local = messages.items
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => +new Date(a.at) - +new Date(b.at));
    if (c.local) return local;
    return [
      { id: `${c.id}_seed`, conversationId: c.id, author: c.with, body: c.seedPreview ?? "", at: c.at },
      ...local,
    ];
  };

  const lastActivity = (c: Conversation) => {
    const msgs = threadMessages(c);
    return msgs.length ? msgs[msgs.length - 1].at : c.at;
  };

  const isUnread = (c: Conversation) => {
    if (c.remote && c.peerId) {
      return (remote ?? []).some(
        (m) => m.senderId === c.peerId && m.recipientId === myId && !m.readAt,
      );
    }
    if (c.local) return false;
    const seed = seedConversations.find((s) => s.id === c.id);
    return Boolean(seed?.unread) && !read.items.some((r) => r.id === c.id);
  };

  const sorted = [...conversations].sort(
    (a, b) => +new Date(lastActivity(b)) - +new Date(lastActivity(a)),
  );
  const unreadCount = conversations.filter(isUnread).length;

  function open(id: string) {
    setSelected(id);
    setComposer("");
    const convo = conversations.find((c) => c.id === id);
    if (convo?.remote && convo.peerId) {
      const peerId = convo.peerId;
      markThreadRead(peerId);
      setRemote((prev) =>
        (prev ?? []).map((m) =>
          m.senderId === peerId && m.recipientId === myId && !m.readAt
            ? { ...m, readAt: new Date().toISOString() }
            : m,
        ),
      );
      return;
    }
    if (!read.items.some((r) => r.id === id)) read.add({ id });
  }

  async function reply() {
    if (!selected || !composer.trim()) return;
    const convo = conversations.find((c) => c.id === selected);
    const body = composer.trim();

    if (convo?.remote && convo.peerId) {
      const sent = await sendRemoteMessage({
        recipientId: convo.peerId,
        recipientName: convo.with,
        subject: convo.subject,
        body,
        senderName: userName,
      });
      if (sent) {
        setRemote((prev) => [...(prev ?? []), sent]);
        setComposer("");
      } else {
        setPubNote("Couldn't send — message not delivered.");
      }
      return;
    }

    messages.add({
      id: newId(),
      conversationId: selected,
      author: userName,
      body,
      at: new Date().toISOString(),
    });
    setComposer("");
  }

  async function sendNew() {
    if (!draft.to.trim() || !draft.body.trim()) return;
    const to = draft.to.trim();
    const subject = draft.subject.trim() || "(no subject)";
    const body = draft.body.trim();
    const match = recipients.find(
      (r) => r.name.toLowerCase() === to.toLowerCase(),
    );

    if (match?.id && signedIn) {
      const sent = await sendRemoteMessage({
        recipientId: match.id,
        recipientName: match.name,
        subject,
        body,
        senderName: userName,
      });
      if (sent) {
        setRemote((prev) => [...(prev ?? []), sent]);
        setDraft({ to: "", subject: "", body: "" });
        setComposeOpen(false);
        setSelected(`peer-${sent.recipientId}`);
        return;
      }
      setPubNote("Couldn't send — saved on this device instead.");
    }

    const id = newId();
    const now = new Date().toISOString();
    localConvos.add({ id, with: to, subject, at: now });
    messages.add({
      id: newId(),
      conversationId: id,
      author: userName,
      body,
      at: now,
    });
    setDraft({ to: "", subject: "", body: "" });
    setComposeOpen(false);
    setSelected(id);
  }

  // ---- Conversation detail ----
  if (selected) {
    const convo = conversations.find((c) => c.id === selected);
    if (!convo) {
      setSelected(null);
      return null;
    }
    const msgs = threadMessages(convo);

    return (
      <>
        <button
          onClick={() => setSelected(null)}
          className="focus-ring mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          All messages
        </button>

        <div className="mb-4">
          <h1 className="text-xl font-bold text-ink">{convo.subject}</h1>
          <p className="text-sm text-ink-faint">
            with {convo.with}
            {convo.courseCode ? ` · ${convo.courseCode}` : ""}
          </p>
        </div>

        {pubNote && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            {pubNote}
          </p>
        )}

        <ul className="space-y-3">
          {msgs.map((m) => {
            const mine = m.mine ?? m.author === userName;
            return (
              <li
                key={m.id}
                className={mine ? "flex flex-row-reverse gap-3" : "flex gap-3"}
              >
                <Avatar
                  initials={initialsOf(m.author)}
                  color={mine ? "#10b6a3" : convo.color ?? "#8b94a3"}
                  size={32}
                />
                <div
                  className={
                    mine
                      ? "max-w-[80%] rounded-xl rounded-tr-sm bg-brand-600 px-3 py-2 text-sm text-white"
                      : "max-w-[80%] rounded-xl rounded-tl-sm bg-surface px-3 py-2 text-sm text-ink shadow-card"
                  }
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p
                    className={
                      mine
                        ? "mt-1 text-[11px] text-white/70"
                        : "mt-1 text-[11px] text-ink-faint"
                    }
                  >
                    {m.author} · {relativeTime(m.at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="card mt-4 p-3">
          <Textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder={`Reply to ${convo.with}…`}
            className="min-h-[72px]"
          />
          <div className="mt-2 flex justify-end">
            <Button onClick={reply} disabled={!composer.trim()}>
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      </>
    );
  }

  // ---- Conversation list ----
  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread · messages from your instructors and classmates.`
            : "Messages from your instructors and classmates."
        }
        action={
          <Button onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4" /> Compose
          </Button>
        }
      />

      {pubNote && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          {pubNote}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <InboxIcon className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">Your inbox is empty.</p>
        </div>
      ) : (
        <div className="card divide-y divide-black/5">
          {sorted.map((c) => {
            const unread = isUnread(c);
            const msgs = threadMessages(c);
            const last = msgs[msgs.length - 1];
            return (
              <button
                key={c.id}
                onClick={() => open(c.id)}
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface-subtle"
              >
                <Avatar
                  initials={initialsOf(c.with)}
                  color={c.color ?? "#0284c7"}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={
                        unread
                          ? "text-sm font-semibold text-ink"
                          : "text-sm font-medium text-ink-muted"
                      }
                    >
                      {c.with}
                    </p>
                    {unread && (
                      <span className="h-2 w-2 rounded-full bg-brand-600" />
                    )}
                    {c.local && <Badge tone="brand">Sent</Badge>}
                    <span className="ml-auto text-xs text-ink-faint">
                      {relativeTime(lastActivity(c))}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-ink">{c.subject}</p>
                  {last && (
                    <p className="truncate text-sm text-ink-muted">
                      {(last.mine ?? last.author === userName) ? "You: " : ""}
                      {last.body}
                    </p>
                  )}
                  {c.courseCode && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {c.courseCode}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="New message"
        footer={
          <>
            <Button variant="ghost" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={sendNew}
              disabled={!draft.to.trim() || !draft.body.trim()}
            >
              <Send className="h-4 w-4" /> Send
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="To *">
            <Input
              list="moa-recipients"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              placeholder="Name…"
            />
            <datalist id="moa-recipients">
              {recipients.map((r) => (
                <option key={r.name} value={r.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Subject">
            <Input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="What's it about?"
            />
          </Field>
          <Field label="Message *">
            <Textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder="Write your message…"
              className="min-h-[120px]"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
