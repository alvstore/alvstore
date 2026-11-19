/**
 * Translates PostgREST-style query payloads (produced by the frontend client
 * shim) into Prisma queries, using the generated schema metadata.
 */
import { prisma } from "../db.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import { parseSelect, type SelectNode } from "./selectParser.js";
import { toJsonValue } from "./serialize.js";
import metaJson from "../generated/schema-meta.json" with { type: "json" };

type SchemaMeta = {
  tables: Record<
    string,
    {
      model: string;
      columns: { name: string; udt: string; nullable: boolean; hasDefault: boolean }[];
      relations: {
        field: string;
        kind: "many-to-one" | "one-to-many";
        targetTable: string;
        targetModel: string;
        fkColumns: string[];
        optional: boolean;
      }[];
    }
  >;
};
const META = schemaMeta();

function schemaMeta(): SchemaMeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (metaJson as any) as SchemaMeta;
}

export class QueryError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "PGRST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// filters
// ---------------------------------------------------------------------------

export interface FilterOp {
  type: "op" | "not" | "or" | "match";
  col?: string;
  op?: string;
  val?: unknown;
  expr?: string;
  valObj?: Record<string, unknown>;
}

const NUMERIC_UDTS = new Set(["int2", "int4", "int8", "float4", "float8", "numeric"]);
const DATE_UDTS = new Set(["timestamptz", "timestamp", "date"]);

function columnMeta(table: string, col: string) {
  return META.tables[table]?.columns.find((c) => c.name === col);
}

function coerceValue(table: string, col: string, val: unknown): unknown {
  if (val === null || val === undefined) return null;
  const cm = columnMeta(table, col);
  if (typeof val === "string") {
    if (cm) {
      if (NUMERIC_UDTS.has(cm.udt) && val.trim() !== "" && !isNaN(Number(val))) return Number(val);
      if (cm.udt === "bool") return val === "true" ? true : val === "false" ? false : val;
      if (DATE_UDTS.has(cm.udt)) {
        const date = new Date(val);
        if (!Number.isFinite(date.getTime())) throw new QueryError(`Invalid date for '${col}'`);
        return date;
      }
      if ((cm.udt === "jsonb" || cm.udt === "json") && (val.startsWith("{") || val.startsWith("["))) {
        try { return JSON.parse(val); } catch { /* fall through */ }
      }
    }
    return val;
  }
  return val;
}

function parseInList(raw: string): unknown[] {
  let s = raw.trim();
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1);
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of s) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.length) parts.push(cur);
  return parts.map((p) => p.trim());
}

