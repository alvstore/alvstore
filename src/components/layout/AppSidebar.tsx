import {
  LayoutDashboard, Users, ShoppingCart, Monitor, Package,
  Wrench, Clock, CreditCard, BarChart3, UserCheck,
  UserCog, FileText, Settings, ChevronLeft, ChevronRight, Home,
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
}

const adminStaffNav: NavCategory[] = [
  {
    label: "MAIN",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "BUSINESS",
    items: [
      { title: "CRM", url: "/crm", icon: Users },
      { title: "Sales", url: "/sales", icon: ShoppingCart },
      { title: "POS", url: "/pos", icon: Monitor },
      { title: "Inventory", url: "/inventory", icon: Package },
    ],
  },
  {
    label: "SERVICE",
    items: [
      { title: "Repair Management", url: "/repairs", icon: Wrench },
      { title: "Customers", url: "/customers", icon: Users },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { title: "Attendance", url: "/attendance", icon: Clock },
      { title: "Finance", url: "/finance", icon: CreditCard },
      { title: "Reports", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "TEAM",
    items: [
      { title: "Technicians", url: "/technicians", icon: UserCheck },
      { title: "Staff", url: "/staff", icon: UserCog },
    ],
  },
  {
    label: "SYSTEM",
    items: [
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
    { title: "Settings", url: "/settings", icon: Settings },
  ]},
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { hasRole } = useAuth();

  const navCategories = hasRole("customer")
    ? customerNav
    : hasRole("technician") && !hasRole("admin") && !hasRole("staff")
    ? technicianNav
    : adminStaffNav;

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
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 space-y-1">
        {navCategories.map((category) => (
          <div key={category.label}>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase">
                {category.label}
              </p>
            )}
            {collapsed && <div className="h-3" />}
            <div className="space-y-0.5">
              {category.items.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-medium"
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
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
