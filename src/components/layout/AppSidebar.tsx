"use client";

import { useState, useEffect } from "react";
import { Box, Collapse, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from "@mui/material";
import { ChevronLeft as CollapseIcon, ChevronRight as ExpandIcon, ExpandLess, ExpandMore, Close } from "@mui/icons-material";
import { useLocation, Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, Users, ShoppingCart, Monitor, Package, Wrench, Clock, CreditCard, BarChart3, FileText, Settings, Home, Target, ClipboardList, Receipt, UserCog, Wallet, Shield, MessageCircle, CalendarDays, Zap, Truck, Building2, ShoppingBag, RotateCcw, Tag } from "lucide-react";

interface NavItem { title: string; url: string; icon: React.ComponentType<{ size?: number }>; }
interface NavCategory { label: string; items: NavItem[]; }

export const adminStaffNav: NavCategory[] = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "CRM",
    items: [
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Customers", url: "/customers", icon: Users },
      { title: "Follow-Ups", url: "/follow-ups", icon: Clock },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Quotations", url: "/sales", icon: ShoppingCart },
      { title: "Invoices", url: "/invoices", icon: Receipt },
      { title: "Delivery Challans", url: "/challans", icon: Truck },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Products", url: "/inventory", icon: Package },
      { title: "Apple Pricing", url: "/apple-pricing", icon: Tag },
      { title: "POS Terminal", url: "/pos", icon: Monitor },
      { title: "Barcodes", url: "/barcodes", icon: FileText },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard },
      { title: "Payment Register", url: "/payment-register", icon: Shield },
    ],
  },
  {
    label: "Procurement",
    items: [
      { title: "Suppliers", url: "/suppliers", icon: Building2 },
      { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingBag },
      { title: "Purchase Bills", url: "/purchase-bills", icon: Receipt },
      { title: "Purchase Returns", url: "/purchase-returns", icon: RotateCcw },
    ],
  },
  {
    label: "Repair",
    items: [
      { title: "Job Sheets", url: "/repairs", icon: Wrench },
      { title: "Technicians", url: "/technicians", icon: UserCog },
    ],
  },
  {
    label: "Collaboration",
    items: [
      { title: "Messages", url: "/chat", icon: MessageCircle },
      { title: "Tasks", url: "/tasks", icon: ClipboardList },
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "HRM",
    items: [
      { title: "Employees", url: "/employees", icon: UserCog },
      { title: "Attendance", url: "/attendance", icon: Clock },
      { title: "Payroll", url: "/payroll", icon: Wallet },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Reports", url: "/reports", icon: BarChart3 },
      { title: "Audit Logs", url: "/audit-logs", icon: Shield },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

const customerNav: NavCategory[] = [
  { label: "Portal", items: [
    { title: "My Portal", url: "/portal", icon: Home },
    { title: "Chat", url: "/chat", icon: MessageCircle },
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];

const technicianNav: NavCategory[] = [
  { label: "Workspace", items: [
    { title: "My Repairs", url: "/technicians", icon: Wrench },
    { title: "My Tasks", url: "/tasks", icon: ClipboardList },
    { title: "Chat", url: "/chat", icon: MessageCircle },
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];

export function navigationFor(hasRole: (role: "admin" | "staff" | "technician" | "customer") => boolean) {
  return hasRole("customer") ? customerNav : hasRole("technician") && !hasRole("admin") && !hasRole("staff") ? technicianNav : adminStaffNav;
}
interface AppSidebarProps { collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onMobileClose: () => void; }

export function AppSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: AppSidebarProps) {
  const { hasRole } = useAuth();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => { try { const saved = localStorage.getItem("sidebar-expanded"); if (saved) setExpanded(JSON.parse(saved)); } catch {} }, []);
  const toggleCategory = (label: string) => setExpanded(previous => {
    const next = { ...previous, [label]: previous[label] === false };
    try { localStorage.setItem("sidebar-expanded", JSON.stringify(next)); } catch {}
    return next;
  });
  const content = (compact: boolean, mobile = false) => <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
    <Box sx={{ height: 64, display: "flex", alignItems: "center", gap: 1.5, px: compact ? 2 : 2.5, flexShrink: 0, borderBottom: 1, borderColor: "divider" }}>
      <Box sx={{ width: 34, height: 34, bgcolor: "primary.main", color: "primary.contrastText", display: "grid", placeItems: "center", borderRadius: 2 }}><Zap size={18} /></Box>
      {!compact && <Box sx={{ flex: 1 }}><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>ALVStore</Typography><Typography variant="overline" color="text.secondary" sx={{ fontSize: 9, letterSpacing: "0.18em", lineHeight: 1 }}>ERP Suite</Typography></Box>}
      {mobile && <IconButton aria-label="Close navigation" onClick={onMobileClose}><Close fontSize="small" /></IconButton>}
    </Box>
    <Box component="nav" aria-label="Main navigation" sx={{ flex: 1, overflowY: "auto", py: 2, scrollbarWidth: "thin" }}>
      {navigationFor(hasRole).map(category => <Box key={category.label} sx={{ px: 1 }}>
        {!compact && <ListItemButton onClick={() => toggleCategory(category.label)} aria-expanded={expanded[category.label] !== false} sx={{ borderRadius: 2, py: 0.5, px: 1.5 }}>
          <ListItemText primary={category.label} slotProps={{ primary: { variant: "overline", sx: { fontSize: 10, letterSpacing: "0.1em", color: "text.secondary" } } }} />
          {category.items.length > 1 && (expanded[category.label] === false ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />)}
        </ListItemButton>}
        <Collapse in={compact || expanded[category.label] !== false} timeout="auto">
          <List disablePadding>
            {category.items.map(item => {
              const active = pathname === item.url || pathname.startsWith(item.url + "/");
              const Icon = item.icon;
              return <Tooltip key={item.url} title={compact ? item.title : ""} placement="right"><ListItemButton component={Link} to={item.url} aria-label={item.title} aria-current={active ? "page" : undefined} selected={active} onClick={mobile ? onMobileClose : undefined}
                sx={{ borderRadius: 2, my: 0.25, minHeight: 42, px: compact ? 2 : 1.5, gap: compact ? 0 : 1.5, color: active ? "primary.main" : "text.secondary", "&.Mui-selected": { bgcolor: "action.selected", boxShadow: "inset 3px 0 0 currentColor" } }}>
                <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}><Icon size={17} /></ListItemIcon>
                {!compact && <ListItemText primary={item.title} slotProps={{ primary: { noWrap: true, sx: { fontSize: 13, fontWeight: active ? 700 : 500 } } }} />}
              </ListItemButton></Tooltip>;
            })}
          </List>
        </Collapse>
        {!compact && <Divider sx={{ my: 1.25, mx: 1 }} />}
      </Box>)}
    </Box>
    {!mobile && <Box sx={{ borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "center", p: 0.5 }}><IconButton onClick={onToggle} aria-label={compact ? "Expand navigation" : "Collapse navigation"}>{compact ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}</IconButton></Box>}
  </Box>;
  return <>
    <Drawer variant="permanent" sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { width: collapsed ? 68 : 260, transition: "width .25s", boxSizing: "border-box", bgcolor: "background.paper" } }}>{content(collapsed)}</Drawer>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} slotProps={{ paper: { sx: { width: 280, maxWidth: "90vw" } } }} sx={{ display: { md: "none" } }}>{content(false, true)}</Drawer>
  </>;
}
