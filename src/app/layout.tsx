import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MoAcademy",
    template: "%s · MoAcademy",
  },
  description:
    "MoAcademy — a modern learning management system inspired by Brightspace and Canvas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Set the theme class before paint to avoid a flash of the wrong theme.
  const themeScript = `(function(){try{var t=localStorage.getItem('moacademy.theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
