"use client";

import { Box, InputAdornment, TextField, type SxProps, type Theme } from "@mui/material";
import { Search } from "@mui/icons-material";
import type { ReactNode } from "react";

export function SearchToolbar({ value, onSearch, placeholder = "Search records…", children, actions, sx }: {
  value?: string; onSearch?: (value: string) => void; placeholder?: string; children?: ReactNode; actions?: ReactNode; sx?: SxProps<Theme>;
}) {
  return <Box component="section" aria-label="Search and filters" sx={[{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
    {onSearch && <TextField size="small" value={value ?? ""} onChange={event => onSearch(event.target.value)} placeholder={placeholder}
      slotProps={{ htmlInput: { "aria-label": placeholder }, input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }}
      sx={{ flex: "1 1 220px", minWidth: 160 }} />}
    {children}
    {actions && <Box sx={{ ml: { sm: "auto" }, display: "flex", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
  </Box>;
}
