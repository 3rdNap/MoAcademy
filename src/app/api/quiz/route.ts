import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ASSISTANT_MODEL } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

interface QuizRequest {
  topic: string;
  count?: number;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
  explain: string;
}

/**
 * POST /api/quiz — Mo generates a multiple-choice practice quiz as JSON.
 * Server-side ANTHROPIC_API_KEY handling matches /api/chat; without a key we
 * return a friendly 503 so the UI can explain how to enable the feature.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Practice quizzes aren't configured yet — add an ANTHROPIC_API_KEY to enable them.",
      },
      { status: 503 },
    );
  }

  let body: QuizRequest;
  try {
    body = (await req.json()) as QuizRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Missing topic." }, { status: 400 });
  }
  const count = Math.min(Math.max(Number(body.count) || 5, 3), 10);

  const system =
    "You write practice quizzes for MoAcademy students (South African " +
    "high-school level unless the topic implies otherwise). Respond with " +
    "ONLY a JSON array — no prose, no code fences. Each element: " +
    '{"q": string, "options": [4 strings], "answer": 0-3, "explain": string}. ' +
    "Questions test understanding, not trivia; distractors are plausible; " +
    "explanations teach the underlying idea in one or two sentences.";

  const client = new Anthropic({ apiKey });
  const model = process.env.ASSISTANT_MODEL || DEFAULT_ASSISTANT_MODEL;

  try {
    // Adaptive thinking's shape is newer than the installed SDK's types, so
    // the params pass through a cast (same approach as /api/chat).
    const params = {
      model,
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      system,
      messages: [
        {
          role: "user" as const,
          content: `Write a ${count}-question multiple-choice quiz on: ${topic}`,
        },
      ],
    };
    const message = await client.messages.create(
      params as unknown as Parameters<typeof client.messages.create>[0],
    );
    const blocks =
      "content" in message
        ? (message.content as Array<{ type: string; text?: string }>)
        : [];
    const raw = blocks
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim()
      // Tolerate accidental code fences.
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const questions = validate(raw);
    if (!questions) {
      return NextResponse.json(
        { error: "Mo couldn't build that quiz — try a more specific topic." },
        { status: 502 },
      );
    }
    return NextResponse.json({ questions });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach the assistant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function validate(raw: string): QuizQuestion[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: QuizQuestion[] = [];
    for (const item of parsed) {
      const q = item as Partial<QuizQuestion>;
      if (
        typeof q.q !== "string" ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((o) => typeof o !== "string") ||
        typeof q.answer !== "number" ||
        q.answer < 0 ||
        q.answer > 3 ||
        typeof q.explain !== "string"
      ) {
        return null;
      }
      out.push({ q: q.q, options: q.options, answer: q.answer, explain: q.explain });
    }
    return out;
  } catch {
    return null;
  }
}
