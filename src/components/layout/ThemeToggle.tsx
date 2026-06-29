"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "moacademy.theme";

/** Light/dark theme toggle. The initial class is set pre-hydration by the
 *  inline script in the root layout; this just flips and persists it. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-sunken"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {/* Render a stable icon until mounted to avoid SSR mismatch. */}
      {mounted && dark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}
