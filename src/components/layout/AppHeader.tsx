import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Bell, LogOut, Menu, Search, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";

interface AppHeaderProps { onMobileMenuToggle?: () => void; }

export function AppHeader({ onMobileMenuToggle }: AppHeaderProps) {
  const { user, signOut, roles } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "U";
  const displayName = user?.email?.split("@")[0] || "User";

  const fetchUnread = async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notification_feed")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setUnreadCount(count || 0);
  };

  useEffect(() => { fetchUnread(); }, [user]);

  // Poll for new notifications (replaces Supabase realtime subscription)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reset count when drawer closes
  const handleDrawerChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) fetchUnread();
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 md:px-6">
        <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onMobileMenuToggle}>
          <Menu className="h-4 w-4" />
        </Button>

        <div className="hidden md:flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5 w-72">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input type="text" placeholder="Search..." className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full" />
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {/* Theme Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/10">
                <Palette className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-2xl">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-semibold text-foreground">Theme</p>
              </div>
              {themes.map(t => (
                <DropdownMenuItem key={t.name} onClick={() => setTheme(t.name)} className="flex items-center gap-3 rounded-xl mx-1 cursor-pointer">
                  <div className="h-5 w-5 rounded-full border-2 shrink-0" style={{ backgroundColor: t.preview, borderColor: theme === t.name ? "hsl(var(--primary))" : "transparent" }} />
                  <span className="text-sm flex-1">{t.label}</span>
                  {theme === t.name && <Check className="h-3.5 w-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/10" onClick={() => setDrawerOpen(true)}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1 flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pl-1.5 pr-3 rounded-xl hover:bg-accent/10">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-[13px] font-medium text-foreground/80">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 shadow-floating rounded-2xl">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[13px] font-semibold truncate text-foreground">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <div className="px-3 py-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {roles.map(r => (
                    <span key={r} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r}</span>
                  ))}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl m-1">
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <NotificationDrawer open={drawerOpen} onOpenChange={handleDrawerChange} />
    </>
  );
}
