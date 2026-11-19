import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 6's WASM schema engine reads pg_catalog `name`/`char` columns but its
 * pg adapter doesn't classify those built-in OIDs. Normalize their RESULT
 * metadata to text for schema tooling only; values are already parsed strings.
 * Application queries and all database types remain untouched.
 */
export function schemaAdapter(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  const query = pool.query.bind(pool);
  pool.query = ((...args: unknown[]) => {
    const result = (query as (...a: unknown[]) => Promise<pg.QueryResult>)(...args);
    return result.then(rows => {
      for (const response of Array.isArray(rows) ? rows : [rows]) {
        for (const field of response.fields ?? []) {
          if ([18, 19, 194].includes(field.dataTypeID)) field.dataTypeID = 25;
          if (field.dataTypeID === 1003) field.dataTypeID = 1009;
        }
      }
      return rows;
    });
  }) as typeof pool.query;
  pool.on("error", error => console.error("[schema] idle connection error:", error.message));
  return new PrismaPg(pool, { disposeExternalPool: true });
}
