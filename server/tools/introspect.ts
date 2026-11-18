/**
 * Introspects the bootstrapped PostgreSQL (PGlite) database and generates:
 *   - prisma/schema.prisma        (models for every public table)
 *   - src/generated/schema-meta.json (table/column/relation metadata used by
 *     the data router to translate PostgREST-style queries into Prisma)
 *
 * Usage: tsx tools/introspect.ts
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(serverRoot, ".pgdata");

const pascal = (s: string) =>
  s.replace(/(^|_)(\w)/g, (_m, _u, c: string) => c.toUpperCase());
const quoteIdent = (s: string) => (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s) ? s : `"${s}"`);

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  ordinal: number;
}
interface ConstraintRow {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  columns: string[];
}
interface FkRow {
  table_name: string;
  constraint_name: string;
  columns: string[];
  foreign_table_name: string;
  foreign_columns: string[];
  delete_rule: string;
}
interface EnumRow {
  enum_schema: string;
  enum_name: string;
  value: string;
}

function prismaScalar(udt: string): { type: string; attrs: string } {
  switch (udt) {
    case "text": case "varchar": case "bpchar": case "citext": case "name": case "char":
      return { type: "String", attrs: udt === "varchar" ? "" : udt === "bpchar" || udt === "char" ? " @db.Char" : "" };
    case "uuid": return { type: "String", attrs: " @db.Uuid" };
    case "bool": return { type: "Boolean", attrs: "" };
    case "int2": case "int4": return { type: "Int", attrs: udt === "int2" ? " @db.SmallInt" : "" };
    case "int8": return { type: "BigInt", attrs: "" };
    case "float4": case "float8": return { type: "Float", attrs: "" };
    case "numeric": return { type: "Decimal", attrs: " @db.Decimal" };
    case "json": return { type: "Json", attrs: " @db.Json" };
    case "jsonb": return { type: "Json", attrs: " @db.JsonB" };
    case "timestamptz": return { type: "DateTime", attrs: " @db.Timestamptz(6)" };
    case "timestamp": return { type: "DateTime", attrs: " @db.Timestamp(6)" };
    case "date": return { type: "DateTime", attrs: " @db.Date" };
    case "time": case "timetz": return { type: "String", attrs: "" };
    case "inet": case "cidr": case "macaddr": return { type: "String", attrs: "" };
    case "bytea": return { type: "Bytes", attrs: "" };
    default: return { type: `Unsupported("${udt}")`, attrs: "" };
  }
}

function prismaArrayScalar(elemUdt: string): { type: string; attrs: string } {
  const base = prismaScalar(elemUdt);
  if (base.type.startsWith("Unsupported")) return base;
  return { type: base.type + "[]", attrs: base.attrs };
}

async function main() {
  const db = new PGlite(dataDir);
  await db.waitReady;

  const tablesRes = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name != '_alv_migrations'
     ORDER BY table_name`
  );
  const tables = tablesRes.rows.map((r) => r.table_name);

  const cols = (
    await db.query<ColumnRow>(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable,
              column_default, ordinal_position AS ordinal
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    )
  ).rows;

  const constraints = (
    await db.query<ConstraintRow>(
      `SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
              array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
       GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type`
    )
  ).rows;

  const fks = (
    await db.query<FkRow>(
      `SELECT tc.table_name, tc.constraint_name,
              array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns,
              ccu.table_name AS foreign_table_name,
              array_agg(ccu.column_name ORDER BY kcu.ordinal_position) AS foreign_columns,
              rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
       GROUP BY tc.table_name, tc.constraint_name, ccu.table_name, rc.delete_rule`
    )
  ).rows;

  const enums = (
    await db.query<EnumRow>(
      `SELECT n.nspname AS enum_schema, t.typname AS enum_name, e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       ORDER BY t.typname, e.enumsortorder`
    )
  ).rows;

  const colsByTable = new Map<string, ColumnRow[]>();
  for (const c of cols) {
    if (!colsByTable.has(c.table_name)) colsByTable.set(c.table_name, []);
    colsByTable.get(c.table_name)!.push(c);
  }

  const enumMap = new Map<string, string[]>();
  for (const e of enums) {
    if (!enumMap.has(e.enum_name)) enumMap.set(e.enum_name, []);
    enumMap.get(e.enum_name)!.push(e.value);
  }

  // ---- relation naming ----
  const relationMeta: Record<
    string,
    { field: string; kind: "many-to-one" | "one-to-many"; targetTable: string; targetModel: string; fkColumns: string[]; optional: boolean }[]
  > = {};
  const m2oField = new Map<string, string>(); // key: srcTable|constraint → field name
  const o2mField = new Map<string, string>();
  {
    const usedPerTable = new Map<string, Set<string>>();
    const claim = (table: string, base: string) => {
      if (!usedPerTable.has(table)) usedPerTable.set(table, new Set([... (colsByTable.get(table) ?? []).map(c => c.column_name)]));
      const used = usedPerTable.get(table)!;
      let name = base;
      let i = 2;
      while (used.has(name)) name = `${base}_${i++}`;
      used.add(name);
      return name;
    };
    // group fks between same table pairs to detect ambiguity
    const pairCount = new Map<string, number>();
    for (const fk of fks) {
      const k = `${fk.table_name}->${fk.foreign_table_name}`;
      pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
    }
    for (const fk of fks) {
      const ambiguous = (pairCount.get(`${fk.table_name}->${fk.foreign_table_name}`) ?? 0) > 1;
      const m2oName = claim(
        fk.table_name,
        `r_${fk.foreign_table_name}${ambiguous ? "_" + fk.columns.join("_") : ""}`
      );
      m2oField.set(`${fk.table_name}|${fk.constraint_name}`, m2oName);
      const revAmbiguous =
        fks.filter((f) => f.foreign_table_name === fk.foreign_table_name && f.table_name === fk.table_name).length > 1 ||
        fks.filter((f) => f.foreign_table_name === fk.foreign_table_name && f.columns.join() === fk.columns.join() && f.table_name !== fk.table_name).length > 0;
      const o2mName = claim(
        fk.foreign_table_name,
        `rl_${fk.table_name}${revAmbiguous ? "_" + fk.columns.join("_") : ""}`
      );
      o2mField.set(`${fk.table_name}|${fk.constraint_name}`, o2mName);

      const srcCols = colsByTable.get(fk.table_name) ?? [];
      const optional = fk.columns.some(
        (cn) => srcCols.find((c) => c.column_name === cn)?.is_nullable === "YES"
      );
      (relationMeta[fk.table_name] ??= []).push({
        field: m2oName, kind: "many-to-one", targetTable: fk.foreign_table_name,
        targetModel: pascal(fk.foreign_table_name), fkColumns: fk.columns, optional,
      });
      (relationMeta[fk.foreign_table_name] ??= []).push({
        field: o2mName, kind: "one-to-many", targetTable: fk.table_name,
        targetModel: pascal(fk.table_name), fkColumns: fk.columns, optional: true,
      });
    }
  }

  // ---- emit schema.prisma ----
  const lines: string[] = [];
  lines.push(`// AUTO-GENERATED by tools/introspect.ts — do not edit by hand.`);
  lines.push(``);
  lines.push(`generator client {`);
  lines.push(`  provider        = "prisma-client-js"`);
  lines.push(`  engineType       = "client"`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`datasource db {`);
  lines.push(`  provider = "postgresql"`);
  lines.push(`  url      = env("DATABASE_URL")`);
  lines.push(`}`);
  lines.push(``);

  for (const [enumName, values] of [...enumMap.entries()].sort()) {
    lines.push(`enum ${quoteIdent(pascal(enumName))} {`);
    for (const v of values) lines.push(`  ${quoteIdent(v)}`);
    lines.push(`  @@map(${JSON.stringify(enumName)})`);
    lines.push(`}`);
    lines.push(``);
  }

  const modelFor = (t: string) => pascal(t);

  for (const table of tables) {
    const tableCols = colsByTable.get(table) ?? [];
    const pk = constraints.find((c) => c.table_name === table && c.constraint_type === "PRIMARY KEY");
    const uniques = constraints.filter((c) => c.table_name === table && c.constraint_type === "UNIQUE");
    const tableFks = fks.filter((f) => f.table_name === table);
    const backRefs = fks.filter((f) => f.foreign_table_name === table);

    lines.push(`model ${modelFor(table)} {`);
    const pkCols = new Set(pk?.columns ?? []);
    const singleUniqueCols = new Set(
      uniques.filter((u) => u.columns.length === 1).map((u) => u.columns[0])
    );
    for (const c of tableCols) {
      let field: string;
      if (enumMap.has(c.udt_name)) {
        field = `${c.column_name} ${pascal(c.udt_name)}${c.is_nullable === "YES" ? "?" : ""}`;
      } else if (c.data_type === "ARRAY") {
        const elem = prismaArrayScalar(c.udt_name.replace(/^_/, ""));
        field = `${c.column_name} ${elem.type}${elem.attrs}`;
      } else {
        const s = prismaScalar(c.udt_name);
        const nullable = c.is_nullable === "YES" && !pkCols.has(c.column_name) ? "?" : "";
        field = `${c.column_name} ${s.type}${nullable}${s.attrs}`;
      }
      if (pk && pk.columns.length === 1 && pk.columns[0] === c.column_name) field += " @id";
      if (singleUniqueCols.has(c.column_name)) field += " @unique";
      if (c.column_default != null) {
        const d = c.column_default;
        if (/^nextval\(/i.test(d)) field += " @default(autoincrement())";
        else if (/^now\(\)/i.test(d)) field += " @default(now())";
        else field += ` @default(dbgenerated(${JSON.stringify(d)}))`;
      }
      lines.push(`  ${field}`);
    }
    // relations
    for (const fk of tableFks) {
      const name = m2oField.get(`${fk.table_name}|${fk.constraint_name}`)!;
      const srcCols = colsByTable.get(fk.table_name) ?? [];
      const optional = fk.columns.some(
        (cn) => srcCols.find((c) => c.column_name === cn)?.is_nullable === "YES"
      );
      const onDelete =
        fk.delete_rule === "CASCADE" ? ", onDelete: Cascade" : fk.delete_rule === "SET NULL" ? ", onDelete: SetNull" : "";
      lines.push(
        `  ${name} ${modelFor(fk.foreign_table_name)}${optional ? "?" : ""} @relation(name: ${JSON.stringify(fk.constraint_name)}, fields: [${fk.columns.join(", ")}], references: [${fk.foreign_columns.join(", ")}]${onDelete})`
      );
    }
    for (const fk of backRefs) {
      const name = o2mField.get(`${fk.table_name}|${fk.constraint_name}`)!;
      lines.push(`  ${name} ${modelFor(fk.table_name)}[] @relation(name: ${JSON.stringify(fk.constraint_name)})`);
    }
    if (pk && pk.columns.length > 1) lines.push(`  @@id([${pk.columns.join(", ")}])`);
    for (const u of uniques.filter((u) => u.columns.length > 1))
      lines.push(`  @@unique([${u.columns.join(", ")}], map: ${JSON.stringify(u.constraint_name)})`);
    lines.push(`  @@map(${JSON.stringify(table)})`);
    lines.push(`}`);
    lines.push(``);
  }

  fs.mkdirSync(path.join(serverRoot, "prisma"), { recursive: true });
  fs.writeFileSync(path.join(serverRoot, "prisma", "schema.prisma"), lines.join("\n"));

  // ---- emit schema-meta.json ----
  const meta = {
    tables: Object.fromEntries(
      tables.map((t) => [
        t,
        {
          model: modelFor(t),
          columns: (colsByTable.get(t) ?? []).map((c) => ({
            name: c.column_name,
            udt: c.udt_name,
            nullable: c.is_nullable === "YES",
            hasDefault: c.column_default != null,
          })),
          relations: relationMeta[t] ?? [],
        },
      ])
    ),
  };
  fs.mkdirSync(path.join(serverRoot, "src", "generated"), { recursive: true });
  fs.writeFileSync(
    path.join(serverRoot, "src", "generated", "schema-meta.json"),
    JSON.stringify(meta, null, 2)
  );

  console.log(`[introspect] wrote schema.prisma with ${tables.length} models, ${enumMap.size} enums`);
  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
