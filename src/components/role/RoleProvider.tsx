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
  /** True when a real account is signed in — the role is fixed, no previewing. */
  locked: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

/**
 * Supplies the active role. For a signed-in user it's LOCKED to their real
 * account role (`authedRole`) — no persona switching. For the anonymous demo
 * it's a previewable, localStorage-persisted choice.
 */
export function RoleProvider({
  children,
  authedRole = null,
}: {
  children: React.ReactNode;
  authedRole?: Role | null;
}) {
  const locked = authedRole != null;
  const [role, setRoleState] = useState<Role>(authedRole ?? "student");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (locked) {
      setHydrated(true);
      return;
    }
    try {
      const stored = window.localStorage.getItem(ROLE_KEY);
      if (isRole(stored)) setRoleState(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [locked]);

  const setRole = useCallback(
    (next: Role) => {
      if (locked) return; // real accounts can't switch personas
      setRoleState(next);
      try {
        window.localStorage.setItem(ROLE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [locked],
  );

  return (
    <RoleContext.Provider value={{ role, setRole, hydrated, locked }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within a RoleProvider");
  return ctx;
}
