import type { MetadataRoute } from "next";

/**
 * Pre-launch: keep the preview deployment out of search engines. When the
 * platform goes public, flip `PRELAUNCH` to false (or delete this guard) to
 * allow indexing.
 */
const PRELAUNCH = true;

export default function robots(): MetadataRoute.Robots {
  return PRELAUNCH
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/" } };
}
