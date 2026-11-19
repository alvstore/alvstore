"use client";

import { useMemo } from "react";
import { alpha, createTheme, ThemeProvider as MuiProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { useTheme } from "@/hooks/useTheme";
import { themeColor } from "@/lib/theme-color";
import { controlFeedback, motionTokens } from "@/lib/motion-presets";

/** Shared surfaces and interaction timing for every screen, in all seven palettes. */
export function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme();
  const theme = useMemo(() => {
    const v = currentTheme.vars;
    const dark = currentTheme.isDark;
    const hsl = (key: string, fallback: string) => themeColor(v[key], fallback);
    const transition = "160ms cubic-bezier(.22,1,.36,1)";
    return createTheme({
      palette: {
        mode: dark ? "dark" : "light",
        primary: { main: hsl("--primary", "#7c5cff"), contrastText: hsl("--primary-foreground", "#fff") },
        secondary: { main: hsl("--accent", "#7c5cff"), contrastText: hsl("--accent-foreground", "#fff") },
        success: { main: hsl("--success", "#22c55e"), contrastText: hsl("--success-foreground", "#fff") },
        warning: { main: hsl("--warning", "#f59e0b"), contrastText: hsl("--warning-foreground", "#111") },
        error: { main: hsl("--destructive", "#ef4444"), contrastText: hsl("--destructive-foreground", "#fff") },
        info: { main: hsl("--info", "#3b82f6"), contrastText: hsl("--info-foreground", "#fff") },
        background: { default: hsl("--background", dark ? "#0a0a0c" : "#f7f7f8"), paper: hsl("--card", dark ? "#131316" : "#fff") },
        text: { primary: hsl("--foreground", dark ? "#f5f5f7" : "#17181c"), secondary: hsl("--muted-foreground", dark ? "#9aa0aa" : "#5b6068") },
        divider: hsl("--border", dark ? "rgba(255,255,255,0.08)" : "rgba(16,18,24,0.09)"),
      },
      shape: { borderRadius: 14 },
      typography: {
        fontFamily: "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
        h5: { fontWeight: 700, letterSpacing: "-.035em" },
        h6: { fontWeight: 650, letterSpacing: "-.025em" },
        subtitle1: { letterSpacing: "-.015em" },
        button: { textTransform: "none", letterSpacing: "-.005em" },
      },
      transitions: {
        easing: { easeOut: "cubic-bezier(.22,1,.36,1)" },
        duration: { shortest: 120, shorter: 160, short: 200, standard: motionTokens.base * 1000, complex: motionTokens.page * 1000, enteringScreen: 240, leavingScreen: 180 },
      },
      components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiCard: { styleOverrides: { root: ({ theme: t }) => ({ backgroundImage: "none", backgroundColor: t.palette.background.paper, border: `1px solid ${t.palette.divider}`, borderRadius: 18, boxShadow: "none" }) } },
        MuiButtonBase: { styleOverrides: { root: ({ theme: t }) => ({ "&.Mui-focusVisible": { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 } }) } },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { root: { textTransform: "none", fontWeight: 600, borderRadius: 10, ...controlFeedback }, sizeSmall: { fontSize: 11.5, minHeight: 31 } },
        },
        MuiIconButton: { styleOverrides: { root: { borderRadius: 10, ...controlFeedback } } },
        MuiCheckbox: { styleOverrides: { root: { ...controlFeedback, "& .MuiSvgIcon-root": { transition: `fill ${transition}` } } } },
        MuiRadio: { styleOverrides: { root: controlFeedback } },
        MuiListItemButton: { styleOverrides: { root: { transition: `color ${transition}, background-color ${transition}, box-shadow ${transition}`, "& .MuiListItemIcon-root": { transition: `color ${transition}, translate ${transition}` }, "@media (hover: hover) and (pointer: fine)": { "&:not(.Mui-disabled):hover .MuiListItemIcon-root": { translate: "2px 0" } }, "@media (prefers-reduced-motion: reduce)": { "&:not(.Mui-disabled):hover .MuiListItemIcon-root": { translate: "none" } } } } },
        MuiToggleButtonGroup: { styleOverrides: { root: ({ theme: t }) => ({ padding: 3, borderRadius: 10, backgroundColor: t.palette.action.hover }), grouped: { border: 0, borderRadius: "8px !important", margin: "0 !important" } } },
        MuiToggleButton: { styleOverrides: { root: ({ theme: t }) => ({ textTransform: "none", fontWeight: 550, fontSize: 10.5, padding: "5px 10px", lineHeight: 1.5, border: 0, color: t.palette.text.secondary, transition: `background-color ${transition}, color ${transition}, box-shadow ${transition}`, "&.Mui-selected": { color: t.palette.text.primary, backgroundColor: t.palette.background.paper, boxShadow: `0 1px 3px ${alpha(t.palette.common.black, .08)}`, "&:hover": { backgroundColor: t.palette.background.paper } } }) } },
        MuiTab: { styleOverrides: { root: { textTransform: "none", minHeight: 40, fontSize: 12, fontWeight: 550, transition: `color ${transition}, background-color ${transition}` } } },
        MuiTabs: { styleOverrides: { indicator: { height: 2.5, borderRadius: 3, transition: "left .28s cubic-bezier(.22,1,.36,1), width .28s cubic-bezier(.22,1,.36,1)" } } },
        MuiDialog: { defaultProps: { transitionDuration: { enter: 220, exit: 160 } }, styleOverrides: { paper: ({ theme: t }) => ({ border: `1px solid ${t.palette.divider}`, borderRadius: 20 }) } },
        MuiDrawer: { defaultProps: { transitionDuration: { enter: 240, exit: 180 } } },
        MuiMenu: { styleOverrides: { paper: ({ theme: t }) => ({ border: `1px solid ${t.palette.divider}`, borderRadius: 14, boxShadow: `0 10px 40px ${alpha(t.palette.common.black, dark ? .25 : .08)}` }), list: { padding: 5 } } },
        MuiMenuItem: { styleOverrides: { root: { borderRadius: 8, fontSize: 13, transition: `background-color ${transition}` } } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 }, notchedOutline: { transition: `border-color ${transition}, border-width ${transition}` } } },
        MuiChip: { styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } } },
        MuiSkeleton: { defaultProps: { animation: "wave" }, styleOverrides: { rounded: { borderRadius: 12 } } },
        MuiLinearProgress: { styleOverrides: { root: ({ theme: t, ownerState }) => ({ backgroundColor: alpha(t.palette[ownerState.color && ownerState.color !== "inherit" ? ownerState.color : "primary"].main, .1) }), bar: { transition: "transform .55s cubic-bezier(.22,1,.36,1)" } } },
        MuiTooltip: { styleOverrides: { tooltip: ({ theme: t }) => ({ backgroundColor: t.palette.background.paper, color: t.palette.text.primary, border: `1px solid ${t.palette.divider}`, fontSize: 11, borderRadius: 8, padding: "6px 10px" }) } },
      },
    });
  }, [currentTheme]);
  return <MuiProvider theme={theme}><CssBaseline />{children}</MuiProvider>;
}
