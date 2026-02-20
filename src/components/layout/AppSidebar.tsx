import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, ShoppingCart, Monitor, Package,
  Wrench, Clock, CreditCard, BarChart3, FileText, Settings,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Home,
  Target, ClipboardList, Receipt, UserCog,
  Wallet, Shield, MessageCircle, CalendarDays, Zap,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem { title: string; url: string; icon: React.ComponentType<{ className?: string }>; badge?: string; }
interface NavCategory { label: string; items: NavItem[]; }

const adminStaffNav: NavCategory[] = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }] },
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
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Products", url: "/inventory", icon: Package },
      { title: "POS Terminal", url: "/pos", icon: Monitor },
      { title: "Barcodes", url: "/barcodes", icon: FileText },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard },
    ],
  },
  {
    label: "Repair",
    items: [{ title: "Job Sheets", url: "/repairs", icon: Wrench }],
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

interface AppSidebarProps { collapsed: boolean; onToggle: () => void; }

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { hasRole } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const navCategories = hasRole("customer")
    ? customerNav
    : hasRole("technician") && !hasRole("admin") && !hasRole("staff")
    ? technicianNav
    : adminStaffNav;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-expanded");
      if (saved) setExpandedCategories(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem("sidebar-expanded", JSON.stringify(next));
      return next;
    });
  };

  const isCategoryExpanded = (label: string) => expandedCategories[label] !== false;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border transition-all duration-300 ease-in-out flex flex-col",
        "bg-[hsl(var(--sidebar-background))]",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 border-b border-sidebar-border shrink-0 overflow-hidden",
        collapsed ? "justify-center px-2" : "px-5 gap-2.5"
      )}>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--sidebar-primary))] to-[hsl(var(--accent))] flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold text-[hsl(var(--sidebar-accent-foreground))] tracking-tight">ALVStore</span>
            <span className="text-[9px] font-medium text-[hsl(var(--sidebar-foreground))/0.45] tracking-widest uppercase">ERP 2026</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-0.5">
        {navCategories.map((category) => {
          const hasMultipleItems = category.items.length > 1;
          const expanded = isCategoryExpanded(category.label);

          return (
            <div key={category.label} className={collapsed ? "" : "px-3"}>
              {!collapsed && (
                hasMultipleItems ? (
                  <button
                    onClick={() => toggleCategory(category.label)}
                    className="w-full flex items-center justify-between py-1.5 px-1 mb-0.5 text-[9px] font-semibold tracking-[0.12em] text-[hsl(var(--sidebar-foreground))/0.38] uppercase hover:text-[hsl(var(--sidebar-foreground))/0.60] transition-colors"
                  >
                    <span>{category.label}</span>
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                ) : (
                  <p className="py-1.5 px-1 mb-0.5 text-[9px] font-semibold tracking-[0.12em] text-[hsl(var(--sidebar-foreground))/0.38] uppercase">
                    {category.label}
                  </p>
                )
              )}

              {(collapsed || !hasMultipleItems || expanded) && (
                <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center px-1.5")}>
                  {category.items.map((item) => (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === "/"}
                      className={cn(
                        "group flex items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                        collapsed
                          ? "h-9 w-9 justify-center text-[hsl(var(--sidebar-foreground))/0.55] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                          : "gap-2.5 px-2.5 py-2 w-full text-[hsl(var(--sidebar-foreground))/0.65] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]"
                      )}
                      activeClassName={cn(
                        "!text-[hsl(var(--sidebar-primary))] font-semibold",
                        collapsed
                          ? "bg-[hsl(var(--sidebar-primary))/0.15]"
                          : "bg-[hsl(var(--sidebar-primary))/0.12] shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
                      )}
                    >
                      <item.icon className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  ))}
                </div>
              )}

              {/* separator between categories */}
              {!collapsed && <div className="h-px bg-[hsl(var(--sidebar-border))/0.6] my-2 mx-1" />}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-11 border-t border-sidebar-border text-[hsl(var(--sidebar-foreground))/0.40] hover:text-[hsl(var(--sidebar-foreground))/0.80] hover:bg-[hsl(var(--sidebar-accent))] transition-all duration-150 shrink-0"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}