function singleCondition(table: string, col: string, op: string, val: unknown): Record<string, unknown> {
  const m = columnMeta(table, col);
  if (!m) throw new QueryError(`column '${col}' does not exist on '${table}'`);

  const coerceScalar = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    // field reference: unquoted identifier matching another column (PostgREST
    // would treat it as a literal; we implement the intended comparison)
    if (typeof v === "string" && /^[a-zA-Z_]\w*$/.test(v) && NUMERIC_UDTS.has(m.udt)) {
      const other = columnMeta(table, v);
      if (other && NUMERIC_UDTS.has(other.udt)) {
        return { __fieldRef: v };
      }
    }
    return coerceValue(table, col, v);
  };

  const fieldRef = (v: unknown): unknown => {
    if (v && typeof v === "object" && (v as Record<string, unknown>).__fieldRef) {
      const refCol = (v as Record<string, unknown>).__fieldRef as string;
      // Prisma field reference
      const model = META.tables[table].model;
      const delegate = (prisma as unknown as Record<string, unknown>)[
        model.charAt(0).toLowerCase() + model.slice(1)
      ] as { fields: Record<string, unknown> };
      return delegate.fields[refCol];
    }
    return v;
  };

  switch (op) {
    case "eq": {
      const v = coerceScalar(val);
      const ref = fieldRef(v);
      if (ref !== v) return { [col]: { equals: ref } };
      return { [col]: v };
    }
    case "neq": return { [col]: { not: coerceScalar(val) } };
    case "gt": return { [col]: { gt: fieldRef(coerceScalar(val)) ?? coerceScalar(val) } };
    case "gte": return { [col]: { gte: fieldRef(coerceScalar(val)) ?? coerceScalar(val) } };
    case "lt": return { [col]: { lt: fieldRef(coerceScalar(val)) ?? coerceScalar(val) } };
    case "lte": return { [col]: { lte: fieldRef(coerceScalar(val)) ?? coerceScalar(val) } };
    case "like":
    case "ilike": {
      let s = String(val ?? "").replace(/\*/g, "%");
      const insensitive = op === "ilike" ? { mode: "insensitive" as const } : {};
      const starts = s.startsWith("%");
      const ends = s.endsWith("%");
      s = s.replace(/^%+|%+$/g, "");
      if (starts && ends) return { [col]: { contains: s, ...insensitive } };
      if (starts) return { [col]: { endsWith: s, ...insensitive } };
      if (ends) return { [col]: { startsWith: s, ...insensitive } };
      return { [col]: { contains: s, ...insensitive } };
    }
    case "is": {
      const raw = String(val).toLowerCase();
      if (raw === "null" || raw === "unknown") return { [col]: null };
      if (raw === "true") return { [col]: true };
      if (raw === "false") return { [col]: false };
      throw new QueryError(`unsupported IS value '${val}'`);
    }
    case "in": {
      const list = Array.isArray(val) ? val : parseInList(String(val));
      return { [col]: { in: list.map((v) => coerceValue(table, col, v)) } };
    }
    case "contains":
    case "cs": {
      const list = Array.isArray(val) ? val : parseInList(String(val));
      return { [col]: { hasEvery: list.map((v) => coerceValue(table, col, v)) } };
    }
    case "overlaps":
    case "ov": {
      const list = Array.isArray(val) ? val : parseInList(String(val));
      return { [col]: { hasSome: list.map((v) => coerceValue(table, col, v)) } };
    }
    default:
      throw new QueryError(`unsupported filter operator '${op}'`);
  }
}

