import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API = process.env.API_SERVER_URL ?? "http://127.0.0.1:4000";

/**
 * Auth.js (NextAuth v5) with a credentials provider backed by our own
 * Express API (email + bcrypt password → backend-issued access token).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  /**
   * The app runs behind a TLS-terminating preview proxy (https://*.e2b.app →
   * http://localhost:3000). Auth.js auto-enables `__Host-`/`__Secure-` Secure
   * cookies when it detects HTTPS (via X-Forwarded-Proto), but those Secure,
   * prefix-locked cookies do not reliably round-trip through the proxy, which
   * breaks the credentials sign-in with `MissingCSRF`. Forcing stable, plain,
   * non-Secure cookie names keeps the CSRF + session cookies identical over
   * both HTTP and HTTPS, so login works locally and through the preview proxy.
   */
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: { httpOnly: false, sameSite: "lax", path: "/", secure: false },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        try {
          const res = await fetch(`${API}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name ?? data.user.email,
            roles: data.user.roles ?? [],
            accessToken: data.access_token,
            userMetadata: data.user.user_metadata ?? {},
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
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
