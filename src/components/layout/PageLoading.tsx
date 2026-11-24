"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

/** Lightweight centered loader shown while lazy workspace screens resolve. */
export function PageLoading() {
  return (
    <Box
      role="status"
      aria-label="Loading page"
      sx={{
        minHeight: "42vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
      }}
    >
      <CircularProgress size={28} thickness={4} />
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
        Loading workspace…
      </Typography>
    </Box>
  );
}
