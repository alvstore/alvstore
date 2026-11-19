import type { ErrorRequestHandler } from "express";

const CONNECTION_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "EPIPE", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH",
  "08000", "08001", "08003", "08004", "08006", "08007", "08P01",
  "53300", "57P01", "57P02", "57P03", "P1001", "P1002", "P1008", "P1017", "P2024", "P2037",
]);

/** pg, Prisma and driver adapters may nest the original connection error. */
export function isDatabaseUnavailable(error: unknown, seen = new Set<unknown>()): boolean {
  if (!error || typeof error !== "object" || seen.has(error)) return false;
  seen.add(error);
  const e = error as {
    code?: string; originalCode?: string; kind?: string; message?: string;
    cause?: unknown; originalError?: unknown; errors?: unknown[];
    meta?: { code?: string; driverAdapterError?: unknown };
  };
  return [e.code, e.originalCode, e.meta?.code].some(code => CONNECTION_CODES.has(code ?? "")) ||
    ["DatabaseNotReachable", "ConnectionClosed", "SocketTimeout", "PoolTimeout", "TlsConnectionError"].includes(e.kind ?? "") ||
    /connection (?:terminated|closed|ended|refused)|timeout (?:exceeded when trying to connect|expired)|timed out fetching a new connection|database (?:system is|is) (?:starting|shutting)/i.test(e.message ?? "") ||
    [e.cause, e.originalError, e.meta?.driverAdapterError, ...(Array.isArray(e.errors) ? e.errors : [])].some(nested => isDatabaseUnavailable(nested, seen));
}

export const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  console.error("[api] request failed:", error);
  if (isDatabaseUnavailable(error)) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: { code: "DB_UNAVAILABLE", message: "Database temporarily unavailable. Please try again shortly." } });
    return;
  }
  const status = typeof error.status === "number" && error.status >= 400 && error.status < 500 ? error.status : 500;
  res.status(status).json({ error: { message: status === 500 ? "Internal server error" : error.message } });
};
