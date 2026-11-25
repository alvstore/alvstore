"use client";

import { useState, useEffect, useRef, useId, useCallback, forwardRef, type ReactNode } from "react";
import { Avatar, Box, ButtonBase, Collapse, Drawer, IconButton, List, ListItemButton, ListItemIcon, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme as useMuiTheme } from "@mui/material/styles";
import { ChevronLeft, ChevronRight, ExpandMore, Close, Search, SettingsOutlined } from "@mui/icons-material";
import { LayoutGroup, motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { useLocation, Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { themeColor } from "@/lib/theme-color";
import { isNavigationActive, navigationCategoryForPath, parseSidebarGroups, revealNavigationGroup, sidebarDimensions, sidebarIdentity, sidebarRoleLabel, sidebarTransition } from "@/lib/sidebar-state";
import { LayoutDashboard, Users, ShoppingCart, Monitor, Package, Wrench, Clock, CreditCard, BarChart3, FileText, Settings, Home, Target, ClipboardList, Receipt, UserCog, Wallet, Shield, MessageCircle, CalendarDays, Truck, Building2, ShoppingBag, RotateCcw, Tag } from "lucide-react";
import { BrandMark } from "@/components/mui";

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
/** The actual fixed paper must be a projection scroll root, not just its nav. */
const SidebarSurface = forwardRef<HTMLElement, Omit<HTMLMotionProps<"aside">, "children"> & { children?: ReactNode }>((props, ref) => (
  <Box component={motion.aside} ref={ref} {...props} layoutRoot layoutScroll />
));
SidebarSurface.displayName = "SidebarSurface";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSearch: () => void;
}

interface SidebarContentProps {
  compact?: boolean;
  mobile?: boolean;
  expanded: Record<string, boolean>;
  onToggleCategory: (label: string) => void;
  onClose: () => void;
  onSearch: () => void;
}

/** Two responsive surfaces, one navigation catalog and one shared set of preferences. */
function SidebarContent({ compact = false, mobile = false, expanded, onToggleCategory, onClose, onSearch }: SidebarContentProps) {
  const { hasRole, user, roles } = useAuth();
  const { pathname } = useLocation();
  const theme = useMuiTheme();
  const reduced = useReducedMotion();
  const id = useId();
  const navRef = useRef<HTMLElement>(null);
  const [shortcut, setShortcut] = useState("Ctrl K");
  const categories = navigationFor(hasRole);
  const activeCategory = navigationCategoryForPath(categories, pathname);
  const identity = sidebarIdentity(user?.user_metadata.full_name, user?.email);
  const role = sidebarRoleLabel(roles);
  const activeColor = theme.palette.mode === "dark" ? theme.palette.primary.light : theme.palette.primary.dark;
  const muted = "var(--sidebar-text-muted)";

  useEffect(() => { setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"); }, []);
  const revealCurrentItem = useCallback(() => {
    const nav = navRef.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !current) return;
    const container = nav.getBoundingClientRect(), item = current.getBoundingClientRect();
    // Scroll this panel only, never the document or an editable page beneath it.
    if (item.top < container.top + 8) nav.scrollTop += item.top - container.top - 8;
    else if (item.bottom > container.bottom - 8) nav.scrollTop += item.bottom - container.bottom + 8;
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(revealCurrentItem);
    return () => cancelAnimationFrame(frame);
  }, [pathname, compact, revealCurrentItem]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(revealCurrentItem);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [revealCurrentItem]);

  return <Box data-sidebar-content={mobile ? "mobile" : compact ? "compact" : "expanded"}
    sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", borderRadius: "inherit" }}>
    <Box sx={{ px: compact ? 0 : 2, pt: mobile ? 2.5 : 2.25, pb: 2, display: "flex", alignItems: "center", justifyContent: compact ? "center" : "flex-start", gap: 1.25, flexShrink: 0 }}>
      <Tooltip title={compact ? "ALVStore workspace" : ""} placement="right">
        <Box component={Link} to={categories[0].items[0].url} aria-label="ALVStore workspace home" onClick={mobile ? onClose : undefined}
          sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, color: "inherit", borderRadius: 2, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 4 } }}>
          <BrandMark size={36} sx={{ boxShadow: `0 3px 10px ${alpha(theme.palette.primary.main, .18)}` }} />
          {!compact && <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.055em", lineHeight: 1.25 }}>ALVStore<Box component="span" sx={{ color: "primary.main" }}>.</Box></Typography>
            <Typography sx={{ fontSize: 9, fontWeight: 600, letterSpacing: ".13em", textTransform: "uppercase", color: muted, mt: .25 }}>Business, together</Typography>
          </Box>}
        </Box>
      </Tooltip>
      {mobile && <IconButton aria-label="Close navigation" onClick={onClose} sx={{ ml: "auto", width: 40, height: 40 }}><Close sx={{ fontSize: 19 }} /></IconButton>}
    </Box>

    <Box sx={{ px: compact ? 1 : 1.75, pb: 1.75, flexShrink: 0 }}>
      {!compact && <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, px: 1.25, py: 1, borderRadius: "11px", bgcolor: "hsl(var(--sidebar-muted) / .35)", border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ width: 25, height: 25, display: "grid", placeItems: "center", borderRadius: "7px", bgcolor: "background.paper", color: muted, border: "1px solid", borderColor: "divider", flexShrink: 0 }}><Building2 size={14} /></Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 650, lineHeight: 1.4 }} noWrap>ALV workspace</Typography>
          <Typography sx={{ fontSize: 10, color: muted, lineHeight: 1.4 }} noWrap>{role} access</Typography>
        </Box>
      </Box>}
      <Tooltip title={compact ? `Find pages and actions · ${shortcut}` : ""} placement="right">
        <ButtonBase onClick={onSearch} aria-label="Find pages and actions" aria-haspopup="dialog"
          sx={{ display: "flex", width: "100%", minHeight: 40, justifyContent: compact ? "center" : "flex-start", gap: 1, px: compact ? 0 : 1.25, borderRadius: "10px", border: "1px solid", borderColor: "divider", color: muted, bgcolor: "background.paper", transition: reduced ? "none" : "background-color 160ms ease, border-color 160ms ease", "&:hover": { bgcolor: "action.hover", borderColor: alpha(theme.palette.primary.main, .3) } }}>
          <Search sx={{ fontSize: 18, flexShrink: 0 }} />
          {!compact && <><Typography component="span" sx={{ fontSize: 11.5, flex: 1, textAlign: "left" }}>Quick search</Typography><Box component="kbd" sx={{ fontFamily: "inherit", fontSize: 9, px: .5, py: .1, borderRadius: "4px", border: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>{shortcut}</Box></>}
        </ButtonBase>
      </Tooltip>
    </Box>

    <LayoutGroup id={`sidebar-${id}`}>
      <Box ref={navRef} component={motion.nav} layoutScroll aria-label="Main navigation" data-sidebar-scroll
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", px: compact ? 1 : 1.25, pb: 1.5, scrollbarWidth: "thin", scrollbarColor: `${alpha(theme.palette.text.primary, .12)} transparent`, "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: alpha(theme.palette.text.primary, .12), borderRadius: 4 } }}>
        {categories.map((category, index) => {
          const open = compact || expanded[category.label] !== false;
          const headingId = `${id}-group-${index}`;
          return <Box component="section" key={category.label} data-sidebar-group={category.label}
            sx={{ mt: index === 0 ? 0 : compact ? 1 : 1.75, ...(compact && index > 0 ? { pt: 1, borderTop: "1px solid", borderColor: "divider" } : {}) }}>
            {!compact && <ButtonBase id={headingId} onClick={() => onToggleCategory(category.label)} aria-label={!open && activeCategory === category.label ? `${category.label}, contains current page` : category.label} aria-expanded={open} aria-controls={`${headingId}-links`}
              sx={{ display: "flex", justifyContent: "space-between", width: "100%", minHeight: mobile ? 38 : 30, px: 1.25, mb: .5, borderRadius: "7px", color: muted, "&:hover": { color: "text.primary", bgcolor: "action.hover" } }}>
              <Typography component="span" sx={{ fontSize: 9.5, fontWeight: 650, letterSpacing: ".12em", textTransform: "uppercase" }}>{category.label}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: .5 }}>
                {!open && activeCategory === category.label && <Box component="span" aria-hidden="true" sx={{ width: 4, height: 4, bgcolor: "primary.main", borderRadius: "50%" }} />}
                <ExpandMore sx={{ fontSize: 14, opacity: .7, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: reduced ? "none" : `transform ${sidebarTransition}` }} />
              </Box>
            </ButtonBase>}
            <Collapse in={open} timeout={reduced || compact ? 0 : 200} unmountOnExit onEntered={activeCategory === category.label ? revealCurrentItem : undefined}>
              <List id={`${headingId}-links`} aria-label={category.label} disablePadding>
                {category.items.map(item => {
                  const active = isNavigationActive(pathname, item.url);
                  const Icon = item.icon;
                  return <Box component="li" key={item.url} sx={{ my: .25 }}>
                    <Tooltip title={compact ? item.title : ""} placement="right" enterDelay={250} disableInteractive>
                      <ListItemButton component={Link} to={item.url} aria-label={item.title} aria-current={active ? "page" : undefined} selected={active} onClick={mobile ? onClose : undefined}
                        sx={{ position: "relative", isolation: "isolate", borderRadius: "11px", minHeight: compact || mobile ? 44 : 41, px: compact ? 0 : 1.25, gap: 1.25, justifyContent: compact ? "center" : "flex-start", color: active ? activeColor : "inherit", "&.Mui-selected, &.Mui-selected:hover": { bgcolor: "transparent" }, "&:active": { scale: reduced ? "none" : ".985" }, "&.Mui-focusVisible": { outlineOffset: -2 }, "&:hover .MuiListItemIcon-root": { translate: "none" } }}>
                        {active && <Box component={motion.div} layoutId={reduced || mobile ? undefined : "active-page"} initial={false} transition={{ type: "spring", stiffness: 460, damping: 38, ...(reduced ? { duration: 0 } : {}) }} data-sidebar-active aria-hidden="true"
                          sx={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", borderRadius: "inherit", bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .16 : .09), border: `1px solid ${alpha(theme.palette.primary.main, .12)}` }} />}
                        <ListItemIcon sx={{ width: 23, minWidth: 23, justifyContent: "center", color: active ? activeColor : muted, opacity: active ? 1 : .85 }}><Icon size={18} /></ListItemIcon>
                        {!compact && <Typography component="span" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: active ? 650 : 450, lineHeight: 1.5 }}>{item.title}</Typography>}
                        {!compact && active && <Box component="span" aria-hidden="true" sx={{ width: 5, height: 5, flexShrink: 0, borderRadius: "50%", bgcolor: "primary.main", mr: .5 }} />}
                      </ListItemButton>
                    </Tooltip>
                  </Box>;
                })}
              </List>
            </Collapse>
          </Box>;
        })}
      </Box>
    </LayoutGroup>

    <Box sx={{ flexShrink: 0, p: compact ? 1 : 1.25, borderTop: "1px solid", borderColor: "divider", pb: mobile ? "max(12px, env(safe-area-inset-bottom))" : undefined }}>
      <Tooltip title={compact ? `${identity.name} · Profile and settings` : "Profile and settings"} placement={compact ? "right" : "top"}>
        <ButtonBase component={Link} to="/settings" aria-label="Profile and settings" onClick={mobile ? onClose : undefined}
          sx={{ display: "flex", width: "100%", minHeight: 48, gap: 1.1, p: compact ? 0 : 1, justifyContent: compact ? "center" : "flex-start", textAlign: "left", borderRadius: "13px", color: "inherit", bgcolor: compact ? "transparent" : "action.hover", "&:hover": { bgcolor: "action.selected" } }}>
          <Avatar sx={{ width: compact ? 32 : 33, height: compact ? 32 : 33, fontSize: 11, fontWeight: 700, bgcolor: alpha(theme.palette.primary.main, .13), color: activeColor, borderRadius: "11px" }}>{identity.initials}</Avatar>
          {!compact && <><Box sx={{ flex: 1, minWidth: 0 }}><Typography noWrap sx={{ fontSize: 12, fontWeight: 650, lineHeight: 1.6 }}>{identity.name}</Typography><Typography noWrap sx={{ fontSize: 10, color: muted }}>{role}</Typography></Box><SettingsOutlined sx={{ fontSize: 16, color: muted }} /></>}
        </ButtonBase>
      </Tooltip>
    </Box>
  </Box>;
}

