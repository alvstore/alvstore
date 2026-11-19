import "dotenv/config";
import { defineConfig } from "prisma/config";
import { schemaAdapter } from "./tools/schema-adapter";

// Use the bundled WASM schema engine and the same pg driver as the API.
// `prisma db push` works without downloading native engine binaries.
export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () => schemaAdapter(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/postgres"),
  migrations: { seed: "tsx tools/seed.ts" },
});
