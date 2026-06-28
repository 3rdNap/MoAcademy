import { cn } from "@/lib/utils";

/** Brightspace-style homepage widget: titled card with optional action. */
export function Widget({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card flex flex-col", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
