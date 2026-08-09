import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/brand";

/** Refresh hourly so the installed app follows the August brand switch. */
export const revalidate = 3600;

/**
 * Web app manifest — makes the academy installable ("Add to Home screen") with
 * the logo mark as its app icon and the dashboard as the entry point. Follows
 * the seasonal brand, so an August install lands as WoAcademy in lilac.
 */
export default function manifest(): MetadataRoute.Manifest {
  const brand = getBrand();

  return {
    name: `${brand.name} — Smart Learning`,
    short_name: brand.name,
    description:
      `Courses, study guides, university plans and ${brand.assistant} — ` +
      "your AI tutor — in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: brand.womensMonth ? "#3b1049" : "#082f49",
    icons: [
      { src: brand.icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: brand.icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: brand.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
