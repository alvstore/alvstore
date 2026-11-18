"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // surface to server logs via the reporting endpoint
    fetch("/api/backend/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "boundary",
        message: error.message,
        stack: error.stack,
        url: typeof window !== "undefined" ? window.location.pathname : "",
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground p-6 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
