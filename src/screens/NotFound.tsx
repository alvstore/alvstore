"use client";

import { Box, Button } from "@mui/material";
import { AnimatedPage, EmptyState } from "@/components/mui";
import { Link } from "@/lib/router-compat";

export default function NotFound() {
  return <AnimatedPage><Box sx={{ minHeight: "80dvh", display: "grid", placeItems: "center" }}>
    <EmptyState title="404 — Page not found" description="The page may have moved or the link is incorrect." action={<Button component={Link} to="/" variant="contained">Return home</Button>} />
  </Box></AnimatedPage>;
}
