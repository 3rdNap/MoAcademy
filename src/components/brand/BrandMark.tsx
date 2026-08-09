"use client";

import { useBrand } from "@/components/brand/BrandProvider";
import { cn } from "@/lib/utils";

/**
 * The logo mark as a drop-in nav icon — the blue "mo" year-round, the lilac
 * "wo" through Women's Month. Accepts the same props the lucide icons take so
 * it can sit in the global-nav item list (strokeWidth is ignored — it's an
 * image, not a stroke).
 */
export function BrandMarkIcon({
  className,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  const brand = useBrand();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.mark}
      alt=""
      className={cn("object-contain", className)}
    />
  );
}
