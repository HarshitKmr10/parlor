"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User, Workspace } from "@/lib/api/types";

type AuthContextValue = {
  user: User;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  isSwitching: boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type Props = {
  user: User;
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  children: React.ReactNode;
};

export function AuthProvider({
  user,
  workspaces,
  currentWorkspace,
  children,
}: Props) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);

  const value = useMemo<AuthContextValue>(() => {
    const switchWorkspace = async (workspaceId: string) => {
      if (workspaceId === currentWorkspace.id) return;
      setIsSwitching(true);
      try {
        await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        router.refresh();
      } finally {
        setIsSwitching(false);
      }
    };

    const logout = async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    };

    return {
      user,
      workspaces,
      currentWorkspace,
      isSwitching,
      switchWorkspace,
      logout,
    };
  }, [user, workspaces, currentWorkspace, isSwitching, router]);

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
