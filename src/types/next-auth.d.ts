import type { NextAuthConfig, Session } from "next-auth";

declare module "next-auth" {
  interface User {
    roles?: string[];
    accessToken?: string;
    userMetadata?: { full_name?: string; avatar_url?: string | null };
  }
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
      roles?: string[];
      user_metadata?: { full_name?: string; avatar_url?: string | null };
    } & Session["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: string[];
    accessToken?: string;
    userMetadata?: { full_name?: string; avatar_url?: string | null };
  }
}

export type { NextAuthConfig };
