import { cn } from "@/lib/utils";

/**
 * The blue "mo" logo mark as a drop-in nav icon. Accepts the same props the
 * lucide icons take so it can sit in the global-nav item list (strokeWidth is
 * ignored — it's an image, not a stroke).
 */
export function MoMarkIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/mo-mark.png"
      alt=""
      className={cn("object-contain", className)}
    />
  );
}
