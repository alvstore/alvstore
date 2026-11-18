/** JSON-safe serialization mirroring PostgREST output: Decimal/BigInt → number, Date → ISO string. */
export function toJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  // Prisma Decimal
  if (typeof value === "object" && value !== null && (value as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
    return Number(value);
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toJsonValue(v);
    return out;
  }
  return value;
}

export function toJsonRow<T>(row: T): T {
  return toJsonValue(row) as T;
}
