import { Prisma } from "@prisma/client";

/** JSON-safe output mirroring PostgREST: Decimal/BigInt → number, Date → ISO. */
export function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  // Constructor names are minified in Prisma's generated runtime. Use the
  // library's type guard, not constructor.name, before traversing objects.
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) out[key] = toJsonValue(item);
    return out;
  }
  return value;
}

export function toJsonRow<T>(row: T): T { return toJsonValue(row) as T; }
