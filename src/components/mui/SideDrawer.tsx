"use client";

import { cloneElement, useId, useState, type ReactElement, type ReactNode } from "react";
import {
  Box,
  Drawer,
  IconButton,
  Tab,
  Tabs,
  Typography,
  type Breakpoint,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Close } from "@mui/icons-material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { controlFeedback, easeOut } from "@/lib/motion-presets";

export interface SideDrawerTab {
  value: string;
  label: ReactNode;
}

export interface SideDrawerProps {
  open?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  trigger?: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  tabs?: SideDrawerTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  /** Drawer width in px or CSS length (default 460). */
  width?: number | string;
  /** Optional Breakpoint alias mapped cleanly to responsive drawer widths. */
  maxWidth?: Breakpoint | false;
  anchor?: "right" | "left";
  busy?: boolean;
  footer?: ReactNode;
  /** Alias for `footer` so action bars stay sticky at the drawer bottom. */
  actions?: ReactNode;
  children?: ReactNode;
  paperSx?: SxProps<Theme>;
}

const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  xs: 380,
  sm: 480,
  md: 640,
  lg: 760,
  xl: 860,
};

/**
 * Reusable animated slide-over drawer modeled after Materialize/Vuexy panels.
 * Uses 3-layer choreography (frosted backdrop, directional slide panel, staggered
 * header/body/footer reveals), preserves MUI Modal focus trap + Escape semantics,
 * and honors `prefers-reduced-motion`.
 */
