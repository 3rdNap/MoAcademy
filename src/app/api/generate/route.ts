import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ASSISTANT_MODEL } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 30;

interface GenerateRequest {
  kind: "assignment-description" | "announcement-body" | "family-summary";
  /** Assignment/announcement title — or the child's name for family-summary. */
  title: string;
  type?: string;
  course?: string;
  points?: number;
  /** Context lines (grades, deadlines) for family-summary. */
  details?: string[];
}

/**
 * POST /api/generate — short, non-streaming authoring assists ("Draft with
 * Mo"). Same server-side key handling as /api/chat: the ANTHROPIC_API_KEY
 * never reaches the browser, and without it we return a friendly 503.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Drafting with Mo isn't configured yet — add an ANTHROPIC_API_KEY to enable it.",
      },
      { status: 503 },
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const kinds = ["assignment-description", "announcement-body", "family-summary"];
  if (!kinds.includes(body.kind) || !body.title?.trim()) {
    return NextResponse.json({ error: "Missing title." }, { status: 400 });
  }

  const system =
    body.kind === "family-summary"
      ? "You are Mo, MoAcademy's assistant, writing for a parent about their " +
        "child's schoolwork. Warm, honest and concrete — no jargon, no " +
        "Markdown, no headings. 3 to 4 sentences, ending with one practical " +
        "way the parent can help this week."
      : "You draft course content for MoAcademy, an online school. Write clear, " +
        "encouraging text students can act on. Plain text only — no Markdown " +
        "headings or asterisks. Keep it under 120 words.";

  const prompt =
    body.kind === "family-summary"
      ? `Summarise how ${body.title.trim()} is doing at school for their parent, based on:\n` +
        (body.details ?? []).slice(0, 20).join("\n")
      : body.kind === "announcement-body"
        ? `Write the body of a course announcement titled "${body.title.trim()}"` +
          (body.course ? ` for the course "${body.course}"` : "") +
          ". Friendly and direct: what's happening, what students should do, and by when (leave specifics like exact dates as placeholders in square brackets if unknown)."
        : `Write the student-facing description for this ${body.type || "assignment"}` +
          (body.course ? ` in the course "${body.course}"` : "") +
          `: "${body.title.trim()}"` +
          (body.points ? ` (worth ${body.points} points)` : "") +
          ". Cover what to do, what to hand in, and one tip for doing well.";

  const client = new Anthropic({ apiKey });
  const model = process.env.ASSISTANT_MODEL || DEFAULT_ASSISTANT_MODEL;

  try {
    // Adaptive thinking's shape is newer than the installed SDK's types, so
    // the params pass through a cast (same approach as /api/chat).
    const params = {
      model,
      max_tokens: 1000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user" as const, content: prompt }],
    };
    const message = await client.messages.create(
      params as unknown as Parameters<typeof client.messages.create>[0],
    );
    const blocks =
      "content" in message
        ? (message.content as Array<{ type: string; text?: string }>)
        : [];
    const text = blocks
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) {
      return NextResponse.json(
        { error: "Mo couldn't draft that — try a more specific title." },
        { status: 502 },
      );
    }
    return NextResponse.json({ text });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach the assistant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
