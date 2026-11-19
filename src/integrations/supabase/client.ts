"use client";

/**
 * Backend client — drop-in replacement for the Supabase JS client.
 *
 * Same surface (`from().select()...`, `auth.*`, `storage.*`,
 * `functions.invoke`, `channel`), but every operation goes to our own
 * Express API (`/api/backend/*` → server/) which talks to PostgreSQL via
 * Prisma. Auth sessions are managed by Auth.js; this client picks up the
 * backend access token exposed on the session.
 */
import { getSession, signIn, signOut } from "next-auth/react";
import { signInFailure } from "@/lib/auth-errors";
import type { Database } from "./types";

export type { Database };

// ---------------------------------------------------------------------------
// access-token bridge (set by <AuthTokenSync/> on session changes)
// ---------------------------------------------------------------------------
let currentToken: string | null = null;
let currentSession: SessionLike | null = null;
type AuthListener = (event: string, session: SessionLike | null) => void;
const authListeners = new Set<AuthListener>();

interface UserLike {
  id: string;
  email?: string;
  aud?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
interface SessionLike {
  access_token: string;
  user: UserLike;
}

export function __setBackendSession(nextAuthSession: unknown): void {
  const s = nextAuthSession as
    | { accessToken?: string; user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } }
    | null;
  const prevToken = currentToken;
  if (s?.accessToken && s.user?.id) {
    currentToken = s.accessToken;
    currentSession = {
      access_token: s.accessToken,
      user: {
        id: s.user.id,
        email: s.user.email ?? undefined,
        aud: "authenticated",
        role: "authenticated",
        user_metadata: s.user.user_metadata ?? {},
      },
    };
  } else {
    currentToken = null;
    currentSession = null;
  }
  if (prevToken !== currentToken) {
    const event = currentToken ? (prevToken ? "TOKEN_REFRESHED" : "SIGNED_IN") : "SIGNED_OUT";
    authListeners.forEach((cb) => {
      try {
        cb(event, currentSession);
      } catch {
        /* listener errors are isolated */
      }
    });
  }
}

function authHeaders(): Record<string, string> {
  return currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
}

// ---------------------------------------------------------------------------
// query builder
// ---------------------------------------------------------------------------
interface ApiError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}
interface ApiResponse<T = any> {
  data: T | null;
  error: ApiError | null;
  count: number | null;
}

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "contains" | "containedBy" | "overlaps";

interface BuilderState {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string;
  filters: { type: string; col?: string; op?: string; val?: unknown; expr?: string; valObj?: Record<string, unknown> }[];
  order: { col: string; ascending?: boolean; nullsFirst?: boolean | null }[];
  limit: number | null;
  offset: number | null;
  count?: "exact" | "planned" | "estimated" | null;
  head?: boolean;
  single?: "single" | "maybeSingle" | null;
  values?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

const FILTER_METHODS = new Set([
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "containedBy", "overlaps",
]);

class QueryBuilder<T = any> implements PromiseLike<ApiResponse<T>> {
  private state: BuilderState;

  constructor(table: string, op: BuilderState["op"] = "select", values?: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: BuilderState["count"]; }) {
    this.state = {
      table,
      op,
      values,
      filters: [],
      order: [],
      limit: null,
      offset: null,
      single: null,
      onConflict: opts?.onConflict,
      ignoreDuplicates: opts?.ignoreDuplicates,
      count: opts?.count ?? null,
    };
  }

