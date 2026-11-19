import { Box, Typography, type SxProps, type Theme } from "@mui/material";
import { InboxOutlined } from "@mui/icons-material";
import type { ReactNode } from "react";

export function EmptyState({ title = "No records found", description, icon, action, sx }: {
  title?: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; sx?: SxProps<Theme>;
}) {
  return <Box role="status" sx={[{ textAlign: "center", py: 6, px: 2, color: "text.secondary" }, ...(Array.isArray(sx) ? sx : [sx])]}>
    <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5, opacity: 0.5 }}>{icon ?? <InboxOutlined sx={{ fontSize: 40 }} />}</Box>
    <Typography component="div" variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
    {description && <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>{description}</Typography>}
    {action && <Box sx={{ mt: 2 }}>{action}</Box>}
  </Box>;
}
