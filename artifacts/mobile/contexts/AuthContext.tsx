import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth, useUser } from "@clerk/expo";
import { apiFetch, setApiTokenGetter, type MeResponse, type MeMembership } from "@/lib/api";

export type ActiveEmployee = {
  userId: string;
  displayName: string;
  role: "owner" | "manager" | "staff";
  employeeRole?: string | null;
};

interface AuthCtxValue {
  ready: boolean;
  isSignedIn: boolean;
  me: MeResponse | null;
  currentMembership: MeMembership | null;
  activeEmployee: ActiveEmployee | null;
  setActiveEmployee: (e: ActiveEmployee) => void;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthCtxValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut: _signOut } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [activeEmployee, setActiveEmployeeState] = useState<ActiveEmployee | null>(null);

  // Wire token getter for the api lib
  useEffect(() => {
    setApiTokenGetter(async () => {
      try {
        return (await getToken()) ?? null;
      } catch {
        return null;
      }
    });
    return () => setApiTokenGetter(null);
  }, [getToken]);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setMe(null);
      return;
    }
    try {
      const data = await apiFetch<MeResponse>("/api/me");
      setMe(data);
    } catch (err) {
      console.warn("Failed to load /me", err);
      setMe(null);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    void (async () => {
      await refresh();
      setReady(true);
    })();
  }, [isLoaded, isSignedIn, refresh]);

  const currentMembership = me?.memberships[0] ?? null;

  // Default active employee = signed-in user
  useEffect(() => {
    if (!currentMembership || !me) {
      setActiveEmployeeState(null);
      return;
    }
    setActiveEmployeeState((prev) => {
      if (prev && prev.userId === me.userId) return prev;
      return {
        userId: me.userId,
        displayName: currentMembership.displayName,
        role: currentMembership.role,
        employeeRole: currentMembership.employeeRole ?? null,
      };
    });
  }, [me, currentMembership]);

  const value = useMemo<AuthCtxValue>(
    () => ({
      ready: ready && isLoaded,
      isSignedIn: !!isSignedIn,
      me,
      currentMembership,
      activeEmployee,
      setActiveEmployee: (e) => setActiveEmployeeState(e),
      refresh,
    }),
    [ready, isLoaded, isSignedIn, me, currentMembership, activeEmployee, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuthCtx(): AuthCtxValue {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuthCtx must be used inside AuthProvider");
  return v;
}

export function useAuthor(): { createdBy?: string; createdByName?: string } {
  const v = useContext(AuthCtx);
  const e = v?.activeEmployee;
  if (!e) return {};
  return { createdBy: e.userId, createdByName: e.displayName };
}
