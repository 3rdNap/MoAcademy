// Shared types + prompt-building for the AI Study Assistant.
//
// The assistant is grounded in the student's MoAcademy content (their courses,
// assignments and registered subjects) but is also a capable general tutor and
// — when web search is enabled — can pull in fresh external information. The
// system prompt is assembled server-side in the /api/chat route from live data
// plus the lightweight client context the browser sends along.

/** Model the assistant defaults to. Overridable via ASSISTANT_MODEL. */
export const DEFAULT_ASSISTANT_MODEL = "claude-opus-4-8";

/** A single chat turn. `content` is plain text. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Client-provided grounding context. The browser owns some data (registered
 * subjects, study-guide titles) that the server can't see, so it ships a small
 * snapshot with each request. Kept intentionally tiny — titles, not bodies.
 */
export interface AssistantContext {
  /** Subjects the student has registered for (from Billing). */
  subjects?: string[];
  /** Titles of study guides available to the student. */
  guides?: string[];
  /** The course the student is currently looking at, if any. */
  currentCourse?: string;
}

/** Shape of the POST body accepted by /api/chat. */
export interface ChatRequest {
  messages: ChatMessage[];
  webSearch?: boolean;
  context?: AssistantContext;
}

export interface CourseBrief {
  name: string;
  code: string;
  instructor: string;
  progress: number;
}

export interface AssignmentBrief {
  title: string;
  course: string;
  dueAt: string;
  points: number;
}

/**
 * Build the system prompt. Server data (courses, upcoming work) and the
 * client's context snapshot are woven into a concise briefing so answers stay
 * grounded in what this specific student is studying.
 */
export function buildSystemPrompt(args: {
  studentName: string;
  courses: CourseBrief[];
  upcoming: AssignmentBrief[];
  context?: AssistantContext;
  webSearch: boolean;
}): string {
  const { studentName, courses, upcoming, context, webSearch } = args;

  const lines: string[] = [
    "You are Mo, the friendly AI study assistant for MoAcademy, an online",
    "high-school and college LMS. You help students learn: explain concepts",
    "clearly, work through problems step by step, quiz them, summarise study",
    "guides, and give feedback on their writing. Teach — don't just hand over",
    "answers to graded work; guide the student to understand it themselves.",
    "Be encouraging, concise, and use plain language. Format with Markdown",
    "(headings, lists, code blocks, and LaTeX-free math written plainly).",
    "",
    `You are talking to ${studentName}.`,
  ];

  if (courses.length) {
    lines.push(
      "",
      "Their current courses:",
      ...courses.map(
        (c) =>
          `- ${c.name} (${c.code}) with ${c.instructor} — ${c.progress}% complete`,
      ),
    );
  }

  if (context?.subjects?.length) {
    lines.push(
      "",
      `Subjects they have registered for: ${context.subjects.join(", ")}.`,
    );
  }

  if (context?.guides?.length) {
    lines.push(
      "",
      "Study guides available to them (refer to these when relevant):",
      ...context.guides.map((g) => `- ${g}`),
    );
  }

  if (context?.currentCourse) {
    lines.push("", `They are currently viewing: ${context.currentCourse}.`);
  }

  if (upcoming.length) {
    lines.push(
      "",
      "Upcoming deadlines (help them plan, but never do graded work for them):",
      ...upcoming
        .slice(0, 6)
        .map((a) => `- ${a.title} (${a.course}) due ${a.dueAt}, ${a.points} pts`),
    );
  }

  lines.push(
    "",
    webSearch
      ? "You have a web search tool. Use it for current events, recent facts, or anything outside the student's materials, and cite what you find."
      : "Web search is off for this conversation; answer from your own knowledge and the student's materials, and say when you're unsure rather than guessing.",
  );

  return lines.join("\n");
}
