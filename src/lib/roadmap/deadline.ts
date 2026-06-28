import { daysUntil } from "@/lib/utils";

export type DeadlineState = {
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  label: string;
  closed: boolean;
};

/** Maps a closing date to a badge tone + human label. */
export function deadlineState(closesAt?: string, now = new Date()): DeadlineState {
  if (!closesAt) return { tone: "neutral", label: "No date set", closed: false };
  const d = daysUntil(closesAt, now);
  if (d < 0) return { tone: "neutral", label: "Closed", closed: true };
  if (d === 0) return { tone: "danger", label: "Closes today", closed: false };
  if (d === 1) return { tone: "danger", label: "Closes tomorrow", closed: false };
  if (d <= 7) return { tone: "warning", label: `${d} days left`, closed: false };
  if (d <= 30) return { tone: "info", label: `${d} days left`, closed: false };
  return { tone: "success", label: `${d} days left`, closed: false };
}
