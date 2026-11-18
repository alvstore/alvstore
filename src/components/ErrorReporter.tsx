"use client";

import { useEffect } from "react";

/**
 * Reports uncaught browser errors / unhandled promise rejections to the API
 * so they show up in the server logs during development and demos.
 */
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    const report = (kind: string, message: string, stack?: string) => {
      const key = `${kind}:${message}`;
      if (seen.has(key)) return;
      seen.add(key);
      fetch("/api/backend/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, stack, url: window.location.pathname }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onError = (e: ErrorEvent) => report("error", e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      report("unhandledrejection", e.reason?.message ?? String(e.reason), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
