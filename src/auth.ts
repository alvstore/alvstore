import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { backendServerUrl } from "@/lib/backend-url";

const API = backendServerUrl();

class AuthenticationUnavailable extends CredentialsSignin {
  code = "service_unavailable";
}

/**
 * Auth.js (NextAuth v5) with a credentials provider backed by our own
 * Express API (email + bcrypt password → backend-issued access token).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  /**
   * Embedded previews need Secure + SameSite=None AND partitioned (CHIPS)
   * cookies when third-party cookies are blocked. CSRF validation stays on.
   * Fresh host-only names avoid collisions with legacy unpartitioned cookies,
   * including on sign-out. Sessions are isolated by the top-level site.
   * Use HTTPS outside localhost (`npm run dev:https` for local TLS).
   */
  cookies: {
    sessionToken: {
      name: "__Host-alv.session-token",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true, partitioned: true },
    },
    csrfToken: {
      name: "__Host-alv.csrf-token",
      options: { httpOnly: true, sameSite: "none", path: "/", secure: true, partitioned: true },
    },
    callbackUrl: {
      name: "__Host-alv.callback-url",
      options: { httpOnly: false, sameSite: "none", path: "/", secure: true, partitioned: true },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        try {
          const res = await fetch(`${API}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
            signal: AbortSignal.timeout(10_000),
          });
          if (res.status === 400 || res.status === 401) return null;
          if (!res.ok) throw new AuthenticationUnavailable();
          const data = await res.json();
          if (!data.user?.id || !data.access_token) throw new AuthenticationUnavailable();
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name ?? data.user.email,
            roles: data.user.roles ?? [],
            accessToken: data.access_token,
            userMetadata: data.user.user_metadata ?? {},
          };
        } catch {
          // Network, database and provider failures are not bad passwords.
          throw new AuthenticationUnavailable();
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.roles = (user as any).roles ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.accessToken = (user as any).accessToken;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.userMetadata = (user as any).userMetadata ?? {};
      }
      if (trigger === "update" && session && typeof session === "object") {
        const nextMeta = (session as { user_metadata?: Record<string, unknown> }).user_metadata;
        if (nextMeta && typeof nextMeta === "object") {
          token.userMetadata = { ...((token.userMetadata as Record<string, unknown> | undefined) ?? {}), ...nextMeta };
          if (typeof nextMeta.full_name === "string" && nextMeta.full_name.trim()) {
            token.name = nextMeta.full_name.trim();
          }
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.email = (token.email as string) ?? "";
        session.user.name = token.name as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).roles = (token.roles as string[]) ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).user_metadata = token.userMetadata ?? {};
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (session as any).accessToken = token.accessToken as string;
      return session;
    },
  },
});
