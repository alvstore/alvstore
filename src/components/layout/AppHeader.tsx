"use client";

import { useState, useEffect, useCallback, type Ref } from "react";
import { AppBar, Avatar, Badge, Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Toolbar, Tooltip, Typography } from "@mui/material";
import { Check, Logout, Menu as MenuIcon, NotificationsOutlined, PaletteOutlined } from "@mui/icons-material";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { StatusChip } from "@/components/mui";
import { CommandPalette, type CommandPaletteProps } from "./CommandPalette";

interface AppHeaderProps {
  onMobileMenuToggle: () => void;
  mobileNavigationOpen: boolean;
  mobileMenuRef: Ref<HTMLButtonElement>;
  searchOpen: boolean;
  onSearchOpenChange: CommandPaletteProps["onOpenChange"];
}

export function AppHeader({ onMobileMenuToggle, mobileNavigationOpen, mobileMenuRef, searchOpen, onSearchOpenChange }: AppHeaderProps) {
  const { user, signOut, roles } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);
  const rawAvatar = user?.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatar === "string" && rawAvatar.trim() ? rawAvatar.trim() : undefined;
  const rawName = user?.user_metadata?.full_name;
  const displayName = typeof rawName === "string" && rawName.trim() ? rawName.trim() : user?.email?.split("@")[0] || "User";
  const initials = displayName.split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "U";
  const fetchUnread = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase.from("notification_feed").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
    setUnreadCount(count || 0);
  }, [user]);
  useEffect(() => {
    void fetchUnread();
    if (!user) return;
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user, fetchUnread]);
  return <>
    <AppBar position="sticky" color="transparent" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", backdropFilter: "blur(20px)" }}>
      <Toolbar sx={{ gap: 1.5, minHeight: "64px !important" }}>
        <IconButton ref={mobileMenuRef} aria-label="Open navigation" aria-expanded={mobileNavigationOpen} aria-controls="mobile-workspace-navigation" onClick={onMobileMenuToggle} sx={{ display: { md: "none" } }}><MenuIcon /></IconButton>
        <CommandPalette open={searchOpen} onOpenChange={onSearchOpenChange} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Change theme"><IconButton aria-label="Change theme" aria-haspopup="menu" aria-expanded={!!themeAnchor} onClick={event => setThemeAnchor(event.currentTarget)}><PaletteOutlined fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Notifications"><IconButton aria-label={`Notifications, ${unreadCount} unread`} onClick={() => setDrawerOpen(true)}><Badge badgeContent={unreadCount} color="primary" max={9}><NotificationsOutlined fontSize="small" /></Badge></IconButton></Tooltip>
        <Tooltip title="Account"><IconButton aria-label="Open account menu" aria-haspopup="menu" aria-expanded={!!userAnchor} onClick={event => setUserAnchor(event.currentTarget)} sx={{ gap: 1, borderRadius: 2 }}>
          <Avatar src={avatarUrl} alt={displayName} sx={{ height: 30, width: 30, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 11 }}>{initials}</Avatar>
          <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>{displayName}</Typography>
        </IconButton></Tooltip>
      </Toolbar>
    </AppBar>
    <Menu anchorEl={themeAnchor} open={!!themeAnchor} onClose={() => setThemeAnchor(null)}>
      {themes.map(t => <MenuItem key={t.name} selected={theme === t.name} onClick={() => { setTheme(t.name); setThemeAnchor(null); }} sx={{ minWidth: 200, gap: 1.5 }}>
        <Box sx={{ width: 18, height: 18, borderRadius: "50%", bgcolor: t.preview, border: 1, borderColor: "divider" }} /><Typography variant="body2" sx={{ flex: 1 }}>{t.label}</Typography>{theme === t.name && <Check fontSize="small" />}
      </MenuItem>)}
    </Menu>
    <Menu anchorEl={userAnchor} open={!!userAnchor} onClose={() => setUserAnchor(null)}>
      <Box sx={{ px: 2, py: 1, maxWidth: 260 }}><Typography variant="subtitle2">{displayName}</Typography><Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1 }}>{roles.map(role => <StatusChip key={role} status={role} />)}</Box>
      </Box><Divider />
      <MenuItem onClick={() => { setUserAnchor(null); void signOut(); }} sx={{ color: "error.main" }}><ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>Sign out</MenuItem>
    </Menu>
    <NotificationDrawer open={drawerOpen} onOpenChange={open => { setDrawerOpen(open); if (!open) void fetchUnread(); }} />
  </>;
}
