import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();
app.listen(env.port, "0.0.0.0", () => {
  console.log(`[server] ALV Store API listening on http://0.0.0.0:${env.port}`);
  console.log(`[server] database: ${env.databaseUrl.replace(/:[^:@/]+@/, ":***@")}`);
});
