"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { __setBackendSession } from "@/integrations/supabase/client";

type AppRole = "admin" | "staff" | "technician" | "customer";

interface SessionUser {
  id: string;
  email: string;
  aud: string;
  role: string;
  user_metadata: Record<string, unknown>;
}

interface SessionLike {
  access_token: string;
  user: SessionUser;
}

interface AuthContextType {
  session: SessionLike | null;
  user: SessionUser | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: nextSession, status } = useSession();
  const loading = status === "loading";

  // keep the backend client's token in sync (also covers first paint)
  __setBackendSession(nextSession);

  const roles = ((nextSession?.user as { roles?: string[] } | undefined)?.roles ?? []) as AppRole[];

  let session: SessionLike | null = null;
  if (nextSession?.user?.id) {
    const u = nextSession.user as { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
    session = {
      access_token: (nextSession as { accessToken?: string }).accessToken ?? "",
      user: {
        id: u.id,
        email: u.email ?? "",
        aud: "authenticated",
        role: "authenticated",
        user_metadata: u.user_metadata ?? {},
      },
    };
  }

  const signOut = async () => {
    __setBackendSession(null);
    await nextAuthSignOut({ redirect: false });
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, roles, loading, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
