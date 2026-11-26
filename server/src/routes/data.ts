import { isDatabaseUnavailable } from "../lib/api-errors.js";
import { asyncHandler } from "../lib/async-handler.js";
import { Router } from "express";
import { executeDataQuery, QueryError, type DataQueryPayload } from "../lib/queryEngine.js";
import metaJson from "../generated/schema-meta.json" with { type: "json" };

export const dataRouter = Router();

/**
 * Anonymous access rules (replace the "TO anon" / public-token RLS policies).
 * Authenticated users (any role) can access every table, mirroring the
 * previous authenticated policies; anonymous requests are limited to the
 * tables below, which the public share pages (invoice/quotation/job-sheet
 * tokens) rely on.
 */
const PUBLIC_READ = new Set([
  "quotations",
  "quotation_items",
  "invoices",
  "invoice_items",
  "job_sheets",
  "job_sheet_images",
  "job_sheet_audit_log",
  "repair_parts",
  "customers",
  "business_settings",
  "payments",
  "templates",
  "delivery_challans",
  "delivery_challan_items",
]);
const PUBLIC_WRITE = new Set([
  // signature capture / view tracking / delivery confirmation
  "quotations",
  "job_sheets",
  "job_sheet_audit_log",
]);

/**
 * Write access by role for sensitive tables (replaces the RLS write policies).
 * Any table not listed here is writable by every authenticated user; tables
 * listed here require one of the given roles.
 */
const WRITE_ROLES: Record<string, string[]> = {
  user_roles: ["admin"],
  employees: ["admin"],
  payroll: ["admin"],
  finance_audit_log: ["admin"],
  system_audit_log: ["admin"],
  business_settings: ["admin"],
  templates: ["admin", "staff"],
  hikvision_devices: ["admin"],
  hikvision_employee_mapping: ["admin"],
  hikvision_sync_log: ["admin"],
  hikvision_attendance_logs: ["admin"],
  device_brands: ["admin", "staff"],
  device_types: ["admin", "staff"],
  device_models: ["admin", "staff"],
  apple_products: ["admin", "staff"],
  apple_offers: ["admin", "staff"],
  apple_pricing_rules: ["admin", "staff"],
  service_charge_categories: ["admin", "staff"],
};

const tables = Object.keys((metaJson as { tables: Record<string, unknown> }).tables);

dataRouter.get("/tables", (_req, res) => {
  res.json({ tables });
});

// Single generic endpoint consumed by the frontend client shim.
dataRouter.post("/query", asyncHandler(async (req, res) => {
  const payload = req.body as DataQueryPayload;
  if (!payload || typeof payload.table !== "string" || typeof payload.op !== "string") {
    res.status(400).json({ error: { message: "table and op are required" } });
    return;
  }

  if (!req.user) {
    const isPublic =
      (payload.op === "select" && PUBLIC_READ.has(payload.table)) ||
      (PUBLIC_WRITE.has(payload.table) && ["insert", "update"].includes(payload.op));
    if (!isPublic) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }
  } else if (payload.op !== "select") {
    const allowed = WRITE_ROLES[payload.table];
    if (allowed && !allowed.some((r) => req.user!.roles.includes(r))) {
      res.status(403).json({ error: { message: `Insufficient role: writing to ${payload.table} requires ${allowed.join(" or ")}` } });
      return;
    }
  }

  try {
    const result = await executeDataQuery(payload, req.user?.id);
    const isAdmin = Boolean(req.user?.roles.includes("admin"));
    if (payload.table === "business_settings" && !isAdmin && result.data) {
      const sanitizeRow = (row: unknown) => {
        if (row && typeof row === "object" && "integrations" in row) {
          const { integrations: _hidden, ...rest } = row as Record<string, unknown>;
          return rest;
        }
        return row;
      };
      result.data = Array.isArray(result.data) ? result.data.map(sanitizeRow) : sanitizeRow(result.data);
    }
    res.json({ data: result.data, count: result.count });
  } catch (err) {
    if (isDatabaseUnavailable(err)) throw err;
    if (err instanceof QueryError) {
      res.status(err.status).json({ error: { message: err.message, code: err.code } });
      return;
    }
    const e = err as Error & { code?: string };
    // Prisma errors: P2025 record not found, P2002 unique violation, etc.
    const status = e.code === "P2002" ? 409 : 400;
    res.status(status).json({ error: { message: e.message, code: e.code } });
  }
}));
