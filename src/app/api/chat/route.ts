import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getCourses, getCurrentUser, getUpcoming } from "@/lib/data";
import {
  buildSystemPrompt,
  DEFAULT_ASSISTANT_MODEL,
  type ChatRequest,
} from "@/lib/assistant";

// The assistant streams potentially long answers, so keep this on the Node
// runtime (not edge) and allow a generous execution window.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/chat — streams a Claude response for the study assistant.
 *
 * The ANTHROPIC_API_KEY is read here and never leaves the server. When it's
 * unset we return a 503 with a friendly hint so the UI can explain how to
 * enable the feature instead of erroring out.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "The AI assistant isn't configured yet. Add an ANTHROPIC_API_KEY to enable it.",
      },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && m.content?.trim(),
  );
  if (!messages.length) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  // Ground the assistant in this student's live content.
  const [user, courses, upcoming] = await Promise.all([
    getCurrentUser(),
    getCourses(),
    getUpcoming(),
  ]);

  const webSearch = body.webSearch !== false; // default on
  const system = buildSystemPrompt({
    studentName: user.name,
    courses: courses.map((c) => ({
      name: c.name,
      code: c.code,
      instructor: c.instructor,
      progress: c.progress,
    })),
    upcoming: upcoming.map((a) => {
      const course = courses.find((c) => c.id === a.courseId);
      return {
        title: a.title,
        course: course?.code ?? "",
        dueAt: new Date(a.dueAt).toLocaleDateString(),
        points: a.points,
      };
    }),
    context: body.context,
    webSearch,
  });

  const client = new Anthropic({ apiKey });
  const model = process.env.ASSISTANT_MODEL || DEFAULT_ASSISTANT_MODEL;
  const isFable = model.startsWith("claude-fable");

  // Web search is a server tool: Claude runs it and folds results into its
  // answer automatically — nothing to execute client-side.
  const tools = webSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]
    : undefined;

  // Adaptive thinking, the web-search tool type, and (for Fable) server-side
  // fallbacks are all current API features whose shapes are newer than the
  // installed SDK's published types, so the params are assembled as a plain
  // object and passed through. Fable 5 opts into fallbacks so a benign
  // safety-classifier refusal is transparently re-served by Opus 4.8.
  const params = {
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    ...(tools ? { tools } : {}),
    ...(isFable
      ? {
          betas: ["server-side-fallback-2026-06-01"],
          fallbacks: [{ model: DEFAULT_ASSISTANT_MODEL }],
        }
      : {}),
  };

  try {
    const stream = isFable
      ? client.beta.messages.stream(
          params as unknown as Parameters<typeof client.beta.messages.stream>[0],
        )
      : client.messages.stream(
          params as unknown as Parameters<typeof client.messages.stream>[0],
        );

    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : "The assistant hit an error.";
          controller.enqueue(encoder.encode(`\n\n_[${msg}]_`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach the assistant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
