"use client";

import { Box, Button, ButtonBase, Typography, Drawer, IconButton } from "@mui/material";
import { EmptyState, mergeSx } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X, CheckCheck, MessageCircle, CreditCard, Clock, Radio, UserCheck, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
interface NotificationItem {
    id: string;
    type: string;
    title: string;
    body: string | null;
    metadata: any;
    read_at: string | null;
    created_at: string;
}
const typeConfig = {
    whatsapp: { icon: MessageCircle, color: { color: "rgb(34 197 94 / 1)", backgroundColor: "rgb(34 197 94 / 0.1)" } },
    payment: { icon: CreditCard, color: { color: "rgb(59 130 246 / 1)", backgroundColor: "rgb(59 130 246 / 0.1)" } },
    payment_failed: { icon: AlertTriangle, color: { color: "rgb(239 68 68 / 1)", backgroundColor: "rgb(239 68 68 / 0.1)" } },
    attendance: { icon: Clock, color: { color: "rgb(249 115 22 / 1)", backgroundColor: "rgb(249 115 22 / 0.1)" } },
    hikvision: { icon: Radio, color: { color: "rgb(168 85 247 / 1)", backgroundColor: "rgb(168 85 247 / 0.1)" } },
    lead: { icon: UserCheck, color: { color: "rgb(6 182 212 / 1)", backgroundColor: "rgb(6 182 212 / 0.1)" } },
    repair: { icon: Bell, color: { color: "rgb(245 158 11 / 1)", backgroundColor: "rgb(245 158 11 / 0.1)" } },
    invoice: { icon: CreditCard, color: { color: "rgb(16 185 129 / 1)", backgroundColor: "rgb(16 185 129 / 0.1)" } },
    quotation: { icon: Bell, color: { color: "rgb(99 102 241 / 1)", backgroundColor: "rgb(99 102 241 / 0.1)" } },
    info: { icon: Bell, color: { color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--muted))" } },
};
function groupByDate(items: NotificationItem[]) {
    const today: NotificationItem[] = [];
    const yesterday: NotificationItem[] = [];
    const older: NotificationItem[] = [];
    items.forEach(item => {
        const d = new Date(item.created_at);
        if (isToday(d))
            today.push(item);
        else if (isYesterday(d))
            yesterday.push(item);
        else
            older.push(item);
    });
    return { today, yesterday, older };
}
export function NotificationDrawer({ open, onOpenChange }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const fetchNotifications = async () => {
        if (!user)
            return;
        const { data } = await supabase
            .from("notification_feed")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50);
        if (data)
            setNotifications(data as any);
    };
    useEffect(() => {
        if (open)
            fetchNotifications();
    }, [open, user]);
    // Poll for new notifications (replaces Supabase realtime subscription)
    useEffect(() => {
        if (!user || !open)
            return;
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, user]);
    const unreadCount = notifications.filter(n => !n.read_at).length;
    const markAllRead = async () => {
        if (!user)
            return;
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
        if (!n.read_at)
            await markRead(n.id);
        const meta = n.metadata || {};
        if (meta.link) {
            navigate(meta.link);
            onOpenChange(false);
        }
        else if (n.type === "whatsapp") {
            navigate("/chat");
            onOpenChange(false);
        }
        else if (n.type === "payment" || n.type === "invoice") {
            navigate("/invoices");
            onOpenChange(false);
        }
        else if (n.type === "lead") {
            navigate("/leads");
            onOpenChange(false);
        }
        else if (n.type === "repair") {
            navigate("/repairs");
            onOpenChange(false);
        }
    };
    const grouped = groupByDate(notifications);
    const renderGroup = (label: string, items: NotificationItem[]) => {
        if (items.length === 0)
            return null;
        return (<Box key={label}>
        <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>{label}</Typography>
        {items.map(n => {
                const config = typeConfig[n.type] || typeConfig.info;
                const Icon = config.icon;
                return (<ButtonBase key={n.id} onClick={() => handleClick(n)} type="button" sx={mergeSx({ width: "100%", textAlign: "left", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", display: "flex", gap: "0.75rem", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", borderBottomWidth: "1px", borderColor: "hsl(var(--border))", "&:last-child": { borderWidth: "0px" } }, !n.read_at && { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" })}>
              <Box component="span" sx={mergeSx({ height: "2rem", width: "2rem", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }, config.color)}>
                <Box component={Icon} sx={{ height: "1rem", width: "1rem" }}/>
              </Box>
              <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "13px", lineHeight: "1.375" }, !n.read_at ? { fontWeight: "600", color: "hsl(var(--foreground))" } : { fontWeight: "500", color: "color-mix(in srgb, hsl(var(--foreground)) 80%, transparent)" })}>{n.title}</Typography>
                {n.body && <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "0.125rem" }}>{n.body}</Typography>}
                <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 60%, transparent)", marginTop: "0.25rem" }}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</Typography>
              </Box>
              {!n.read_at && <Box sx={{ height: "0.5rem", width: "0.5rem", borderRadius: "9999px", backgroundColor: "hsl(var(--primary))", flexShrink: "0", marginTop: "0.5rem" }}/>}
            </ButtonBase>);
            })}
      </Box>);
    };
    return (<Drawer anchor="right" open={open} onClose={() => onOpenChange(false)} slotProps={{ paper: { sx: { width: 400, maxWidth: "100vw" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, pt: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Notifications {unreadCount > 0 && <Box component="span" sx={{ fontSize: 12, color: "text.secondary" }}>({unreadCount} unread)</Box>}</Typography>
        <IconButton aria-label="Close notifications" onClick={() => onOpenChange(false)}><Box component={X} sx={{ width: 18, height: 18 }} /></IconButton>
      </Box>
        <Box sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "1rem", paddingBottom: "0.75rem", borderBottomWidth: "1px", borderColor: "hsl(var(--border))", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>

          {unreadCount > 0 && (<Button onClick={markAllRead} variant="text" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
              <Box component={CheckCheck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Mark all read
            </Button>)}
        </Box>
        <Box sx={{ overflowY: "auto", maxHeight: "calc(100vh - 80px)" }}>
          {notifications.length === 0 ? (<EmptyState title="No notifications yet" icon={<Box component={Bell} sx={{ width: 40, height: 40 }} />} />) : (<>
              {renderGroup("Today", grouped.today)}
              {renderGroup("Yesterday", grouped.yesterday)}
              {renderGroup("Older", grouped.older)}
            </>)}
        </Box>
      </Drawer>);
}
