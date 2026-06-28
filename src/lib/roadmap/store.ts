"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A localStorage-backed collection with CRUD helpers. This lets students add,
 * edit and delete their own roadmap content with no backend configured — it
 * persists in the browser. When Supabase is wired up, these same shapes map to
 * the tables in supabase/migrations/0002_roadmap.sql.
 */
export function useLocalCollection<T extends { id: string }>(
  key: string,
  seed: T[],
) {
  const [items, setItems] = useState<T[]>(seed);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted data once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setItems(JSON.parse(raw) as T[]);
    } catch {
      // Corrupt/unavailable storage — fall back to seed.
    }
    setHydrated(true);
  }, [key]);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // Quota exceeded or storage disabled — keep working in memory.
    }
  }, [key, items, hydrated]);

  const add = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const update = useCallback((id: string, patch: Partial<T>) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const reset = useCallback(() => setItems(seed), [seed]);

  return { items, add, update, remove, reset, hydrated };
}

/** Short unique id for new records (browser crypto, with a fallback). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
