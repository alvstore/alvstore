import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma, pool } from "../db.js";
import { signAccessToken } from "./jwt.js";
import { requireAuth, requireRole } from "./middleware.js";

export const authRouter = Router();

async function rolesOf(userId: string): Promise<string[]> {
  const rows = await prisma.userRoles.findMany({ where: { user_id: userId }, select: { role: true } });
  return rows.map((r) => r.role);
}

async function profileOf(userId: string) {
  return prisma.profiles.findUnique({ where: { user_id: userId } });
}

function publicUser(u: { id: string; email: string | null; created_at?: Date }, roles: string[], profile: unknown) {
  const p = profile as { full_name?: string | null; avatar_url?: string | null } | null;
  return {
    id: u.id,
    email: u.email,
    created_at: u.created_at?.toISOString?.() ?? u.created_at,
    user_metadata: { full_name: p?.full_name ?? "", avatar_url: p?.avatar_url ?? null },
    roles,
  };
}

// POST /api/auth/signup
authRouter.post("/signup", async (req, res) => {
  const { email, password, full_name } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: { message: "email and password are required" } });
    return;
  }
  const existing = await pool.query("SELECT id FROM auth.users WHERE lower(email) = lower($1)", [email]);
  if (existing.rows.length) {
    res.status(400).json({ error: { message: "User already registered" } });
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  const inserted = await pool.query(
    `INSERT INTO auth.users (email, password_hash, raw_user_meta_data)
     VALUES ($1, $2, $3) RETURNING id, email, created_at`,
    [email, hash, JSON.stringify({ full_name: full_name ?? "" })]
  );
  // trigger handle_new_user() creates profile + default admin role
  const user = inserted.rows[0];
  if (full_name) {
    await prisma.profiles.updateMany({ where: { user_id: user.id }, data: { full_name } });
  }
  const roles = await rolesOf(user.id);
  const profile = await profileOf(user.id);
  const token = signAccessToken({ sub: user.id, email: user.email });
  res.json({ user: publicUser(user, roles, profile), access_token: token });
});

// POST /api/auth/login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ error: { message: "email and password are required" } });
    return;
  }
  const result = await pool.query(
    "SELECT id, email, password_hash, created_at FROM auth.users WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );
  const user = result.rows[0];
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(400).json({ error: { message: "Invalid login credentials" } });
    return;
  }
  const roles = await rolesOf(user.id);
  const profile = await profileOf(user.id);
  const token = signAccessToken({ sub: user.id, email: user.email });
  res.json({ user: publicUser(user, roles, profile), access_token: token });
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, async (req, res) => {
  const profile = await profileOf(req.user!.id);
  res.json({ user: publicUser({ id: req.user!.id, email: req.user!.email }, req.user!.roles, profile) });
});

// POST /api/auth/logout — stateless JWT, nothing to revoke server-side (hook for future)
authRouter.post("/logout", (_req, res) => res.json({ success: true }));

// POST /api/auth/update-password  (authenticated; mirrors supabase.auth.updateUser)
authRouter.post("/update-password", requireAuth, async (req, res) => {
  const { password } = req.body ?? {};
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: { message: "Password must be at least 6 characters" } });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query("UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, req.user!.id]);
  res.json({ user: { id: req.user!.id, email: req.user!.email } });
});

// POST /api/auth/forgot-password — issues a reset token. Without SMTP configured
// the reset link is logged to the server console (dev mode).
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: { message: "email is required" } });
    return;
  }
  const result = await pool.query("SELECT id FROM auth.users WHERE lower(email) = lower($1)", [email]);
  // Always succeed to avoid leaking which emails exist
  if (!result.rows.length) {
    res.json({ success: true });
    return;
  }
  const userId = result.rows[0].id;
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query(
    "INSERT INTO auth.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
    [userId, tokenHash]
  );
  const link = `${req.headers.origin ?? ""}/reset-password?token=${token}`;
  console.log(`[auth] password reset link for ${email}: ${link}`);
  res.json({ success: true, dev_reset_link: link });
});

// POST /api/auth/reset-password
authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password || String(password).length < 6) {
    res.status(400).json({ error: { message: "token and a password of at least 6 characters are required" } });
    return;
  }
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  const found = await pool.query(
    `SELECT id, user_id FROM auth.password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1`,
    [tokenHash]
  );
  if (!found.rows.length) {
    res.status(400).json({ error: { message: "Invalid or expired reset link" } });
    return;
  }
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query("UPDATE auth.users SET password_hash = $1, updated_at = now() WHERE id = $2", [hash, found.rows[0].user_id]);
  await pool.query("UPDATE auth.password_reset_tokens SET used_at = now() WHERE id = $1", [found.rows[0].id]);
  res.json({ success: true });
});

// GET /api/auth/users — list users with roles (admin)
authRouter.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await pool.query("SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC");
  res.json({ users: users.rows });
});

