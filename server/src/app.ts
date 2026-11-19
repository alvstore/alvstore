import express from "express";
import cors from "cors";
import { attachUser } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { dataRouter } from "./routes/data.js";
import { storageRouter } from "./routes/storage.js";
import { functionsRouter } from "./routes/functions.js";
import { logRouter } from "./routes/log.js";
import { asyncHandler } from "./lib/async-handler.js";
import { apiErrorHandler } from "./lib/api-errors.js";
import { pool } from "./db.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({
    limit: "25mb",
    verify: (req, _res, buf) => { (req as express.Request & { rawBody?: Buffer }).rawBody = buf; },
  }));

  // Liveness must not depend on the DB (or an expired Authorization header).
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "alvstore-server" }));
  app.get("/api/ready", asyncHandler(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  }));
  app.use(asyncHandler(attachUser));
  app.use("/api/auth", authRouter);
  app.use("/api/data", dataRouter);
  app.use("/api/storage", storageRouter);
  app.use("/api/functions", functionsRouter);
  app.use("/api/log", logRouter);
  app.use(apiErrorHandler);
  return app;
}
