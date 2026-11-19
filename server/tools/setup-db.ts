/** Create/update the configured database from Prisma, then seed. Never reset data. */
import { spawn } from "node:child_process";
import { env, serverRoot } from "../src/env.js";
import { withDatabase } from "./local-database.js";

async function command(program: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: serverRoot,
      env: { ...process.env, DATABASE_URL: env.databaseUrl },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${program} ${args.join(" ")} failed (${code})`)));
  });
}

try {
  await withDatabase(async () => {
    await command("sh", ["tools/prisma-cli.sh", "db", "push", "--skip-generate"]);
    await command("sh", ["tools/prisma-cli.sh", "generate"]);
    await command("node_modules/.bin/tsx", ["tools/schema-meta.ts"]);
    await command("node_modules/.bin/tsx", ["tools/seed.ts"]);
  });
} catch (error) {
  console.error("[db:setup]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
