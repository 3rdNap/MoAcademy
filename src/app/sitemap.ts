import type { MetadataRoute } from "next";

/**
 * Sitemap for the publicly indexable pages (the app itself sits behind auth).
 * Pairs with robots.ts — while PRELAUNCH blocks all crawling this is simply
 * unused; at launch it points search engines at the front door.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moacademy.vercel.app";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
  ];
}
