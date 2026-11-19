import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt.js";
import { prisma } from "../db.js";

export interface AuthedUser {
  id: string;
  email: string;
  roles: string[];
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

async function loadUser(userId: string, email: string): Promise<AuthedUser | null> {
  const rows = await prisma.$queryRaw<{ id: string; email: string }[]>`
    SELECT id, email FROM auth.users WHERE id = ${userId}::uuid LIMIT 1`;
  if (!rows.length) return null;
  const roles = await prisma.userRoles.findMany({
    where: { user_id: userId },
    select: { role: true },
  });
  return { id: rows[0].id, email: rows[0].email ?? email, roles: roles.map((r: { role: string }) => r.role) };
}

/** Populates req.user when a valid Bearer token is present; DB failures are forwarded. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const payload = verifyAccessToken(header.slice(7));
    if (payload) {
      req.user = (await loadUser(payload.sub, payload.email)) ?? undefined;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: { message: "Unauthorized", code: "AUTH_REQUIRED" } });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }
    if (!roles.some((r) => req.user!.roles.includes(r))) {
      res.status(403).json({ error: { message: "Insufficient role" } });
      return;
    }
    next();
  };
}