export function AppSidebar({ collapsed, onToggle, mobileOpen, onMobileClose, onSearch }: AppSidebarProps) {
  const { hasRole } = useAuth();
  const { pathname } = useLocation();
  const { currentTheme } = useTheme();
  const theme = useMuiTheme();
  const reduced = useReducedMotion();
  const pendingMobileSearch = useRef(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const categories = navigationFor(hasRole);
  const activeCategory = navigationCategoryForPath(categories, pathname);
  const surface = themeColor(currentTheme.vars["--sidebar-background"], theme.palette.background.paper);
  const foreground = themeColor(currentTheme.vars["--sidebar-foreground"], theme.palette.text.primary);
  const border = themeColor(currentTheme.vars["--sidebar-border"], theme.palette.divider);
  const muted = theme.palette.mode === "dark" ? alpha(foreground, .66) : theme.palette.text.secondary;

  useEffect(() => {
    try { setExpanded(parseSidebarGroups(localStorage.getItem("sidebar-expanded"), categories.map(category => category.label))); } catch {}
    setReady(true);
  }, [categories]);
  useEffect(() => {
    if (ready) setExpanded(previous => revealNavigationGroup(previous, activeCategory));
  }, [pathname, activeCategory, collapsed, ready]);
  useEffect(() => {
    if (ready) try { localStorage.setItem("sidebar-expanded", JSON.stringify(expanded)); } catch {}
  }, [expanded, ready]);
  const toggleCategory = (label: string) => setExpanded(previous => ({ ...previous, [label]: previous[label] === false }));
  const shared = { expanded, onToggleCategory: toggleCategory, onClose: onMobileClose };

  return <>
    <Drawer variant="permanent" data-sidebar-desktop sx={{ display: { xs: "none", md: "block" } }}
      slotProps={{ paper: { component: SidebarSurface, "aria-label": "Workspace sidebar", sx: { left: sidebarDimensions.inset, top: sidebarDimensions.inset, bottom: sidebarDimensions.inset, height: "auto", width: (collapsed ? sidebarDimensions.compact : sidebarDimensions.expanded) - sidebarDimensions.inset * 2, overflow: "visible", border: `1px solid ${border}`, borderRadius: "21px", bgcolor: surface, color: foreground, "--sidebar-text-muted": muted, boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? .12 : .025)}`, transition: reduced ? "none" : `width ${sidebarTransition}` } } }}>
      <SidebarContent {...shared} compact={collapsed} onSearch={onSearch} />
      <Tooltip title={collapsed ? "Expand navigation" : "Collapse navigation"} placement="right">
        <IconButton aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={onToggle} aria-expanded={!collapsed}
          sx={{ position: "absolute", right: -13, top: 22, zIndex: 1, width: 26, height: 26, borderRadius: "50%", border: `1px solid ${border}`, bgcolor: surface, color: muted, boxShadow: `0 2px 6px ${alpha(theme.palette.common.black, .06)}`, "&:hover": { bgcolor: "background.paper", color: "primary.main" } }}>
          {collapsed ? <ChevronRight sx={{ fontSize: 16 }} /> : <ChevronLeft sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>
    </Drawer>
    <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} disableRestoreFocus={pendingMobileSearch.current} transitionDuration={reduced ? 0 : { enter: 240, exit: 180 }}
      slotProps={{
        paper: { id: "mobile-workspace-navigation", "aria-label": "Workspace navigation", sx: { width: sidebarDimensions.mobile, maxWidth: "calc(100vw - 24px)", border: `1px solid ${border}`, borderLeft: 0, borderRadius: "0 22px 22px 0", bgcolor: surface, color: foreground, "--sidebar-text-muted": muted } },
        transition: { onExited: () => { if (pendingMobileSearch.current) { pendingMobileSearch.current = false; onSearch(); } } },
      }} sx={{ display: { md: "none" } }}>
      <SidebarContent {...shared} mobile onSearch={() => { pendingMobileSearch.current = true; onMobileClose(); }} />
    </Drawer>
  </>;
}
