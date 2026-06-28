"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A localStorage-backed collection with CRUD helpers. Lets the app persist
 * user-owned data with no backend configured. The same record shapes map to the
 * Supabase migrations for when data should live server-side.
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
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
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
