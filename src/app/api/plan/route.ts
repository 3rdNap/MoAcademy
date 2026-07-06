import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { DEFAULT_ASSISTANT_MODEL } from "@/lib/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PlanRequest {
  deadlines?: { title: string; course: string; dueAt: string; points: number }[];
  subjects?: string[];
  weakTopics?: { topic: string; pct: number }[];
}

export interface PlanDay {
  day: string;
  focus: string;
  tasks: string[];
}

/**
 * POST /api/plan — Mo turns the student's real deadlines, subjects and quiz
 * results into a 7-day study plan (JSON). Key handling matches /api/chat.
 */
export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Study plans aren't configured yet — add an ANTHROPIC_API_KEY to enable them.",
      },
      { status: 503 },
    );
  }

  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const today = new Date();
  const lines: string[] = [
    `Today is ${today.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}.`,
  ];
  if (body.deadlines?.length) {
    lines.push(
      "Upcoming deadlines:",
      ...body.deadlines
        .slice(0, 10)
        .map(
          (d) =>
            `- ${d.title} (${d.course}) due ${new Date(d.dueAt).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "short" })}, ${d.points} pts`,
        ),
    );
  }
  if (body.subjects?.length) {
    lines.push(`Registered subjects: ${body.subjects.slice(0, 12).join(", ")}.`);
  }
  if (body.weakTopics?.length) {
    lines.push(
      "Recent practice-quiz weak spots (needs revision):",
      ...body.weakTopics.slice(0, 6).map((w) => `- ${w.topic} (${w.pct}% correct)`),
    );
  }
  lines.push(
    "Build a realistic 7-day study plan starting today. 1–2 focused hours per day,",
    "prioritise work due soonest, schedule revision for the weak spots, and keep",
    "one lighter day. Encourage, don't overload.",
  );

  const system =
    "You are Mo, MoAcademy's study coach. Respond with ONLY a JSON array — " +
    "no prose, no code fences. Exactly 7 elements, one per day starting " +
    'today: {"day": weekday name, "focus": short theme, "tasks": [2-3 short, ' +
    "concrete tasks]}. Plain text inside strings, no Markdown.";

  const client = new Anthropic({ apiKey });
  const model = process.env.ASSISTANT_MODEL || DEFAULT_ASSISTANT_MODEL;

  try {
    // Adaptive thinking's shape is newer than the installed SDK's types, so
    // the params pass through a cast (same approach as /api/chat).
    const params = {
      model,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user" as const, content: lines.join("\n") }],
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
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const days = validate(raw);
    if (!days) {
      return NextResponse.json(
        { error: "Mo couldn't build the plan — try again in a moment." },
        { status: 502 },
      );
    }
    return NextResponse.json({ days });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach the assistant.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function validate(raw: string): PlanDay[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 5 || parsed.length > 7) {
      return null;
    }
    const out: PlanDay[] = [];
    for (const item of parsed) {
      const d = item as Partial<PlanDay>;
      if (
        typeof d.day !== "string" ||
        typeof d.focus !== "string" ||
        !Array.isArray(d.tasks) ||
        d.tasks.length === 0 ||
        d.tasks.some((t) => typeof t !== "string")
      ) {
        return null;
      }
      out.push({ day: d.day, focus: d.focus, tasks: d.tasks.slice(0, 4) });
    }
    return out;
  } catch {
    return null;
  }
}
