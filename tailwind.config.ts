import type { Config } from "tailwindcss";

const config: Config = {
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
        ink: {
          DEFAULT: "#1f2733",
          muted: "#5b6573",
          faint: "#8b94a3",
        },
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f6f7fb",
          sunken: "#eef0f6",
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
