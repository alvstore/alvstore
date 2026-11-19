"use client";

import { Box, Button, Typography } from "@mui/material";
import { useEffect } from "react";
export default function GlobalError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
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
    return (<Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: "1.5rem", textAlign: "center" }}>
      <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "600" }}>Something went wrong</Typography>
      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "28rem" }}>{error.message}</Typography>
      <Button onClick={reset} variant="contained">Try again</Button>
    </Box>);
}
