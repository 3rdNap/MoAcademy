import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { BrandProvider } from "@/components/brand/BrandProvider";
import { getBrand } from "@/lib/brand";
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

/**
 * Re-render at most an hour after the last one. The brand is a function of the
 * date (WoAcademy through August — see src/lib/brand.ts), so statically
 * generated pages would otherwise keep serving whichever identity was current
 * at build time. An hour bounds the changeover on 1 August and 1 September to
 * a window nobody will notice, at negligible cost.
 */
export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moacademy.vercel.app";

export function generateMetadata(): Metadata {
  const brand = getBrand();
  const title = `${brand.name} — Smart Learning`;
  const description =
    `${brand.name} — Smart Learning. Courses, study guides, university plans, and ` +
    `${brand.assistant}, your AI tutor, in one place. Built for students, instructors and parents.` +
    (brand.womensMonth
      ? " Celebrating Women's Month in South Africa."
      : "");

  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: `%s · ${brand.name}` },
    description,
    applicationName: brand.name,
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: brand.name,
      images: [{ url: brand.ogImage, width: 1200, height: 630, alt: title }],
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [brand.ogImage],
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const brand = getBrand();

  // Set the theme class before paint to avoid a flash of the wrong theme.
  const themeScript = `(function(){try{var t=localStorage.getItem('moacademy.theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

  return (
    <html
      lang="en"
      // brand.htmlClass re-tints every brand-* utility for Women's Month.
      className={`${inter.variable} ${poppins.variable} ${brand.htmlClass}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <BrandProvider brand={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}
