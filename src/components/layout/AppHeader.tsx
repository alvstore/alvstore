import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link: string | null;
  created_at: string;
}

const typeIcons: Record<string, string> = {
  repair: "🔧", payment: "💰", invoice: "📄", chat: "💬", info: "ℹ️",
};

const typeColors: Record<string, string> = {
  repair: "bg-warning/10 text-warning",
  payment: "bg-success/10 text-success",
  invoice: "bg-primary/10 text-primary",
  chat: "bg-accent/10 text-accent",
  info: "bg-info/10 text-info",
};

interface AppHeaderProps { onMobileMenuToggle?: () => void; }

export function AppHeader({ onMobileMenuToggle }: AppHeaderProps) {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const initials = user?.email?.slice(0, 2).toUpperCase() || "U";
  const displayName = user?.email?.split("@")[0] || "User";
  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setNotifications(data as Notification[]);
  };

  useEffect(() => { fetchNotifications(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new as Notification, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-card/95 backdrop-blur-sm px-4 md:px-5 shadow-[0_1px_0_hsl(var(--border)/0.5)]">
      {/* Mobile menu */}
      <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-8 w-8" onClick={onMobileMenuToggle}>
        <Menu className="h-4 w-4" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-lg">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1 flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-0 shadow-floating rounded-xl border-border/60">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-muted-foreground">{unreadCount} unread</p>
                )}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-primary hover:underline font-medium">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">All caught up!</p>
                </div>
              ) : notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0",
                    !n.read && "bg-primary/[0.03]"
                  )}
                >
                  <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5", typeColors[n.type] || "bg-muted text-muted-foreground")}>
                    {typeIcons[n.type] || "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[13px] leading-snug truncate", !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{n.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 pl-1.5 pr-2.5 rounded-lg">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-[13px] font-medium">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-floating rounded-xl border-border/60">
            <div className="px-3 py-2.5 border-b border-border/60">
              <p className="text-[13px] font-semibold truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="px-3 py-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {roles.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    <Zap className="h-2.5 w-2.5" />{r}
                  </span>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg m-1">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
