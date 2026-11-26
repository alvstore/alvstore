"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Box, useMediaQuery, type Theme } from "@mui/material";
import { useReducedMotion } from "framer-motion";
import { useLocation } from "@/lib/router-compat";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { sidebarDimensions, sidebarTransition } from "@/lib/sidebar-state";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const desktop = useMediaQuery((theme: Theme) => theme.breakpoints.up("md"));
  useEffect(() => {
    const syncCollapsed = () => {
      try { setCollapsed(localStorage.getItem("sidebarCollapsed") === "true"); } catch {}
    };
    syncCollapsed();
    window.addEventListener("alv-sidebar-collapsed", syncCollapsed);
    return () => window.removeEventListener("alv-sidebar-collapsed", syncCollapsed);
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname, desktop]);
  const showSearch = useCallback(() => {
    // A mobile drawer search is requested only after its exit/focus trap ends.
    // Restore the eventual dialog focus to a control that remains mounted.
    if (!desktop) mobileMenuRef.current?.focus();
    setSearchOpen(true);
  }, [desktop]);
  const toggle = useCallback(() => setCollapsed(previous => {
    const next = !previous;
    try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
    return next;
  }), []);
  return <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
    <AppSidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} onSearch={showSearch} />
    <Box data-app-shell-content sx={{ ml: { xs: 0, md: `${collapsed ? sidebarDimensions.compact : sidebarDimensions.expanded}px` }, minWidth: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", transition: { xs: "none", md: reduced ? "none" : `margin-left ${sidebarTransition}` }, "@media print": { ml: 0, transition: "none" } }}>
      <AppHeader onMobileMenuToggle={() => setMobileOpen(true)} mobileNavigationOpen={mobileOpen} mobileMenuRef={mobileMenuRef} searchOpen={searchOpen} onSearchOpenChange={setSearchOpen} />
      <Box component="main" id="main-content" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3, lg: 4 } }}>
        {children}
      </Box>
    </Box>
  </Box>;
}
