/** Generate the query API's metadata FROM Prisma, never regenerate the schema from a database. */
import prismaInternals from "@prisma/internals";
const { getDMMF } = prismaInternals;
import fs from "node:fs";
import path from "node:path";
import { serverRoot } from "../src/env.js";

// The runtime client's reduced DMMF omits native types such as @db.Date/Uuid.
// Parse the source schema with Prisma's WASM parser; no live DB is consulted.
const { datamodel } = await getDMMF({ datamodel: fs.readFileSync(path.join(serverRoot, "prisma/schema.prisma"), "utf8") });
const models = datamodel.models.filter(m => !["AuthUser", "PasswordResetToken"].includes(m.name));
const enums = new Map(datamodel.enums.map(e => [e.name, e.dbName ?? e.name]));
const scalar: Record<string, string> = { String: "text", Int: "int4", BigInt: "int8", Float: "float8", Decimal: "numeric", Boolean: "bool", DateTime: "timestamp", Json: "jsonb", Bytes: "bytea" };
const native: Record<string, string> = { Uuid: "uuid", Timestamptz: "timestamptz", Timestamp: "timestamp", Date: "date", SmallInt: "int2", VarChar: "varchar", Char: "bpchar", Json: "json", JsonB: "jsonb" };
const meta = { tables: Object.fromEntries(models.map(model => [model.dbName ?? model.name, {
  model: model.name,
  columns: model.fields.filter(f => f.kind !== "object").map(f => ({
    name: f.dbName ?? f.name,
    udt: (f.isList ? "_" : "") + (enums.get(f.type) ?? (f.nativeType && native[f.nativeType[0]]) ?? scalar[f.type] ?? f.type.toLowerCase()),
    nullable: !f.isRequired,
    hasDefault: f.hasDefaultValue,
  })),
  relations: model.fields.filter(f => f.kind === "object" && models.some(m => m.name === f.type)).map(f => {
    const target = models.find(m => m.name === f.type)!;
    const reverse = target.fields.find(r => r.kind === "object" && r.relationName === f.relationName);
    return {
      field: f.name,
      kind: f.isList ? "one-to-many" : "many-to-one",
      targetTable: target.dbName ?? target.name,
      targetModel: target.name,
      fkColumns: f.isList ? reverse?.relationFromFields ?? [] : f.relationFromFields ?? [],
      optional: f.isList || !f.isRequired,
    };
  }),
}])) };
const output = path.join(serverRoot, "src/generated/schema-meta.json");
const content = JSON.stringify(meta, null, 2) + "\n";
// A no-op setup must not restart a running API's file watcher.
const unchanged = fs.existsSync(output) && fs.readFileSync(output, "utf8") === content;
if (!unchanged) fs.writeFileSync(output, content);
console.log(`[schema-meta] ${unchanged ? "unchanged" : "generated"} ${models.length} public tables from Prisma`);
