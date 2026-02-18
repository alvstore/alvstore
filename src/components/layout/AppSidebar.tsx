import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, ShoppingCart, Monitor, Package,
  Wrench, Clock, CreditCard, BarChart3, FileText, Settings,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Home,
  Target, ClipboardList, Receipt, ArrowRightLeft, UserCog,
  Wallet, Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavCategory {
  label: string;
  items: NavItem[];
  children?: NavItem[];
}

const adminStaffNav: NavCategory[] = [
  {
    label: "MAIN",
    items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { title: "Leads", url: "/leads", icon: Target },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "SALES",
    items: [
      { title: "Quotations", url: "/sales", icon: ShoppingCart },
      { title: "Invoices", url: "/invoices", icon: Receipt },
      { title: "Payments", url: "/finance", icon: Wallet },
    ],
  },
  {
    label: "ECOMMERCE",
    items: [
      { title: "Products", url: "/inventory", icon: Package },
      { title: "POS Terminal", url: "/pos", icon: Monitor },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { title: "Transactions", url: "/finance", icon: CreditCard },
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
    label: "REPAIR",
    items: [{ title: "Repair Management", url: "/repairs", icon: Wrench }],
  },
  {
    label: "TASKS",
    items: [{ title: "Task Management", url: "/tasks", icon: ClipboardList }],
  },
  {
    label: "REPORTS",
    items: [{ title: "Reports", url: "/reports", icon: BarChart3 }],
  },
  {
    label: "SYSTEM",
    items: [
      { title: "Audit Logs", url: "/audit-logs", icon: Shield },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

const customerNav: NavCategory[] = [
  { label: "MAIN", items: [
    { title: "My Portal", url: "/portal", icon: Home },
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];

const technicianNav: NavCategory[] = [
  { label: "MAIN", items: [
    { title: "My Repairs", url: "/technicians", icon: Wrench },
    { title: "My Tasks", url: "/tasks", icon: ClipboardList },
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { hasRole } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const navCategories = hasRole("customer")
    ? customerNav
    : hasRole("technician") && !hasRole("admin") && !hasRole("staff")
    ? technicianNav
    : adminStaffNav;

  // Initialize expanded state from localStorage
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

  const isCategoryExpanded = (label: string) => {
    return expandedCategories[label] !== false; // default open
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
            ERP<span className="text-sidebar-primary">Master</span>
          </span>
        )}
        {collapsed && (
          <span className="text-lg font-bold text-sidebar-primary mx-auto">E</span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-0.5">
        {navCategories.map((category) => {
          const hasMultipleItems = category.items.length > 1;
          const expanded = isCategoryExpanded(category.label);

          return (
            <div key={category.label}>
              {!collapsed && hasMultipleItems ? (
                <button
                  onClick={() => toggleCategory(category.label)}
                  className="w-full flex items-center justify-between px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase hover:text-sidebar-foreground/60 transition-colors"
                >
                  <span>{category.label}</span>
                  {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              ) : !collapsed ? (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase">
                  {category.label}
                </p>
              ) : (
                <div className="h-3" />
              )}

              {(collapsed || !hasMultipleItems || expanded) && (
                <div className="space-y-0.5">
                  {category.items.map((item) => (
                    <NavLink
                      key={item.url}
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors shrink-0"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
