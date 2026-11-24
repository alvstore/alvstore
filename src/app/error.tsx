"use client";

import { Box, Button, Typography } from "@mui/material";
import { useEffect } from "react";
import { isChunkLoadError, reloadOnChunkError, reportBoundaryError } from "@/lib/chunk-reload";
export default function GlobalError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}) {
    useEffect(() => {
        if (reloadOnChunkError(error)) return;
        reportBoundaryError(error, "boundary");
    }, [error]);
    const chunkError = isChunkLoadError(error);
    return (<Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: "1.5rem", textAlign: "center" }}>
      <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "600" }}>Something went wrong</Typography>
      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "28rem" }}>
        {chunkError ? "A newer version of ALVStore was deployed. Reload the page to continue." : error.message}
      </Typography>
      <Button onClick={() => (chunkError ? window.location.reload() : reset())} variant="contained">
        {chunkError ? "Reload page" : "Try again"}
      </Button>
    </Box>);
}
