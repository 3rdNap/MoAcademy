import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Poppins — the logo lockup's typeface (ACADEMY / SMART LEARNING).
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "800"],
  variable: "--font-display",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moacademy.vercel.app";
const description =
  "MoAcademy — Smart Learning. Courses, study guides, university plans, and Mo, your AI tutor, in one place. Built for students, instructors and parents.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MoAcademy — Smart Learning",
    template: "%s · MoAcademy",
  },
  description,
  applicationName: "MoAcademy",
  openGraph: {
    title: "MoAcademy — Smart Learning",
    description,
    url: siteUrl,
    siteName: "MoAcademy",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "MoAcademy — Smart Learning" }],
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoAcademy — Smart Learning",
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set the theme class before paint to avoid a flash of the wrong theme.
  const themeScript = `(function(){try{var t=localStorage.getItem('moacademy.theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
