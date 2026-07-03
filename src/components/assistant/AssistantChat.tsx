"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Globe, SendHorizonal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useLocalCollection } from "@/lib/local-store";
import { seedGuides, type StudyGuide } from "@/lib/study-guides";
import type { Registration } from "@/lib/billing/registration";
import type { ChatMessage } from "@/lib/assistant";
import { renderMarkdown } from "./markdown";

const SUGGESTIONS = [
  "Explain a concept I'm stuck on",
  "Quiz me on my registered subjects",
  "Help me plan for my upcoming deadlines",
  "Summarise one of my study guides",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-owned grounding: registered subjects + available study guides.
  const registrations = useLocalCollection<Registration>(
    "moacademy.billing.registrations",
    [],
  );
  const guides = useLocalCollection<StudyGuide>("moacademy.studyGuides", seedGuides);

  const subjects = useMemo(
    () => [
      ...new Set(registrations.items.flatMap((r) => r.items.map((i) => i.name))),
    ],
    [registrations.items],
  );
  const guideTitles = useMemo(() => {
    const registered = new Set(subjects);
    return guides.items
      .filter((g) => registered.has(g.subject))
      .map((g) => `${g.title} (${g.subject})`);
  }, [guides.items, subjects]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    setInput("");

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
      { role: "assistant", content: "" },
    ];
    setMessages(nextMessages);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(0, -1), // drop the empty placeholder
          webSearch,
          context: { subjects, guides: guideTitles },
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ?? "The assistant is unavailable right now.",
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // Stream deltas straight into the last (assistant) message.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      // Drop the empty assistant bubble on failure.
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length && copy[copy.length - 1].content === "") copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="Study Assistant"
        subtitle="Ask Mo anything — grounded in your courses and study guides, with the whole web when you need it."
        action={
          messages.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          ) : undefined
        }
      />

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-black/5 bg-surface-subtle/40 p-4 dark:border-white/5"
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <MoMark className="h-14 w-14 rounded-2xl text-xl" />
            <div>
              <p className="text-lg font-semibold text-ink">Hi, I&apos;m Mo 👋</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                Your personal tutor. I know your courses and study guides, and I
                can explain concepts, quiz you, and help you plan — I&apos;ll
                guide you through graded work rather than just handing over
                answers.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="focus-ring rounded-full border border-black/10 bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-brand-300 hover:text-ink dark:border-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} busy={busy && i === messages.length - 1} />)
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10">
          {error}
        </p>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <button
          type="button"
          onClick={() => setWebSearch((v) => !v)}
          title={webSearch ? "Web search on" : "Web search off"}
          className={`focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            webSearch
              ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/10"
              : "border-black/10 text-ink-faint hover:text-ink dark:border-white/10"
          }`}
        >
          <Globe className="h-5 w-5" />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Ask Mo about your studies…"
          className="focus-ring max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-black/10 bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint dark:border-white/10"
        />
        <Button
          type="submit"
          disabled={busy || !input.trim()}
          className="h-11 w-11 shrink-0 !px-0"
        >
          <SendHorizonal className="h-5 w-5" />
        </Button>
      </form>
      <p className="mt-1.5 text-center text-[11px] text-ink-faint">
        Mo is powered by Anthropic&apos;s Claude and can make mistakes —
        double-check important facts.
        {webSearch ? " Web search is on." : " Web search is off."}
      </p>
    </div>
  );
}

function Bubble({ message, busy }: { message: ChatMessage; busy: boolean }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] gap-3">
        <MoMark className="mt-0.5 h-8 w-8 shrink-0 rounded-lg text-[11px]" />
        <div className="min-w-0 rounded-2xl rounded-tl-md bg-surface px-4 py-2.5 text-sm text-ink shadow-sm ring-1 ring-black/5 dark:ring-white/5">
          {message.content ? (
            renderMarkdown(message.content)
          ) : busy ? (
            <span className="inline-flex gap-1">
              <Dot /> <Dot /> <Dot />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink-faint" />
  );
}

/** Mo's avatar — the same "Mo" wordmark badge as the MoAcademy logo. */
function MoMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-brand-950 font-black tracking-tight text-white ${className ?? ""}`}
    >
      Mo
    </div>
  );
}
