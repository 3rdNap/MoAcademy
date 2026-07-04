import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes MoAcademy installable ("Add to Home screen") with
 * the mo mark as its app icon and the dashboard as the entry point.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoAcademy — Smart Learning",
    short_name: "MoAcademy",
    description:
      "Courses, study guides, university plans and Mo — your AI tutor — in one place.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#082f49",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
