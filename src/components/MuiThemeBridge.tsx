"use client";

import { useMemo } from "react";
import { createTheme, ThemeProvider as MuiProvider } from "@mui/material/styles";
import { useTheme } from "@/hooks/useTheme";

/**
 * Bridges the app's custom theme system (`useTheme` → CSS variables applied to
 * `<html>`) into a Material UI theme, so every MUI component automatically
 * follows the active light/dark palette (primary, surface, text, status
 * colours, border radius, and the DM Sans body font already used by the app).
 *
 * Recomputes whenever the user switches theme.
 */
export function MuiThemeBridge({ children }: { children: React.ReactNode }) {
  const { currentTheme } = useTheme();

  const theme = useMemo(() => {
    const v = currentTheme.vars;
    const dark = currentTheme.isDark;
    // Build a CSS hsl()/hsla() colour from a stored "H S% L%[/ a]" variable.
    const hsl = (key: string, fallback: string) =>
      v[key] ? `hsl(${v[key]})` : fallback;

    return createTheme({
      palette: {
        mode: dark ? "dark" : "light",
        primary: { main: hsl("--primary", "#7c5cff") },
        secondary: { main: hsl("--accent", "#7c5cff") },
        success: { main: hsl("--success", "#22c55e") },
        warning: { main: hsl("--warning", "#f59e0b") },
        error: { main: hsl("--destructive", "#ef4444") },
        info: { main: hsl("--info", "#3b82f6") },
        background: {
          default: hsl("--background", dark ? "#0a0a0c" : "#f7f7f8"),
          paper: hsl("--card", dark ? "#131316" : "#ffffff"),
        },
        text: {
          primary: hsl("--foreground", dark ? "#f5f5f7" : "#17181c"),
          secondary: hsl("--muted-foreground", dark ? "#9aa0aa" : "#5b6068"),
        },
        divider: hsl(
          "--border",
          dark ? "rgba(255,255,255,0.08)" : "rgba(16,18,24,0.09)"
        ),
      },
      shape: { borderRadius: 14 },
      typography: {
        fontFamily:
          "'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
      },
      components: {
        MuiPaper: {
          styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiCard: {
          styleOverrides: {
            root: ({ theme: t }) => ({
              backgroundImage: "none",
              backgroundColor: t.palette.background.paper,
              border: `1px solid ${t.palette.divider}`,
              borderRadius: 16,
              boxShadow: "none",
            }),
          },
        },
        MuiButton: {
          styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
        },
        MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
        MuiTooltip: {
          styleOverrides: {
            tooltip: ({ theme: t }) => ({
              backgroundColor: t.palette.background.paper,
              color: t.palette.text.primary,
              border: `1px solid ${t.palette.divider}`,
              fontSize: 12,
            }),
          },
        },
      },
    });
  }, [currentTheme]);

  return <MuiProvider theme={theme}>{children}</MuiProvider>;
}
