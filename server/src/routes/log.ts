import { Router } from "express";

/**
 * Receives browser-side errors from the web app and logs them to the server
 * console (dev visibility; wire to your error tracker in production).
 */
export const logRouter = Router();

logRouter.post("/", (req, res) => {
  const { message, stack, url, kind } = req.body ?? {};
  console.error(`[client:${kind ?? "error"}] ${message}${url ? ` @ ${url}` : ""}`);
  if (stack) console.error(String(stack).split("\n").slice(0, 8).join("\n"));
  res.status(204).end();
});
