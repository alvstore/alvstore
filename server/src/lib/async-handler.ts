import type { RequestHandler } from "express";

/** Express 4 doesn't forward rejected async handlers to its error middleware. */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try { Promise.resolve(handler(req, res, next)).catch(next); }
    catch (error) { next(error); }
  };
}