  select(columns = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }): this {
    this.state.select = columns;
    if (opts?.count) this.state.count = opts.count;
    if (opts?.head) this.state.head = true;
    return this;
  }

  private addFilter(type: string, col: string, op: string, val: unknown): this {
    this.state.filters.push({ type, col, op, val });
    return this;
  }

  filter(col: string, op: string, val: unknown): this {
    return this.addFilter("op", col, op, val);
  }
  eq(col: string, val: unknown): this { return this.addFilter("op", col, "eq", val); }
  neq(col: string, val: unknown): this { return this.addFilter("op", col, "neq", val); }
  gt(col: string, val: unknown): this { return this.addFilter("op", col, "gt", val); }
  gte(col: string, val: unknown): this { return this.addFilter("op", col, "gte", val); }
  lt(col: string, val: unknown): this { return this.addFilter("op", col, "lt", val); }
  lte(col: string, val: unknown): this { return this.addFilter("op", col, "lte", val); }
  like(col: string, val: unknown): this { return this.addFilter("op", col, "like", val); }
  ilike(col: string, val: unknown): this { return this.addFilter("op", col, "ilike", val); }
  is(col: string, val: unknown): this { return this.addFilter("op", col, "is", val); }
  in(col: string, val: unknown[]): this { return this.addFilter("op", col, "in", val); }
  contains(col: string, val: unknown): this { return this.addFilter("op", col, "contains", val); }
  containedBy(col: string, val: unknown): this { return this.addFilter("op", col, "containedBy", val); }
  overlaps(col: string, val: unknown): this { return this.addFilter("op", col, "overlaps", val); }

  not(col: string, op: string, val: unknown): this {
    this.state.filters.push({ type: "not", col, op, val });
    return this;
  }

  or(expr: string): this {
    this.state.filters.push({ type: "or", expr });
    return this;
  }

  match(obj: Record<string, unknown>): this {
    this.state.filters.push({ type: "match", valObj: obj });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }): this {
    this.state.order.push({ col, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst ?? null });
    return this;
  }

  limit(n: number): this {
    this.state.limit = n;
    return this;
  }

  range(from: number, to: number): this {
    this.state.offset = from;
    this.state.limit = to - from + 1;
    return this;
  }

  single(): this {
    this.state.single = "single";
    return this;
  }

  maybeSingle(): this {
    this.state.single = "maybeSingle";
    return this;
  }

  // Mutations — available after select() too since supabase allows any order.
  insert(values: unknown, opts?: { count?: BuilderState["count"] }): this {
    this.state.op = "insert";
    this.state.values = values;
    if (opts?.count) this.state.count = opts.count;
    return this;
  }
  update(values: unknown): this {
    this.state.op = "update";
    this.state.values = values;
    return this;
  }
  upsert(values: unknown, opts?: { onConflict?: string; ignoreDuplicates?: boolean; count?: BuilderState["count"] }): this {
    this.state.op = "upsert";
    this.state.values = values;
    this.state.onConflict = opts?.onConflict ?? this.state.onConflict;
    this.state.ignoreDuplicates = opts?.ignoreDuplicates ?? false;
    if (opts?.count) this.state.count = opts.count;
    return this;
  }
  delete(): this {
    this.state.op = "delete";
    return this;
  }

  then<TResult1 = ApiResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<ApiResponse<T>> {
    const s = this.state;
    try {
      const res = await fetch("/api/backend/data/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          table: s.table,
          op: s.op,
          select: s.select,
          filters: s.filters,
          order: s.order,
          limit: s.limit,
          offset: s.offset,
          count: s.count,
          head: s.head,
          single: s.single,
          values: s.values,
          onConflict: s.onConflict,
          ignoreDuplicates: s.ignoreDuplicates,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: unknown; count?: number | null; error?: ApiError };
      if (!res.ok) {
        return { data: null, error: body.error ?? { message: `Request failed (${res.status})` }, count: null };
      }
      return { data: (body.data ?? null) as T, error: null, count: body.count ?? null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message ?? "Network error" }, count: null };
    }
  }
}

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------
class StorageBucket {
  constructor(private bucket: string) {}

