"use client";

import { Box, Button, Typography } from "@mui/material";
import { useEffect } from "react";
import { isChunkLoadError, reloadOnChunkError, reportBoundaryError } from "@/lib/chunk-reload";

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (reloadOnChunkError(error)) return;
    reportBoundaryError(error, "app-boundary");
  }, [error]);

  const chunkError = isChunkLoadError(error);
  return (
    <Box sx={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 3, textAlign: "center" }}>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 600 }}>Something went wrong</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {chunkError ? "A newer version of ALVStore was deployed. Reload the page to continue." : error.message}
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <Button onClick={() => (chunkError ? window.location.reload() : reset())} variant="contained">
          {chunkError ? "Reload page" : "Try again"}
        </Button>
      </Box>
    </Box>
  );
}