/** Parse a PostgREST logic string: "a.eq.1,b.eq.2" with and()/or() nesting. */
function parseLogicExpr(table: string, expr: string, topLevel: "or" | "and"): Record<string, unknown> {
  // split at top-level commas
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let inQ = false;
  for (const ch of expr) {
    if (ch === '"') inQ = !inQ;
    if (!inQ && (ch === "(" || ch === ".")) { /* keep dots */ }
    if (!inQ && ch === "(") depth++;
    if (!inQ && ch === ")") depth--;
    if (ch === "," && depth === 0 && !inQ) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const clauses = parts.map((p) => {
    p = p.trim();
    const orM = p.match(/^or\((.*)\)$/s);
    if (orM) return parseLogicExpr(table, orM[1], "or");
    const andM = p.match(/^and\((.*)\)$/s);
    if (andM) return parseLogicExpr(table, andM[1], "and");
    // a.eq.1 — col may itself contain dots for json paths; we take first two tokens
    const segs = p.split(".");
    if (segs.length < 3) throw new QueryError(`invalid logic expression part '${p}'`);
    const col = segs[0];
    const op = segs[1];
    const val = segs.slice(2).join(".");
    if (op === "not" && segs.length >= 4) {
      return { NOT: singleCondition(table, col, segs[2], segs.slice(3).join(".")) };
    }
    return singleCondition(table, col, op, val);
  });

  if (topLevel === "or") return { OR: clauses };
  return { AND: clauses };
}

export function buildWhere(table: string, filters: FilterOp[]): Record<string, unknown> {
  const ands: Record<string, unknown>[] = [];
  for (const f of filters ?? []) {
    if (f.type === "op" && f.col && f.op) {
      ands.push(singleCondition(table, f.col, f.op, f.val));
    } else if (f.type === "not" && f.col && f.op) {
      ands.push({ NOT: singleCondition(table, f.col, f.op, f.val) });
    } else if (f.type === "or" && f.expr) {
      ands.push(parseLogicExpr(table, f.expr, "or"));
    } else if (f.type === "match" && f.valObj) {
      for (const [k, v] of Object.entries(f.valObj)) ands.push(singleCondition(table, k, "eq", v));
    }
  }
  if (ands.length === 0) return {};
  if (ands.length === 1) return ands[0];
  return { AND: ands };
}

// ---------------------------------------------------------------------------
// select → include/select
// ---------------------------------------------------------------------------

interface BuiltSelect {
  mode: "include" | "select";
  args: Record<string, unknown>;
  // post-processors: rename prisma relation fields back to embed names
  renames: { from: string; to: string }[];
  countEmbeds: { from: string; to: string; many: boolean }[];
}

function findRelation(table: string, embed: string, hint?: string) {
  const rels = META.tables[table]?.relations ?? [];
  if (hint) {
    const byFk = rels.find((r) => r.fkColumns.includes(hint));
    if (byFk) return byFk;
  }
  const candidates = rels.filter((r) => r.targetTable === embed);
  if (candidates.length === 0) return undefined;
  return candidates.find((r) => r.kind === "many-to-one") ?? candidates[0];
}

function buildSelect(table: string, nodes: SelectNode[]): BuiltSelect {
  const hasStar = nodes.some((n) => n.kind === "all");
  const columns = nodes.filter((n): n is Extract<SelectNode, { kind: "column" }> => n.kind === "column");
  const embeds = nodes.filter((n): n is Extract<SelectNode, { kind: "embed" }> => n.kind === "embed");

  const args: Record<string, unknown> = {};
  const renames: BuiltSelect["renames"] = [];
  const countEmbeds: BuiltSelect["countEmbeds"] = [];

  if (!hasStar) {
    const validCols = new Set(META.tables[table].columns.map((c) => c.name));
    for (const c of columns) {
      if (validCols.has(c.name)) args[c.name] = true;
      // unknown "columns" (aliases/typos) are ignored, PostgREST would 400;
      // we stay permissive for resilience.
    }
    // Prisma select always needs at least one field when embeds exist — ok since embeds add keys.
  }

  for (const e of embeds) {
    if (e.aggregate === "count") continue; // handled below via _count on parent? skip: rare
    const rel = findRelation(table, e.name, e.hint);
    if (!rel) {
      throw new QueryError(`relation '${e.name}' not found for table '${table}'`);
    }
    const child = buildSelect(rel.targetTable, e.children);
    const childArgs: Record<string, unknown> = child.mode === "include" ? { include: child.args } : { select: child.args };
    args[rel.field] = childArgs;
    renames.push({ from: rel.field, to: e.alias ?? e.name });
    // propagate nested renames via closure on post-process (handled in shape())
    void child;
  }

  // count aggregates on embeds: `items(count)`
  for (const e of embeds) {
    if (e.aggregate !== "count") continue;
    // e.name is "count" with children — not valid; aggregate count appears as child of embed instead
    void e;
  }

  return { mode: hasStar ? "include" : "select", args, renames, countEmbeds };
}

/** Post-process prisma rows: rename relation fields to embed names recursively. */
function shapeRows(table: string, nodes: SelectNode[], rows: unknown): unknown {
  if (rows === null || rows === undefined) return rows;
  if (Array.isArray(rows)) return rows.map((r) => shapeRows(table, nodes, r));
  const row = rows as Record<string, unknown>;
  // Match PostgREST's date-only strings, not Prisma's midnight DateTimes.
  for (const column of META.tables[table].columns) {
    if (column.udt === "date" && row[column.name] instanceof Date) {
      row[column.name] = (row[column.name] as Date).toISOString().slice(0, 10);
    }
  }
  for (const n of nodes) {
    if (n.kind !== "embed") continue;
    if (n.aggregate === "count") continue;
    const rel = findRelation(table, n.name, n.hint);
    if (!rel) continue;
    const alias = n.alias ?? n.name;
    if (rel.field in row) {
      row[alias] = shapeRows(rel.targetTable, n.children, row[rel.field]);
      if (alias !== rel.field) delete row[rel.field];
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------

export interface DataQueryPayload {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  select?: string;
  filters?: FilterOp[];
  order?: { col: string; ascending?: boolean; nullsFirst?: boolean | null }[];
  limit?: number | null;
  offset?: number | null;
  count?: "exact" | "planned" | "estimated" | null;
  head?: boolean;
  single?: "single" | "maybeSingle" | null;
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

type QueryClient = PrismaClient | Prisma.TransactionClient;

function delegateFor(table: string, client: QueryClient) {
  const t = META.tables[table];
  if (!t) throw new QueryError(`unknown table '${table}'`, 404);
  const name = t.model.charAt(0).toLowerCase() + t.model.slice(1);
  const d = (client as unknown as Record<string, unknown>)[name];
  if (!d) throw new QueryError(`model for table '${table}' not available`, 500);
  return d as {
    findMany: (a?: unknown) => Promise<unknown[]>;
    findFirst: (a?: unknown) => Promise<unknown>;
    count: (a?: unknown) => Promise<number>;
    create: (a: unknown) => Promise<unknown>;
    createMany: (a: unknown) => Promise<{ count: number }>;
    updateMany: (a: unknown) => Promise<{ count: number }>;
    deleteMany: (a: unknown) => Promise<{ count: number }>;
    upsert: (a: unknown) => Promise<unknown>;
  };
}

function cleanValues(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const valid = new Set(META.tables[table].columns.map((c) => c.name));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!valid.has(k)) continue; // strip relation embeds & unknown keys
    out[k] = v === undefined ? undefined : coerceValue(table, k, v);
  }
  return out;
}

function buildOrderBy(table: string, order: DataQueryPayload["order"]) {
  const valid = new Set(META.tables[table].columns.map((c) => c.name));
  const out: Record<string, unknown>[] = [];
  for (const o of order ?? []) {
    if (!valid.has(o.col)) continue;
    const dir = o.ascending === false ? "desc" : "asc";
    if (o.nullsFirst === true) out.push({ [o.col]: { sort: dir, nulls: "first" } });
    else if (o.nullsFirst === false) out.push({ [o.col]: { sort: dir, nulls: "last" } });
    else out.push({ [o.col]: dir });
  }
  return out.length ? out : undefined;
}

function pickSelectArgs(built: BuiltSelect): Record<string, unknown> {
  return built.mode === "include" ? { include: built.args } : { select: built.args };
}

export async function executeDataQuery(payload: DataQueryPayload, actorId?: string): Promise<{ data: unknown; count: number | null }> {
  if (payload.op === "select") return executeWithClient(payload, prisma);
  // Transaction-local identity replaces Supabase auth.uid() for audit triggers.
  // It never leaks to the next pool borrower, and failed writes are not replayed.
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${actorId ?? ""}, true)`;
    return executeWithClient(payload, tx);
  });
}

async function executeWithClient(payload: DataQueryPayload, client: QueryClient): Promise<{ data: unknown; count: number | null }> {
  const { table, op } = payload;
  if (!META.tables[table]) throw new QueryError(`unknown table '${table}'`, 404);
  const d = delegateFor(table, client);
  const nodes = parseSelect(payload.select);
  const built = buildSelect(table, nodes);
  const where = buildWhere(table, payload.filters ?? []);
  const orderBy = buildOrderBy(table, payload.order);
  const take = payload.limit ?? undefined;
  const skip = payload.offset ?? undefined;

  const shape = (rows: unknown) => toJsonValue(shapeRows(table, nodes, rows));

  if (op === "select") {
    let count: number | null = null;
    if (payload.count === "exact") count = await d.count({ where });
    if (payload.head) return { data: null, count };
    const rows = await d.findMany({ where, orderBy, take, skip, ...pickSelectArgs(built) });
    return finishRows(rows, count, payload, shape);
  }

  if (op === "insert") {
    const inputRows = Array.isArray(payload.values) ? payload.values : [payload.values ?? {}];
    const cleaned = inputRows.map((r) => cleanValues(table, r));
    const wantsRows = !!payload.select;
    if (wantsRows) {
      const created: unknown[] = [];
      for (const data of cleaned) {
        created.push(await d.create({ data, ...pickSelectArgs(built) }));
      }
      return finishRows(created, null, payload, shape);
    }
    const res = await d.createMany({ data: cleaned, skipDuplicates: false });
    void res;
    return { data: null, count: null };
  }

  if (op === "update") {
    const values = cleanValues(table, (payload.values as Record<string, unknown>) ?? {});
    const wantsRows = !!payload.select;
    if (wantsRows) {
      const before = await d.findMany({ where, select: { id: true } });
      const ids = (before as { id: string }[]).map((r) => r.id);
      await d.updateMany({ where, data: values });
      const rows = ids.length
        ? await d.findMany({ where: { id: { in: ids } }, orderBy, ...pickSelectArgs(built) })
        : [];
      return finishRows(rows, null, payload, shape);
    }
    const res = await d.updateMany({ where, data: values });
    return { data: null, count: res.count };
  }

  if (op === "delete") {
    const wantsRows = !!payload.select;
    let rows: unknown[] = [];
    if (wantsRows) rows = await d.findMany({ where, ...pickSelectArgs(built) });
    await d.deleteMany({ where });
    if (wantsRows) return finishRows(rows, null, payload, shape);
    return { data: null, count: null };
  }

  if (op === "upsert") {
    const inputRows = Array.isArray(payload.values) ? payload.values : [payload.values ?? {}];
    const cleaned = inputRows.map((r) => cleanValues(table, r));
    const conflictCols = (payload.onConflict ?? "id").split(",").map((s) => s.trim());
    const wantsRows = !!payload.select;
    if (payload.ignoreDuplicates) {
      await d.createMany({ data: cleaned, skipDuplicates: true });
      return { data: null, count: null };
    }
    const results: unknown[] = [];
    for (const row of cleaned) {
      const hasKey = conflictCols.every((c) => row[c] !== undefined && row[c] !== null);
      if (hasKey) {
        const whereUnique =
          conflictCols.length === 1
            ? { [conflictCols[0]]: row[conflictCols[0]] }
            : Object.fromEntries(conflictCols.map((c) => [c, row[c]]));
        results.push(
          await d.upsert({
            where: whereUnique,
            create: row,
            update: row,
            ...(wantsRows ? pickSelectArgs(built) : {}),
          })
        );
      } else {
        results.push(await d.create({ data: row, ...(wantsRows ? pickSelectArgs(built) : {}) }));
      }
    }
    if (wantsRows) return finishRows(results, null, payload, shape);
    return { data: null, count: null };
  }

  throw new QueryError(`unsupported op '${op}'`);
}

function finishRows(
  rows: unknown[],
  count: number | null,
  payload: DataQueryPayload,
  shape: (r: unknown) => unknown
): { data: unknown; count: number | null } {
  if (payload.single === "single") {
    if (rows.length !== 1) {
      throw new QueryError(
        rows.length === 0
          ? "JSON object requested, no rows returned"
          : "JSON object requested, but multiple rows returned",
        406,
        "PGRST116"
      );
    }
    return { data: shape(rows[0]), count };
  }
  if (payload.single === "maybeSingle") {
    if (rows.length > 1) {
      throw new QueryError("JSON object requested, but multiple rows returned", 406, "PGRST116");
    }
    return { data: rows.length ? shape(rows[0]) : null, count };
  }
  return { data: shape(rows), count };
}
