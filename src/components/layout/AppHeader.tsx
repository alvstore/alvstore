import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string; title: string; message: string; type: string;
  read: boolean; link: string | null; created_at: string;
}

const typeIcons: Record<string, string> = {
  repair: "🔧", payment: "💰", invoice: "📄", chat: "💬", info: "ℹ️",
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
      .from("notifications").select("*")
      .order("created_at", { ascending: false }).limit(20);
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/5 bg-[#080808]/80 backdrop-blur-xl px-4 md:px-6">
      {/* Mobile menu */}
      <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-8 w-8 text-zinc-400 hover:text-white" onClick={onMobileMenuToggle}>
        <Menu className="h-4 w-4" />
      </Button>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-[#121212] border border-white/5 rounded-xl px-3 py-1.5 w-72">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none w-full"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-purple-500 text-white text-[9px] font-bold px-1 flex items-center justify-center leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] p-0 shadow-floating rounded-2xl border-white/5 bg-[#121212]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div>
                <p className="text-sm font-semibold text-white">Notifications</p>
                {unreadCount > 0 && <p className="text-[11px] text-zinc-500">{unreadCount} unread</p>}
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-purple-400 hover:underline font-medium">Mark all read</button>
              )}
            </div>
            <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                  <p className="text-sm text-zinc-500">All caught up!</p>
                </div>
              ) : notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0",
                    !n.read && "bg-purple-500/5"
                  )}
                >
                  <span className="h-7 w-7 rounded-lg flex items-center justify-center text-sm shrink-0 mt-0.5 bg-white/5">
                    {typeIcons[n.type] || "📌"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[13px] leading-snug truncate", !n.read ? "font-semibold text-white" : "font-medium text-zinc-300")}>{n.title}</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-purple-500 shrink-0 mt-2" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 pl-1.5 pr-3 rounded-xl hover:bg-white/5">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-purple-700 text-white text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-[13px] font-medium text-zinc-300">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-floating rounded-2xl border-white/5 bg-[#121212]">
            <div className="px-3 py-2.5 border-b border-white/5">
              <p className="text-[13px] font-semibold truncate text-white">{displayName}</p>
              <p className="text-[11px] text-zinc-500 truncate">{user?.email}</p>
            </div>
            <div className="px-3 py-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {roles.map(r => (
                  <span key={r} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem onClick={signOut} className="text-red-400 focus:text-red-400 focus:bg-red-500/10 rounded-xl m-1">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