  async upload(path: string, file: File | Blob, opts?: { upsert?: boolean; contentType?: string }) {
    const form = new FormData();
    form.set("path", path);
    if (opts?.upsert !== undefined) form.set("upsert", String(opts.upsert));
    form.set("file", file);
    try {
      const res = await fetch(`/api/backend/storage/${encodeURIComponent(this.bucket)}/upload`, {
        method: "POST",
        headers: { ...authHeaders() },
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: body.error ?? { message: `Upload failed (${res.status})` } };
      return { data: { path }, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  }

  getPublicUrl(path: string) {
    const publicUrl = `/api/backend/storage/files/${encodeURIComponent(this.bucket)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    return { data: { publicUrl } };
  }

  async remove(paths: string[]) {
    const results = await Promise.all(
      paths.map((p) =>
        fetch(`/api/backend/storage/${encodeURIComponent(this.bucket)}/${p.split("/").map(encodeURIComponent).join("/")}`, {
          method: "DELETE",
          headers: { ...authHeaders() },
        })
      )
    );
    const failed = results.find((r) => !r.ok);
    return failed ? { data: null, error: { message: "Remove failed" } } : { data: { removed: paths }, error: null };
  }
}

// ---------------------------------------------------------------------------
// realtime channels — no-op shim (pages poll / refetch on focus instead)
// ---------------------------------------------------------------------------
class ChannelShim {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  on(..._args: unknown[]): this {
    return this;
  }
  subscribe(callback?: (status: string) => void) {
    if (callback) setTimeout(() => callback("SUBSCRIBED"), 0);
    return this;
  }
  unsubscribe() {
    return Promise.resolve("ok" as const);
  }
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------
function shapeSession(nextAuthSession: unknown): SessionLike | null {
  const s = nextAuthSession as
    | { accessToken?: string; user?: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } }
    | null;
  if (!s?.user?.id) return null;
  return {
    access_token: s.accessToken ?? "",
    user: {
      id: s.user.id,
      email: s.user.email ?? undefined,
      aud: "authenticated",
      role: "authenticated",
      user_metadata: s.user.user_metadata ?? {},
    },
  };
}

async function passwordSignIn({ email, password }: { email: string; password: string }): Promise<{
  data: { user: UserLike | null; session: SessionLike | null }; error: ApiError | null;
}> {
  const empty = { user: null, session: null };
  try {
    const res = await signIn("credentials", { email: email.trim(), password, redirect: false, redirectTo: "/dashboard" });
    if (!res || res.error || !res.ok) return { data: empty, error: signInFailure(res?.error, res?.code) };
    const session = await getSession();
    const shaped = shapeSession(session);
    if (!shaped?.access_token) return { data: empty, error: signInFailure("SessionUnavailable") };
    __setBackendSession(session);
    return { data: { user: shaped.user, session: shaped }, error: null };
  } catch {
    return { data: empty, error: signInFailure() };
  }
}

const authApi = {
  signInWithPassword: passwordSignIn,

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string }; emailRedirectTo?: string } }) {
    try {
      const res = await fetch("/api/backend/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: options?.data?.full_name ?? "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { data: { user: null, session: null }, error: body.error ?? { message: "Signup failed" } };
      // Creating an account is not the same as retaining its browser session.
      const signedIn = await passwordSignIn({ email, password });
      if (signedIn.error) return {
        data: { user: body.user ?? null, session: null },
        error: { ...signedIn.error, message: `Account created, but automatic sign-in failed. ${signedIn.error.message}` },
      };
      return signedIn;
    } catch (e) {
      return { data: { user: null, session: null }, error: { message: (e as Error).message } };
    }
  },

  async signOut() {
    __setBackendSession(null);
    await signOut({ redirect: false });
    return { error: null };
  },

  async getSession() {
    const session = await getSession();
    __setBackendSession(session);
    return { data: { session: shapeSession(session) }, error: null };
  },

  async getUser() {
    const session = await getSession();
    const shaped = shapeSession(session);
    return { data: { user: shaped?.user ?? null }, error: null };
  },

  onAuthStateChange(callback: AuthListener) {
    authListeners.add(callback);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },

  async resetPasswordForEmail(email: string, _opts?: { redirectTo?: string }) {
    try {
      const res = await fetch("/api/backend/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { data: null, error: body.error ?? { message: "Failed to send reset email" } };
      }
      const body = await res.json().catch(() => ({}));
      return { data: body, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },

  async updateUser({ password }: { password?: string }) {
    try {
      const res = await fetch("/api/backend/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { data: { user: null }, error: body.error ?? { message: "Failed to update password" } };
      return { data: { user: body.user }, error: null };
    } catch (e) {
      return { data: { user: null }, error: { message: (e as Error).message } };
    }
  },
};

// ---------------------------------------------------------------------------
// edge functions
// ---------------------------------------------------------------------------
const functionsApi = {
  async invoke(name: string, opts?: { body?: unknown; headers?: Record<string, string> }) {
    try {
      const res = await fetch(`/api/backend/functions/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts?.headers ?? {}) },
        body: JSON.stringify(opts?.body ?? {}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: body && Object.keys(body).length ? body : null, error: { message: body.error ?? body.message ?? `Function failed (${res.status})` } };
      }
      return { data: body, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
};

// ---------------------------------------------------------------------------
// assembled client
// ---------------------------------------------------------------------------
export const supabase = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
  auth: authApi,
  storage: {
    from(bucket: string) {
      return new StorageBucket(bucket);
    },
  },
  functions: functionsApi,
  channel(_name: string) {
    return new ChannelShim();
  },
  removeChannel(_channel: unknown) {
    return Promise.resolve("ok" as const);
  },
};

export default supabase;
