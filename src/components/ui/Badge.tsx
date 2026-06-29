import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  info: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
