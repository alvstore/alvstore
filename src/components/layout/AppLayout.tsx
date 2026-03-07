import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebarCollapsed") === "true";
    } catch {
      return false;
    }
  });

  // Auto-close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleToggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - always visible on desktop */}
      <div className="hidden md:block">
        <AppSidebar collapsed={collapsed} onToggle={handleToggle} />
      </div>
      {mobileOpen && (
        <div className="md:hidden">
          <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className={cn("flex flex-col min-h-screen transition-all duration-300", collapsed ? "md:ml-[60px]" : "md:ml-[240px]")}>
        <AppHeader onMobileMenuToggle={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-4 md:p-6 md:pl-8 md:pr-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
