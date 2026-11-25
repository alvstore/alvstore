"use client";

import { useId, type ReactNode } from "react";
import { Box, Drawer, IconButton, Tab, Tabs, Typography, type SxProps, type Theme } from "@mui/material";
import { Close } from "@mui/icons-material";

export interface SideDrawerTab {
  value: string;
  label: ReactNode;
}

export interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  tabs?: SideDrawerTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  width?: number;
  busy?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
  paperSx?: SxProps<Theme>;
}

/**
 * Right-hand slide-over detail/form drawer modeled after Materialize offcanvas drawers.
 * Preserves dialog ARIA semantics, keyboard Escape handling, and busy close locking.
 */
export function SideDrawer({
  open,
  onClose,
  title,
  description,
  badge,
  tabs,
  activeTab,
  onTabChange,
  width = 420,
  busy = false,
  footer,
  children,
  paperSx,
}: SideDrawerProps) {
  const id = useId();
  const handleClose = () => {
    if (!busy) onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": `${id}-title`,
          "aria-describedby": description ? `${id}-description` : undefined,
          sx: [
            {
              width: { xs: "100%", sm: `min(92vw, ${width}px)` },
              display: "flex",
              flexDirection: "column",
              backgroundImage: "none",
              bgcolor: "background.paper",
              borderLeft: 1,
              borderColor: "divider",
            },
            ...(Array.isArray(paperSx) ? paperSx : [paperSx]),
          ],
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: tabs?.length ? 0 : 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography id={`${id}-title`} component="h2" variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.35 }}>
              {title}
            </Typography>
            {badge}
          </Box>
          {description && (
            <Typography id={`${id}-description`} variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4, lineHeight: 1.45 }}>
              {description}
            </Typography>
          )}
        </Box>
        <IconButton
          aria-label="Close drawer"
          disabled={busy}
          onClick={handleClose}
          size="small"
          sx={{ minWidth: 36, minHeight: 36, borderRadius: "10px", flexShrink: 0 }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Optional Underline Tabs (Edit | Activity) */}
      {tabs && tabs.length > 0 && activeTab !== undefined && onTabChange && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, flexShrink: 0 }}>
          <Tabs
            value={activeTab}
            aria-label="Drawer sections"
            onChange={(_event, val: string) => onTabChange(val)}
            variant="standard"
            sx={{ minHeight: 40 }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.value}
                value={tab.value}
                label={tab.label}
                disabled={busy}
                sx={{ minHeight: 40, px: 1.5, mr: 1.5, fontSize: 13, fontWeight: 600 }}
              />
            ))}
          </Tabs>
        </Box>
      )}

      {/* Scrollable Body */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5, minWidth: 0 }}>
        {children}
      </Box>

      {/* Sticky Footer */}
      {footer && (
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.25,
            flexShrink: 0,
            bgcolor: "background.paper",
          }}
        >
          {footer}
        </Box>
      )}
    </Drawer>
  );
}
