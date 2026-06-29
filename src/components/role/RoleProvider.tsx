"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Role } from "@/lib/types";
import { ROLE_KEY, isRole } from "@/lib/role";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  /** True once the persisted role has loaded, to avoid hydration flicker. */
  hydrated: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("student");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROLE_KEY);
      if (isRole(stored)) setRoleState(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    try {
      window.localStorage.setItem(ROLE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, hydrated }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
