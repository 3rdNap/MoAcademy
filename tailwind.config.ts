import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MoAcademy brand — a deep indigo/violet that blends Canvas's
        // confident accent with Brightspace's calm, professional palette.
        brand: {
          50: "#eef0ff",
          100: "#e0e3ff",
          200: "#c7ccff",
          300: "#a5a9ff",
          400: "#867dfd",
          500: "#6f5ef6",
          600: "#5d3fea",
          700: "#4f30cf",
          800: "#412aa7",
          900: "#372884",
          950: "#22174d",
        },
        accent: {
          DEFAULT: "#10b6a3",
          fg: "#0b7a6e",
        },
        // Semantic tokens are CSS variables so the app can switch between light
        // and dark themes (see globals.css :root / .dark).
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          subtle: "rgb(var(--surface-subtle) / <alpha-value>)",
          sunken: "rgb(var(--surface-sunken) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        cardhover:
          "0 4px 12px rgba(16, 24, 40, 0.08), 0 2px 4px rgba(16, 24, 40, 0.06)",
        rail: "1px 0 0 rgba(16, 24, 40, 0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
      },
    },
  },
  plugins: [],
};

export default config;
