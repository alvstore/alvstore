import express from "express";
import cors from "cors";
import { attachUser } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { dataRouter } from "./routes/data.js";
import { storageRouter } from "./routes/storage.js";
import { functionsRouter } from "./routes/functions.js";
import { logRouter } from "./routes/log.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors({ origin: true, credentials: true }));
  // Capture the raw body alongside parsed JSON — webhook signature checks
  // (Razorpay, Hik-Partner) must HMAC the exact payload bytes.
  app.use(
    express.json({
      limit: "25mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );
  app.use(attachUser);

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "alvstore-server" }));

  app.use("/api/auth", authRouter);
  app.use("/api/data", dataRouter);
  app.use("/api/storage", storageRouter);
  app.use("/api/functions", functionsRouter);
  app.use("/api/log", logRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: { message: err.message ?? "Internal server error" } });
  });

  return app;
}
