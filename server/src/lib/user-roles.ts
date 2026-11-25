export const VALID_APP_ROLES = new Set(["admin", "staff", "technician", "customer"] as const);
export type ValidAppRole = "admin" | "staff" | "technician" | "customer";

export interface QueryRunner {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

export function isValidAppRole(role: unknown): role is ValidAppRole {
  return typeof role === "string" && VALID_APP_ROLES.has(role as ValidAppRole);
}

/**
 * Atomically converge a user's user_roles entries to a single authoritative role
 * without colliding with UNIQUE(user_id, role) or leaving an active user role-less.
 */
export async function replaceUserRole(db: QueryRunner, userId: string, role: string): Promise<void> {
  if (!userId) throw new Error("user_id is required");
  if (!isValidAppRole(role)) throw new Error(`Invalid role: ${String(role)}`);

  await db.query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1::uuid, $2::public.app_role)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId, role]
  );
  await db.query(
    `DELETE FROM public.user_roles
     WHERE user_id = $1::uuid AND role <> $2::public.app_role`,
    [userId, role]
  );
}