export function SideDrawer({
  open: controlledOpen,
  onClose,
  onOpen,
  trigger,
  title,
  description,
  badge,
  tabs,
  activeTab,
  onTabChange,
  width,
  maxWidth,
  anchor = "right",
  busy = false,
  footer,
  actions,
  children,
  paperSx,
}: SideDrawerProps) {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(false);
  const reduced = useReducedMotion();

  const isOpen = controlledOpen ?? internalOpen;
  const isRight = anchor === "right";
  const footerContent = footer ?? actions;

  const resolvedWidth =
    width !== undefined
      ? width
      : maxWidth === false
      ? "86vw"
      : maxWidth
      ? BREAKPOINT_WIDTHS[maxWidth]
      : 460;

  const cssWidth =
    typeof resolvedWidth === "number"
      ? `min(94vw, ${resolvedWidth}px)`
      : `min(94vw, ${resolvedWidth})`;

  const handleClose = () => {
    if (busy) return;
    setInternalOpen(false);
    onClose?.();
  };

  const slideOffset = isRight ? 18 : -18;

  return (
    <>
      {trigger &&
        cloneElement(trigger, {
          onClick: (event: React.MouseEvent) => {
            trigger.props.onClick?.(event);
            setInternalOpen(true);
            onOpen?.();
          },
        })}

      <Drawer
        anchor={anchor}
        open={isOpen}
        onClose={handleClose}
        transitionDuration={reduced ? 0 : { enter: 340, exit: 210 }}
        slotProps={{
          transition: {
            easing: {
              enter: "cubic-bezier(0.22, 1, 0.36, 1)",
              exit: "cubic-bezier(0.4, 0, 1, 1)",
            },
          },
          backdrop: {
            sx: {
              bgcolor: (theme) =>
                alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.62 : 0.34),
              backdropFilter: "blur(6px)",
              "@media print": { display: "none" },
            },
          },
          paper: {
            role: "dialog",
            "aria-modal": true,
            "aria-labelledby": `${id}-title`,
            "aria-describedby": description ? `${id}-description` : undefined,
            sx: [
              {
                width: { xs: "100%", sm: cssWidth },
                display: "flex",
                flexDirection: "column",
                backgroundImage: "none",
                bgcolor: "background.paper",
                borderLeft: isRight ? 1 : 0,
                borderRight: isRight ? 0 : 1,
                borderColor: "divider",
                borderTopLeftRadius: isRight ? { xs: 0, sm: 20 } : 0,
                borderBottomLeftRadius: isRight ? { xs: 0, sm: 20 } : 0,
                borderTopRightRadius: isRight ? 0 : { xs: 0, sm: 20 },
                borderBottomRightRadius: isRight ? 0 : { xs: 0, sm: 20 },
                boxShadow: (theme) =>
                  theme.palette.mode === "dark"
                    ? `${isRight ? "-" : ""}14px 0 42px rgba(0, 0, 0, 0.56)`
                    : `${isRight ? "-" : ""}12px 0 36px rgba(15, 23, 42, 0.12)`,
                overflow: "hidden",
                "@media print": {
                  position: "static",
                  width: "100%",
                  maxWidth: "100%",
                  border: "none",
                  borderRadius: 0,
                  boxShadow: "none",
                },
              },
              ...(Array.isArray(paperSx) ? paperSx : paperSx ? [paperSx] : []),
            ],
          },
        }}
      >
        {/* Header Layer */}
        <Box
          component={motion.div}
          data-drawer-header
          initial={reduced ? false : { opacity: 0, x: slideOffset }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: reduced ? 0 : 0.24,
            delay: reduced ? 0 : 0.05,
            ease: easeOut,
          }}
          sx={{
            px: 3,
            py: 2.25,
            borderBottom: tabs?.length ? 0 : 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1.5,
            flexShrink: 0,
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(
                theme.palette.primary.main,
                theme.palette.mode === "dark" ? 0.09 : 0.04
              )}, transparent 70%)`,
            "@media print": { display: "none" },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography
                id={`${id}-title`}
                component="h2"
                variant="h6"
                sx={{ fontWeight: 700, fontSize: "1.0625rem", lineHeight: 1.35 }}
              >
                {title}
              </Typography>
              {badge}
            </Box>
            {description && (
              <Typography
                id={`${id}-description`}
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.4, lineHeight: 1.45 }}
              >
                {description}
              </Typography>
            )}
          </Box>
          <IconButton
            aria-label="Close drawer"
            disabled={busy}
            onClick={handleClose}
            size="small"
            sx={{
              minWidth: 36,
              minHeight: 36,
              borderRadius: "10px",
              flexShrink: 0,
              ...controlFeedback,
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Optional Underline Tabs (Edit | Activity) */}
        {tabs && tabs.length > 0 && activeTab !== undefined && onTabChange && (
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, x: slideOffset }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: reduced ? 0 : 0.22,
              delay: reduced ? 0 : 0.08,
              ease: easeOut,
            }}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              px: 3,
              flexShrink: 0,
              "@media print": { display: "none" },
            }}
          >
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

        {/* Scrollable Content Body Layer */}
        <Box
          component={motion.div}
          data-drawer-body
          initial={reduced ? false : { opacity: 0, x: isRight ? 22 : -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: reduced ? 0 : 0.28,
            delay: reduced ? 0 : 0.09,
            ease: easeOut,
          }}
          sx={{
            flex: 1,
            overflowY: "auto",
            px: 3,
            py: 2.5,
            minWidth: 0,
            "@media print": { overflow: "visible", p: 0 },
          }}
        >
          {tabs && tabs.length > 0 && activeTab !== undefined ? (
            <AnimatePresence mode="wait" initial={false}>
              <Box
                component={motion.div}
                key={activeTab}
                initial={reduced ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -8 }}
                transition={{ duration: reduced ? 0 : 0.16, ease: easeOut }}
              >
                {children}
              </Box>
            </AnimatePresence>
          ) : (
            children
          )}
        </Box>

        {/* Sticky Footer Layer */}
        {footerContent && (
          <Box
            component={motion.div}
            data-drawer-footer
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.24,
              delay: reduced ? 0 : 0.13,
              ease: easeOut,
            }}
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
              "@media print": { display: "none" },
            }}
          >
            {footerContent}
          </Box>
        )}
      </Drawer>
    </>
  );
}
