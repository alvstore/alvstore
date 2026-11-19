"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Box } from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "@/lib/router-compat";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  useEffect(() => { try { setCollapsed(localStorage.getItem("sidebarCollapsed") === "true"); } catch {} }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  const toggle = useCallback(() => setCollapsed(previous => {
    const next = !previous;
    try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
    return next;
  }), []);
  return <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
    <AppSidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
    <Box sx={{ ml: { xs: 0, md: collapsed ? "68px" : "260px" }, minWidth: 0, minHeight: "100dvh", display: "flex", flexDirection: "column", transition: { xs: "none", md: reduced ? "none" : "margin-left .25s" } }}>
      <AppHeader onMobileMenuToggle={() => setMobileOpen(true)} />
      <Box component="main" id="main-content" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3, lg: 4 } }}>
        <AnimatePresence mode="wait">
          <Box component={motion.div} key={pathname} initial={false} animate={{ opacity: 1 }} exit={{ opacity: reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.12 }}>{children}</Box>
        </AnimatePresence>
      </Box>
    </Box>
  </Box>;
}
