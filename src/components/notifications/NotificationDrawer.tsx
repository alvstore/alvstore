import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X, CheckCheck, MessageCircle, CreditCard, Clock, Radio, UserCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: any;
  read_at: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: any; color: string }> = {
  whatsapp: { icon: MessageCircle, color: "text-green-500 bg-green-500/10" },
  payment: { icon: CreditCard, color: "text-blue-500 bg-blue-500/10" },
  payment_failed: { icon: AlertTriangle, color: "text-red-500 bg-red-500/10" },
  attendance: { icon: Clock, color: "text-orange-500 bg-orange-500/10" },
  hikvision: { icon: Radio, color: "text-purple-500 bg-purple-500/10" },
  lead: { icon: UserCheck, color: "text-cyan-500 bg-cyan-500/10" },
  repair: { icon: Bell, color: "text-amber-500 bg-amber-500/10" },
  invoice: { icon: CreditCard, color: "text-emerald-500 bg-emerald-500/10" },
  quotation: { icon: Bell, color: "text-indigo-500 bg-indigo-500/10" },
  info: { icon: Bell, color: "text-muted-foreground bg-muted" },
};

function groupByDate(items: NotificationItem[]) {
  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const older: NotificationItem[] = [];

  items.forEach(item => {
    const d = new Date(item.created_at);
    if (isToday(d)) today.push(item);
    else if (isYesterday(d)) yesterday.push(item);
    else older.push(item);
  });

  return { today, yesterday, older };
}

export function NotificationDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_feed")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as any);
  };

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-feed-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_feed", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new as any, ...prev]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase.from("notification_feed").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
  };

  const markRead = async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from("notification_feed").update({ read_at: now }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.read_at) await markRead(n.id);
    const meta = n.metadata || {};
    if (meta.link) { navigate(meta.link); onOpenChange(false); }
    else if (n.type === "whatsapp") { navigate("/chat"); onOpenChange(false); }
    else if (n.type === "payment" || n.type === "invoice") { navigate("/invoices"); onOpenChange(false); }
    else if (n.type === "lead") { navigate("/leads"); onOpenChange(false); }
    else if (n.type === "repair") { navigate("/repairs"); onOpenChange(false); }
  };

  const grouped = groupByDate(notifications);

  const renderGroup = (label: string, items: NotificationItem[]) => {
    if (items.length === 0) return null;
    return (
      <div key={label}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2 bg-muted/30">{label}</p>
        {items.map(n => {
          const config = typeConfig[n.type] || typeConfig.info;
          const Icon = config.icon;
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/10 transition-colors border-b border-border last:border-0",
                !n.read_at && "bg-primary/5"
              )}
            >
              <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", config.color)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className={cn("text-[13px] leading-snug", !n.read_at ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>{n.title}</p>
                {n.body && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
              </div>
              {!n.read_at && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border flex flex-row items-center justify-between">
          <SheetTitle className="text-base">
            Notifications
            {unreadCount > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({unreadCount} unread)</span>}
          </SheetTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3 mr-1" /> Mark all read
            </Button>
          )}
        </SheetHeader>
        <div className="overflow-y-auto max-h-[calc(100vh-80px)]">
          {notifications.length === 0 ? (
            <div className="py-16 text-center">
              <Bell className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <>
              {renderGroup("Today", grouped.today)}
              {renderGroup("Yesterday", grouped.yesterday)}
              {renderGroup("Older", grouped.older)}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
