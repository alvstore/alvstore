"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Divider,
  FormLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Tab,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme as useMuiTheme } from "@mui/material/styles";
import {
  AnimatedPage,
  DataTable,
  PageHeader,
  SideDrawer,
  StatusChip,
  TabBar,
  TabView,
  confirmAction,
  mergeSx,
  toast,
} from "@/components/mui";
import { getBackendAuthHeaders, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { primaryUserRole, sidebarRoleLabel, type AppRole } from "@/lib/sidebar-state";
import { AvatarUpload } from "@/components/AvatarUpload";
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Code,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  File,
  FileText,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Palette,
  Pencil,
  Phone,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  Smartphone,
  TestTube,
  Trash2,
  Unplug,
  Upload,
  User,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface UserWithRole {
  profile: Profile;
  email: string | null;
  role: AppRole;
  employee?: EmployeeLink | null;
}

interface EmployeeLink {
  id: string;
  name: string;
  designation: string | null;
  role: string | null;
}

interface SettingsSection {
  id: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ size?: number }>;
  group: "Account" | "Workspace" | "Integrations";
  adminOnly?: boolean;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "profile", label: "Profile", keywords: "avatar photo name password security account", icon: User, group: "Account" },
  { id: "appearance", label: "Appearance", keywords: "theme dark light palette obsidian sidebar compact", icon: Palette, group: "Account" },
  { id: "business", label: "Business Info", keywords: "company logo bank upi ifsc address branding", icon: Building2, group: "Workspace", adminOnly: true },
  { id: "users", label: "User Management", keywords: "team staff roles permissions login invite", icon: Shield, group: "Workspace", adminOnly: true },
  { id: "gst", label: "GST Settings", keywords: "tax gstin cgst sgst igst hsn", icon: Receipt, group: "Workspace", adminOnly: true },
  { id: "documents", label: "Document Settings", keywords: "invoice quotation challan prefix terms", icon: FileText, group: "Workspace", adminOnly: true },
  { id: "service-categories", label: "Service Categories", keywords: "repair jobs pricing rates charges", icon: Wrench, group: "Workspace", adminOnly: true },
  { id: "templates", label: "Templates", keywords: "email whatsapp sms message placeholders", icon: File, group: "Workspace", adminOnly: true },
  { id: "email", label: "Email / SMTP", keywords: "smtp host mail password test", icon: Mail, group: "Integrations", adminOnly: true },
  { id: "sms", label: "SMS Gateway", keywords: "msg91 text sms sender api", icon: MessageSquare, group: "Integrations", adminOnly: true },
  { id: "whatsapp", label: "WhatsApp", keywords: "meta whatsapp business automation", icon: Phone, group: "Integrations", adminOnly: true },
  { id: "razorpay", label: "Razorpay", keywords: "payment link webhook secret key", icon: CreditCard, group: "Integrations", adminOnly: true },
  { id: "hikvision", label: "Hikvision", keywords: "biometric attendance punch device sync", icon: Camera, group: "Integrations", adminOnly: true },
];

function CardSectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ComponentType<{ size?: number }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        px: 3,
        pt: 2.5,
        pb: 1.5,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="h6"
          component="h3"
          sx={{
            fontSize: "1rem",
            fontWeight: 650,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {Icon && <Box component={Icon} sx={{ width: 18, height: 18, color: "primary.main", flexShrink: 0 }} />}
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}

async function uploadStorageImage(folder: string, prefix: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5MB");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file (PNG, JPG, or WebP)");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "") || "file";
  const storagePath = `${folder}/${safePrefix}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("uploads").upload(storagePath, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("uploads").getPublicUrl(storagePath);
  return data.publicUrl;
}

export default function Settings() {
  const { user, roles, hasRole, refreshUserMetadata } = useAuth();
  const { currentTheme } = useTheme();
  const muiTheme = useMuiTheme();
  const isAdmin = hasRole("admin");
  const roleLabel = sidebarRoleLabel(roles);
  const [activeSection, setActiveSection] = useState("profile");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const heroFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
    const metaAvatar = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
    if (metaName) setFullName((prev) => prev || metaName);
    if (metaAvatar) setAvatarUrl((prev) => prev || metaAvatar);

    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        const row = data?.[0];
        if (row) {
          setFullName(row.full_name || metaName || "");
          setPhone(row.phone || "");
          setAvatarUrl(row.avatar_url || metaAvatar || null);
        }
      });
  }, [user]);

  const persistProfileRow = useCallback(
    async (patch: Partial<{ full_name: string | null; phone: string | null; avatar_url: string | null }>) => {
      if (!user) return;
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (existing && existing.length > 0) {
        const { error } = await supabase.from("profiles").update(patch).eq("user_id", user.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("profiles").insert({
          user_id: user.id,
          full_name: fullName || null,
          phone: phone || null,
          avatar_url: avatarUrl,
          ...patch,
        });
        if (error) throw new Error(error.message);
      }
    },
    [user, fullName, phone, avatarUrl]
  );

  const handleAvatarUploaded = useCallback(
    async (url: string) => {
      setAvatarUrl(url);
      try {
        await persistProfileRow({ avatar_url: url });
        await refreshUserMetadata({ full_name: fullName || undefined, avatar_url: url });
      } catch (err) {
        toast.error((err as Error).message || "Failed to save avatar");
      }
    },
    [persistProfileRow, refreshUserMetadata, fullName]
  );

  const handleHeroFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadStorageImage("profiles", user.id, file);
      await handleAvatarUploaded(publicUrl);
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error((err as Error).message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
      if (heroFileRef.current) heroFileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      await persistProfileRow({ avatar_url: null });
      setAvatarUrl(null);
      await refreshUserMetadata({ full_name: fullName || undefined, avatar_url: null });
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error((err as Error).message || "Failed to remove photo");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const trimmedName = fullName.trim();
      await persistProfileRow({ full_name: trimmedName, phone: phone.trim() || null, avatar_url: avatarUrl });
      await refreshUserMetadata({ full_name: trimmedName, avatar_url: avatarUrl });
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const visibleSections = SETTINGS_SECTIONS.filter((s) => !s.adminOnly || isAdmin);
  const [navQuery, setNavQuery] = useState("");
  const [sectionStatus, setSectionStatus] = useState<Record<string, boolean>>({});
  const filteredSections = visibleSections.filter((s) => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return true;
    return s.label.toLowerCase().includes(q) || s.keywords.includes(q) || s.group.toLowerCase().includes(q);
  });
  const groups = [...new Set(filteredSections.map((s) => s.group))];

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("business_settings").select("company_name, gst_number, whatsapp_phone_id, integrations").limit(1).maybeSingle(),
      supabase.from("hikvision_devices").select("id", { count: "exact", head: true }),
    ]).then(([bsRes, hikRes]) => {
      const bs = bsRes.data as any;
      const integ = (bs?.integrations || {}) as Record<string, unknown>;
      setSectionStatus({
        business: Boolean(bs?.company_name),
        gst: Boolean(bs?.gst_number),
        email: Boolean(integ.smtp_host && integ.smtp_user),
        sms: Boolean(integ.sms_api_key || integ.msg91_auth_key),
        whatsapp: Boolean(
          integ.whatsapp_gateway_url ||
            bs?.whatsapp_phone_id ||
            integ.whatsapp_phone_id ||
            integ.whatsapp_token
        ),
        razorpay: Boolean(integ.razorpay_key_id),
        hikvision: Boolean((hikRes.count || 0) > 0 || integ.hik_partner_app_key || integ.hikvision_app_key),
      });
    });
  }, [isAdmin, activeSection]);

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <ProfileTab
            user={user}
            roleLabel={roleLabel}
            fullName={fullName}
            setFullName={setFullName}
            phone={phone}
            setPhone={setPhone}
            avatarUrl={avatarUrl}
            saving={savingProfile}
            uploadingAvatar={uploadingAvatar}
            heroFileRef={heroFileRef}
            onHeroFileSelected={handleHeroFileSelected}
            onAvatarUploaded={handleAvatarUploaded}
            onPickAvatar={() => heroFileRef.current?.click()}
            onRemoveAvatar={removeAvatar}
            onSaveProfile={saveProfile}
          />
        );
      case "appearance":
        return <AppearanceTab />;
      case "users":
        return isAdmin ? <UsersTab /> : null;
      case "business":
        return isAdmin ? <BusinessTab /> : null;
      case "gst":
        return isAdmin ? <GSTTab /> : null;
      case "documents":
        return isAdmin ? <DocumentSettingsTab /> : null;
      case "email":
        return isAdmin ? <EmailTab defaultTestEmail={user?.email || ""} /> : null;
      case "sms":
        return isAdmin ? <SMSTab /> : null;
      case "whatsapp":
        return isAdmin ? <WhatsAppTab /> : null;
      case "razorpay":
        return isAdmin ? <RazorpayTab /> : null;
      case "hikvision":
        return isAdmin ? <HikvisionTab /> : null;
      case "templates":
        return isAdmin ? <TemplatesTab /> : null;
      case "service-categories":
        return isAdmin ? <ServiceCategoriesTab /> : null;
      default:
        return null;
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ maxWidth: "78rem", display: "grid", gap: 2.5, minWidth: 0 }}>
        <PageHeader
          title="Settings"
          subtitle="Manage your account preferences, workspace identity, tax configuration, and connected services"
          actions={
            <Box
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                alignItems: "center",
                gap: 1.25,
                px: 1.5,
                py: 0.75,
                borderRadius: 99,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: alpha(muiTheme.palette.background.paper, 0.7),
              }}
            >
              <Avatar
                src={avatarUrl ?? undefined}
                alt={fullName || "User"}
                sx={{
                  width: 24,
                  height: 24,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  bgcolor: alpha(muiTheme.palette.primary.main, 0.16),
                  color: muiTheme.palette.primary.main,
                }}
              >
                {(fullName || user?.email || "U")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </Avatar>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {fullName || user?.email?.split("@")[0] || "Account"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                · {currentTheme.label}
              </Typography>
            </Box>
          }
        />

        {/* 2026 Split Console Grid: Sticky Rail + Open Hairline Workspace */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "252px minmax(0, 1fr)" },
            gap: { xs: 2, md: 3.5 },
            alignItems: "start",
            minWidth: 0,
          }}
        >
          {/* Sticky Desktop Index Rail & Compact Mobile Rail */}
          <Card
            sx={{
              position: { md: "sticky" },
              top: { md: 20 },
              p: { xs: 1.25, md: 1.5 },
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <TextField
              size="small"
              fullWidth
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Filter settings..."
              slotProps={{
                htmlInput: { "aria-label": "Filter settings" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box component={Search} sx={{ width: 14, height: 14, color: "text.secondary" }} />
                    </InputAdornment>
                  ),
                  endAdornment: navQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label="Clear settings filter" onClick={() => setNavQuery("")}>
                        <X size={13} />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                },
              }}
              sx={{ mb: { xs: 1.25, md: 1.75 } }}
            />

            <Box
              sx={{
                display: { xs: "flex", md: "grid" },
                gap: { xs: 0.75, md: 1.75 },
                overflowX: { xs: "auto", md: "visible" },
                pb: { xs: 0.5, md: 0 },
                scrollbarWidth: "thin",
              }}
            >
              {groups.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 1.5 }}>
                  No matching sections
                </Typography>
              ) : (
                groups.map((group) => (
                  <Box
                    key={group}
                    sx={{
                      display: { xs: "flex", md: "grid" },
                      gap: { xs: 0.75, md: 0.35 },
                      flexShrink: 0,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        px: 1.25,
                        pb: 0.35,
                        fontSize: "10px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        display: { xs: "none", md: "block" },
                      }}
                    >
                      {group}
                    </Typography>
                    {filteredSections
                      .filter((s) => s.group === group)
                      .map((section) => {
                        const Icon = section.icon;
                        const selected = activeSection === section.id;
                        const configured = sectionStatus[section.id];
                        return (
                          <Button
                            key={section.id}
                            type="button"
                            size="small"
                            fullWidth={false}
                            variant={selected ? "contained" : "text"}
                            color={selected ? "primary" : "inherit"}
                            onClick={() => setActiveSection(section.id)}
                            startIcon={<Icon size={15} />}
                            endIcon={
                              configured !== undefined && !selected ? (
                                <Box
                                  component="span"
                                  aria-hidden="true"
                                  sx={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    bgcolor: configured ? "success.main" : alpha(muiTheme.palette.text.disabled, 0.35),
                                    display: "inline-block",
                                  }}
                                />
                              ) : undefined
                            }
                            sx={{
                              justifyContent: { xs: "center", md: "space-between" },
                              textAlign: "left",
                              flexShrink: 0,
                              whiteSpace: "nowrap",
                              px: 1.5,
                              py: 0.75,
                              minHeight: 35,
                              width: { md: "100%" },
                              color: selected ? undefined : "text.secondary",
                              bgcolor: selected ? undefined : "transparent",
                              "& .MuiButton-startIcon": { mr: 1 },
                              "& .MuiButton-endIcon": { ml: "auto" },
                              "&:hover": selected
                                ? undefined
                                : { bgcolor: alpha(muiTheme.palette.primary.main, 0.06), color: "text.primary" },
                            }}
                          >
                            {section.label}
                          </Button>
                        );
                      })}
                  </Box>
                ))
              )}
            </Box>
          </Card>

          {/* Active Settings Workspace */}
          <Box sx={{ minWidth: 0, maxWidth: "56rem" }}>{renderContent()}</Box>
        </Box>
      </Box>
    </AnimatedPage>
  );
}

// ─── Profile & Security Tab (Unified Single-Avatar Identity Panel) ───────────────
function ProfileTab({
  user,
  roleLabel,
  fullName,
  setFullName,
  phone,
  setPhone,
  avatarUrl,
  saving,
  uploadingAvatar,
  heroFileRef,
  onHeroFileSelected,
  onAvatarUploaded,
  onPickAvatar,
  onRemoveAvatar,
  onSaveProfile,
}: {
  user: { id: string; email: string } | null;
  roleLabel: string;
  fullName: string;
  setFullName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  avatarUrl: string | null;
  saving: boolean;
  uploadingAvatar: boolean;
  heroFileRef: React.RefObject<HTMLInputElement | null>;
  onHeroFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onAvatarUploaded: (url: string) => Promise<void>;
  onPickAvatar: () => void;
  onRemoveAvatar: () => Promise<void>;
  onSaveProfile: () => Promise<void>;
}) {
  const muiTheme = useMuiTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);

  const changePassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setUpdatingPwd(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPassword("");
      setConfirmPassword("");
    }
    setUpdatingPwd(false);
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, display: "grid", gap: 3 }}>
        {/* Unified Profile Identity & Avatar Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2.25, minWidth: 0 }}>
            <Box
              ref={heroFileRef}
              component="input"
              type="file"
              accept="image/*"
              onChange={onHeroFileSelected}
              sx={{ display: "none" }}
            />
            <AvatarUpload
              currentUrl={avatarUrl}
              name={fullName || user?.email || "User"}
              folder="profiles"
              entityId={user?.id}
              size="lg"
              onUploaded={onAvatarUploaded}
            />
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }} noWrap>
                  {fullName || user?.email?.split("@")[0] || "Workspace Account"}
                </Typography>
                <StatusChip label={roleLabel} size="small" color="primary" variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user?.email || "Signed in account"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                PNG, JPG, or WebP up to 5 MB · Synced across header, sidebar, and audit trail
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={uploadingAvatar || saving}
              onClick={onPickAvatar}
              startIcon={
                uploadingAvatar ? (
                  <Box component={Loader2} sx={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
                ) : (
                  <Upload size={15} />
                )
              }
            >
              {avatarUrl ? "Change Photo" : "Upload Photo"}
            </Button>
            {avatarUrl && (
              <Button
                size="small"
                variant="text"
                color="error"
                disabled={saving || uploadingAvatar}
                onClick={onRemoveAvatar}
              >
                Remove Photo
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Identity Fields */}
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
              Personal Details
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Display name and contact number shown on Quotations, Invoices, and Financial Audit entries
            </Typography>
          </Box>
          <TextField value={user?.email || ""} disabled label="Account Email" size="small" fullWidth />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              label="Full Name"
              size="small"
              fullWidth
            />
            <TextField
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              label="Phone Number"
              placeholder="+91 98..."
              size="small"
              fullWidth
            />
          </Box>
          <Box>
            <Button onClick={onSaveProfile} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Password & Access */}
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
                Password & Security
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Signed in with {roleLabel} permissions
              </Typography>
            </Box>
            <StatusChip
              label={roleLabel}
              size="small"
              sx={{
                bgcolor: alpha(muiTheme.palette.primary.main, 0.08),
                color: muiTheme.palette.primary.main,
              }}
            />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="New Password"
              size="small"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={showPwd ? "Hide password" : "Show password"}
                        onClick={() => setShowPwd((p) => !p)}
                        edge="end"
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              type={showPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              label="Confirm New Password"
              size="small"
              fullWidth
              error={Boolean(confirmPassword && password !== confirmPassword)}
              helperText={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
            />
          </Box>
          <Box>
            <Button
              onClick={changePassword}
              disabled={updatingPwd || !password}
              variant="outlined"
              startIcon={<Shield size={15} />}
            >
              {updatingPwd ? "Updating..." : "Update Password"}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Appearance & Workspace Preferences Tab ─────────────────────
function AppearanceTab() {
  const { theme, setTheme, themes } = useTheme();
  const muiTheme = useMuiTheme();
  const [sidebarCompact, setSidebarCompact] = useState(false);

  useEffect(() => {
    try {
      setSidebarCompact(localStorage.getItem("sidebarCollapsed") === "true");
    } catch {
      // ignore storage access issues
    }
  }, []);

  const toggleCompactSidebar = (checked: boolean) => {
    setSidebarCompact(checked);
    try {
      localStorage.setItem("sidebarCollapsed", String(checked));
      window.dispatchEvent(new Event("alv-sidebar-collapsed"));
    } catch {
      // ignore storage errors
    }
    toast.success(checked ? "Compact navigation rail enabled" : "Expanded navigation rail enabled");
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 }, display: "grid", gap: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
            <Box component={Palette} sx={{ width: 18, height: 18, color: "primary.main" }} />
            Console Color Palette
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            Switch live between Obsidian Dark and curated light/accent workspaces
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
            gap: 1.5,
          }}
        >
          {themes.map((t) => {
            const selected = theme === t.name;
            const bgColor = t.isDark ? "#0d0e12" : "#f7f8fa";
            const surfaceColor = t.isDark ? "#171820" : "#ffffff";
            return (
              <ButtonBase
                key={t.name}
                type="button"
                onClick={() => setTheme(t.name)}
                aria-pressed={selected}
                sx={{
                  p: 1.5,
                  borderRadius: 2.5,
                  border: "2px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: selected ? alpha(muiTheme.palette.primary.main, 0.08) : "background.paper",
                  display: "grid",
                  gap: 1.25,
                  textAlign: "left",
                  transition: "border-color 150ms ease, background-color 150ms ease",
                  "&:hover": { borderColor: "primary.main" },
                }}
              >
                {/* Live Mini Workspace Preview Bar */}
                <Box
                  aria-hidden="true"
                  sx={{
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: bgColor,
                    border: "1px solid",
                    borderColor: alpha(t.isDark ? "#ffffff" : "#000000", 0.1),
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 0.75,
                  }}
                >
                  <Box sx={{ width: 14, height: "100%", borderRadius: 0.75, bgcolor: surfaceColor, opacity: 0.9 }} />
                  <Box sx={{ flex: 1, display: "grid", gap: 0.4 }}>
                    <Box sx={{ width: "55%", height: 4, borderRadius: 2, bgcolor: t.preview }} />
                    <Box sx={{ width: "80%", height: 3, borderRadius: 2, bgcolor: alpha(t.isDark ? "#ffffff" : "#000000", 0.16) }} />
                  </Box>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: t.preview }} />
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 650 }} noWrap>
                      {t.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.isDark ? "Dark mode" : "Light mode"}
                    </Typography>
                  </Box>
                  {selected && <Box component={Check} sx={{ width: 16, height: 16, color: "primary.main", flexShrink: 0 }} />}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>

        <Divider />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 650 }}>
              Workspace Behavior — Compact Navigation Sidebar
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Collapse the desktop sidebar to an 88px icon rail with quick tooltips
            </Typography>
          </Box>
          <Switch
            checked={sidebarCompact}
            onChange={(_, checked) => toggleCompactSidebar(checked)}
            slotProps={{ input: { "aria-label": "Compact Navigation Sidebar" } }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "staff" as AppRole,
    password: "",
  });

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, employeesRes, authUsersRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("employees").select("id, name, designation, role, user_id"),
      fetch("/api/backend/auth/users", { headers: getBackendAuthHeaders() })
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .catch(() => ({ users: [] })),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];
    const employees = employeesRes.data || [];
    const authUsers: Array<{ id: string; email?: string | null }> = authUsersRes?.users || [];
    const emailById = new Map(authUsers.map((u) => [u.id, u.email || null]));

    setUsers(
      profiles.map((p) => {
        const emp = employees.find((e) => e.user_id === p.user_id);
        const userRoles = roles.filter((r) => r.user_id === p.user_id).map((r) => r.role);
        return {
          profile: p,
          email: emailById.get(p.user_id) || null,
          role: primaryUserRole(userRoles),
          employee: emp ? { id: emp.id, name: emp.name, designation: emp.designation, role: emp.role } : null,
        };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const updateRole = async (userId: string, newRole: AppRole) => {
    setUpdatingUserId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("manage-staff", {
        body: { action: "update", user_id: userId, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Role updated");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const createUser = async () => {
    if (!newUser.full_name.trim() || !newUser.email.trim() || newUser.password.length < 6) {
      toast.error("Name, email, and a password of at least 6 characters are required");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-staff", {
        body: {
          action: "create",
          full_name: newUser.full_name.trim(),
          email: newUser.email.trim(),
          phone: newUser.phone.trim() || undefined,
          role: newUser.role,
          password: newUser.password,
        },
      });
      if (error) throw error;
      if (data?.error || !data?.success) throw new Error(data?.error || "Failed to create user");
      toast.success(`Created account for ${newUser.full_name.trim()}`);
      setAddOpen(false);
      setNewUser({ full_name: "", email: "", phone: "", role: "staff", password: "" });
      await fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const roleColors = {
    admin: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
    staff: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    technician: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    customer: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  };

  return (
    <Card>
      <CardSectionHeader
        icon={Shield}
        title="User Management"
        subtitle="Manage team accounts, roles, and HR links"
        action={
          <Button size="small" variant="contained" startIcon={<UserPlus size={15} />} onClick={() => setAddOpen(true)}>
            Add User
          </Button>
        }
      />
      <CardContent sx={{ px: 3, pb: 3 }}>
        {loading ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Loading users...
          </Typography>
        ) : (
          <DataTable columnsCount={5}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Auth Role</TableCell>
                <TableCell>Employee Link</TableCell>
                <TableCell>Change Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const label = u.profile.full_name || u.email || "User";
                const initials = label.slice(0, 2).toUpperCase();
                return (
                  <TableRow key={u.profile.user_id}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar src={u.profile.avatar_url ?? undefined} alt={label} sx={{ width: 32, height: 32, fontSize: 11 }}>
                          {initials}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {u.profile.full_name || "—"}
                          </Typography>
                          {u.email && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {u.email}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{u.profile.phone || "—"}</TableCell>
                    <TableCell>
                      <StatusChip label={u.role} sx={roleColors[u.role]} />
                    </TableCell>
                    <TableCell>
                      {u.employee ? (
                        <Box sx={{ fontSize: "0.75rem" }}>
                          <Box component="span" sx={{ fontWeight: 500 }}>
                            {u.employee.designation || u.employee.role || "Employee"}
                          </Box>
                          <Box component="span" sx={{ color: "text.secondary", ml: 0.5 }}>
                            ({u.employee.name})
                          </Box>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          Not linked
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={u.role}
                        disabled={updatingUserId === u.profile.user_id}
                        select
                        size="small"
                        onChange={(e) => void updateRole(u.profile.user_id, e.target.value as AppRole)}
                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                        sx={{ width: 140 }}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="staff">Staff</MenuItem>
                        <MenuItem value="technician">Technician</MenuItem>
                        <MenuItem value="customer">Customer</MenuItem>
                      </TextField>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        )}
      </CardContent>

      <SideDrawer
        open={addOpen}
        onClose={() => !creating && setAddOpen(false)}
        title="Add Team Member"
        description="Create a workspace login and assign an access role"
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void createUser()} disabled={creating}>
              {creating ? "Creating..." : "Create Account"}
            </Button>
          </>
        }
      >
        <Stack spacing={2}>
          <TextField
            label="Full Name *"
            size="small"
            fullWidth
            value={newUser.full_name}
            onChange={(e) => setNewUser((p) => ({ ...p, full_name: e.target.value }))}
          />
          <TextField
            label="Email *"
            type="email"
            size="small"
            fullWidth
            value={newUser.email}
            onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
          />
          <TextField
            label="Phone"
            size="small"
            fullWidth
            value={newUser.phone}
            onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
          />
          <TextField
            select
            label="Access Role *"
            size="small"
            fullWidth
            value={newUser.role}
            onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as AppRole }))}
          >
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
            <MenuItem value="technician">Technician</MenuItem>
            <MenuItem value="customer">Customer</MenuItem>
          </TextField>
          <TextField
            label="Temporary Password *"
            type="password"
            size="small"
            fullWidth
            value={newUser.password}
            onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            helperText="Minimum 6 characters"
          />
        </Stack>
      </SideDrawer>
    </Card>
  );
}

// ─── Business Info Tab ──────────────────────────────────────────
function BusinessTab() {
  const [form, setForm] = useState({
    company_name: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    logo_url: "",
    invoice_prefix: "INV-",
    quotation_prefix: "QT-",
    timezone: "Asia/Kolkata",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    bank_branch: "",
    bank_upi_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          const d = data as any;
          setForm({
            company_name: data.company_name || "",
            company_address: data.company_address || "",
            company_phone: data.company_phone || "",
            company_email: data.company_email || "",
            logo_url: data.logo_url || "",
            invoice_prefix: data.invoice_prefix || "INV-",
            quotation_prefix: data.quotation_prefix || "QT-",
            timezone: d.timezone || "Asia/Kolkata",
            bank_name: d.bank_name || "",
            bank_account_number: d.bank_account_number || "",
            bank_ifsc: d.bank_ifsc || "",
            bank_branch: d.bank_branch || "",
            bank_upi_id: d.bank_upi_id || "",
          });
        }
      });
  }, []);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadStorageImage("brand", "company_logo", file);
      setForm((p) => ({ ...p, logo_url: url }));
      toast.success("Logo uploaded — click Save Business Settings to persist");
    } catch (err) {
      toast.error((err as Error).message || "Logo upload failed");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
      if (error) toast.error(error.message);
      else toast.success("Settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert(form as any).select().single();
      if (error) toast.error(error.message);
      else {
        toast.success("Settings saved");
        setSettingsId(data.id);
      }
    }
    setSaving(false);
  };

  const timezones = [
    "Asia/Kolkata",
    "Asia/Dubai",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
  ];

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
        <Card>
          <CardSectionHeader
            icon={Building2}
            title="Business Information"
            subtitle="Company profile, letterhead logo, prefixes, and timezone"
          />
          <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
            <TextField
              value={form.company_name}
              onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              label="Company Name"
              size="small"
              fullWidth
            />
            <TextField
              value={form.company_address}
              onChange={(e) => setForm((p) => ({ ...p, company_address: e.target.value }))}
              rows={3}
              label="Address"
              size="small"
              fullWidth
              multiline
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                value={form.company_phone}
                onChange={(e) => setForm((p) => ({ ...p, company_phone: e.target.value }))}
                label="Phone"
                size="small"
                fullWidth
              />
              <TextField
                value={form.company_email}
                onChange={(e) => setForm((p) => ({ ...p, company_email: e.target.value }))}
                label="Email"
                size="small"
                fullWidth
              />
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Company Logo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Used on branded A4 PDFs, quotations &amp; portals
                    </Typography>
                  </Box>
                  <Box ref={logoInputRef} component="input" type="file" accept="image/*" onChange={handleLogoFile} sx={{ display: "none" }} />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    startIcon={<Upload size={14} />}
                  >
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </Button>
                </Box>
                {form.logo_url && (
                  <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "#FFFFFF", display: "inline-flex", alignItems: "center", alignSelf: "flex-start" }}>
                    <Box src={form.logo_url} alt="Logo preview" component="img" sx={{ maxHeight: 48, width: "auto" }} />
                  </Box>
                )}
                <TextField
                  value={form.logo_url}
                  onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  label="Logo URL"
                  size="small"
                  fullWidth
                />
              </Stack>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                value={form.invoice_prefix}
                onChange={(e) => setForm((p) => ({ ...p, invoice_prefix: e.target.value }))}
                label="Invoice Prefix"
                size="small"
                fullWidth
              />
              <TextField
                value={form.quotation_prefix}
                onChange={(e) => setForm((p) => ({ ...p, quotation_prefix: e.target.value }))}
                label="Quotation Prefix"
                size="small"
                fullWidth
              />
            </Box>

            <TextField
              value={form.timezone}
              label="Timezone"
              select
              size="small"
              fullWidth
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              {timezones.map((tz) => (
                <MenuItem key={tz} value={tz}>
                  {tz}
                </MenuItem>
              ))}
            </TextField>
          </CardContent>
        </Card>

        <Card>
          <CardSectionHeader
            icon={CreditCard}
            title="Bank & UPI Details"
            subtitle="Printed on quotations and tax invoices for customer transfers"
          />
          <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
            <TextField
              value={form.bank_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              placeholder="e.g. HDFC Bank"
              label="Bank Name"
              size="small"
              fullWidth
            />
            <TextField
              value={form.bank_account_number}
              onChange={(e) => setForm((p) => ({ ...p, bank_account_number: e.target.value }))}
              label="Account Number"
              size="small"
              fullWidth
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                value={form.bank_ifsc}
                onChange={(e) => setForm((p) => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))}
                label="IFSC Code"
                size="small"
                fullWidth
              />
              <TextField
                value={form.bank_branch}
                onChange={(e) => setForm((p) => ({ ...p, bank_branch: e.target.value }))}
                label="Branch"
                size="small"
                fullWidth
              />
            </Box>
            <TextField
              value={form.bank_upi_id}
              onChange={(e) => setForm((p) => ({ ...p, bank_upi_id: e.target.value }))}
              placeholder="e.g. business@upi"
              label="UPI ID"
              size="small"
              fullWidth
            />
            <Box sx={{ pt: 0.5 }}>
              <Button onClick={save} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}

// ─── GST Tab ────────────────────────────────────────────────────
function GSTTab() {
  const [form, setForm] = useState({
    gst_number: "",
    gst_state_code: "",
    gst_type: "regular",
    default_cgst_rate: "9",
    default_sgst_rate: "9",
    default_igst_rate: "18",
    hsn_default: "",
  });
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          const d = data as any;
          setForm({
            gst_number: data.gst_number || "",
            gst_state_code: d.gst_state_code || "",
            gst_type: d.gst_type || "regular",
            default_cgst_rate: String(d.default_cgst_rate ?? 9),
            default_sgst_rate: String(d.default_sgst_rate ?? 9),
            default_igst_rate: String(d.default_igst_rate ?? 18),
            hsn_default: d.hsn_default || "",
          });
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      gst_number: form.gst_number,
      gst_state_code: form.gst_state_code,
      gst_type: form.gst_type,
      default_cgst_rate: parseFloat(form.default_cgst_rate) || 9,
      default_sgst_rate: parseFloat(form.default_sgst_rate) || 9,
      default_igst_rate: parseFloat(form.default_igst_rate) || 18,
      hsn_default: form.hsn_default,
    };
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(payload as any).eq("id", settingsId);
      if (error) toast.error(error.message);
      else toast.success("GST settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert(payload as any).select().single();
      if (error) toast.error(error.message);
      else {
        toast.success("GST settings saved");
        setSettingsId(data.id);
      }
    }
    setSaving(false);
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
      <Card>
        <CardSectionHeader icon={Receipt} title="GST Registration" subtitle="GSTIN and state tax classification" />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <TextField
            value={form.gst_number}
            onChange={(e) => setForm((p) => ({ ...p, gst_number: e.target.value.toUpperCase() }))}
            placeholder="22AAAAA0000A1Z5"
            label="GST Number (GSTIN)"
            size="small"
            fullWidth
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
            <TextField
              value={form.gst_state_code}
              onChange={(e) => setForm((p) => ({ ...p, gst_state_code: e.target.value }))}
              placeholder="27"
              label="State Code"
              size="small"
              fullWidth
            />
            <TextField
              value={form.gst_type}
              label="GST Type"
              select
              size="small"
              fullWidth
              onChange={(e) => setForm((p) => ({ ...p, gst_type: e.target.value }))}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            >
              <MenuItem value="regular">Regular</MenuItem>
              <MenuItem value="composition">Composition</MenuItem>
            </TextField>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardSectionHeader icon={FileText} title="Default Tax Rates & HSN" subtitle="Fallback tax rates for new items" />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
            <TextField
              type="number"
              value={form.default_cgst_rate}
              onChange={(e) => setForm((p) => ({ ...p, default_cgst_rate: e.target.value }))}
              label="CGST (%)"
              size="small"
              fullWidth
            />
            <TextField
              type="number"
              value={form.default_sgst_rate}
              onChange={(e) => setForm((p) => ({ ...p, default_sgst_rate: e.target.value }))}
              label="SGST (%)"
              size="small"
              fullWidth
            />
            <TextField
              type="number"
              value={form.default_igst_rate}
              onChange={(e) => setForm((p) => ({ ...p, default_igst_rate: e.target.value }))}
              label="IGST (%)"
              size="small"
              fullWidth
            />
          </Box>
          <TextField
            value={form.hsn_default}
            onChange={(e) => setForm((p) => ({ ...p, hsn_default: e.target.value }))}
            placeholder="9987"
            label="Default HSN/SAC Code"
            size="small"
            fullWidth
          />
          <Button onClick={save} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
            {saving ? "Saving..." : "Save GST Settings"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Document Settings Tab ──────────────────────────────────────
function DocumentSettingsTab() {
  const [signatureUrl, setSignatureUrl] = useState("");
  const [showOnQuotations, setShowOnQuotations] = useState(false);
  const [showOnInvoices, setShowOnInvoices] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("business_settings")
      .select("id, integrations")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          const int = (data.integrations as Record<string, any>) || {};
          setSignatureUrl(int.signature_url || "");
          setShowOnQuotations(int.show_signature_quotations === true);
          setShowOnInvoices(int.show_signature_invoices === true);
        }
      });
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const url = await uploadStorageImage("signatures", "signature", files[0]);
      setSignatureUrl(url);
      toast.success("Signature uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      if (sigInputRef.current) sigInputRef.current.value = "";
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      let targetId = settingsId;
      let existing: Record<string, any> = {};
      if (!targetId) {
        const { data: rows } = await supabase.from("business_settings").select("id, integrations").limit(1);
        if (rows?.[0]) {
          targetId = rows[0].id;
          setSettingsId(targetId);
          existing = (rows[0].integrations as Record<string, any>) || {};
        }
      } else {
        const { data: current } = await supabase.from("business_settings").select("integrations").eq("id", targetId).single();
        existing = (current?.integrations as Record<string, any>) || {};
      }
      const updated = {
        ...existing,
        signature_url: signatureUrl,
        show_signature_quotations: showOnQuotations,
        show_signature_invoices: showOnInvoices,
      };
      if (targetId) {
        const { error } = await supabase.from("business_settings").update({ integrations: updated }).eq("id", targetId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("business_settings").insert({ integrations: updated } as any).select().single();
        if (error) throw new Error(error.message);
        setSettingsId(data.id);
      }
      toast.success("Document settings saved");
    } catch (err) {
      toast.error((err as Error).message || "Failed to save document settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
      <Card>
        <CardSectionHeader
          icon={FileText}
          title="Authorized Stamp & Signature"
          subtitle="Upload a transparent PNG or scan for printed Quotations and Invoices"
        />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <Box ref={sigInputRef} type="file" accept="image/*" onChange={(e) => void handleUpload(e.target.files)} component="input" sx={{ display: "none" }} />
          {signatureUrl ? (
            <Box sx={{ borderRadius: 2, p: 2, bgcolor: "#FFFFFF", border: "1px solid", borderColor: "divider", display: "inline-block" }}>
              <Box src={signatureUrl} alt="Authorized signature" component="img" sx={{ maxHeight: 72, width: "auto" }} />
            </Box>
          ) : (
            <Box sx={{ p: 3, borderRadius: 2, border: "1px dashed", borderColor: "divider", textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No signature uploaded yet
              </Typography>
            </Box>
          )}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" disabled={uploading} onClick={() => sigInputRef.current?.click()} startIcon={<Camera size={15} />}>
              {uploading ? "Uploading..." : signatureUrl ? "Replace Signature" : "Upload Signature"}
            </Button>
            {signatureUrl && (
              <Button variant="text" size="small" color="error" onClick={() => setSignatureUrl("")}>
                Remove
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardSectionHeader
          icon={CheckCircle2}
          title="Document Display Defaults"
          subtitle="Control automatic signature placement on generated commercial PDFs"
        />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Show on Quotations
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Embed company signature on quotation previews &amp; A4 PDFs
              </Typography>
            </Box>
            <Switch checked={showOnQuotations} onChange={(_, c) => setShowOnQuotations(c)} slotProps={{ input: { "aria-label": "Show on Quotations" } }} />
          </Box>
          <Divider />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Show on Tax Invoices
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Embed company signature on tax invoices &amp; customer payment links
              </Typography>
            </Box>
            <Switch checked={showOnInvoices} onChange={(_, c) => setShowOnInvoices(c)} slotProps={{ input: { "aria-label": "Show on Invoices" } }} />
          </Box>
          <Box sx={{ pt: 1 }}>
            <Button onClick={saveSettings} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
              {saving ? "Saving..." : "Save Document Settings"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Integration Settings Helpers ───────────────────────────────
function useIntegrations() {
  const [integrations, setIntegrations] = useState<Record<string, any>>({});
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("business_settings")
      .select("id, integrations")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          if (data.integrations && typeof data.integrations === "object") {
            setIntegrations(data.integrations as Record<string, any>);
          }
        }
      });
  }, []);

  const updateField = (key: string, value: string) => {
    setIntegrations((prev) => ({ ...prev, [key]: value }));
  };

  const persistIntegrations = async (silent = false, extra?: Record<string, any>): Promise<boolean> => {
    setSaving(true);
    let ok = false;
    try {
      let targetId = settingsId;
      let existingIntegrations: Record<string, any> = {};
      if (!targetId) {
        const { data: rows } = await supabase.from("business_settings").select("id, integrations").limit(1);
        if (rows?.[0]) {
          targetId = rows[0].id;
          setSettingsId(targetId);
          if (rows[0].integrations && typeof rows[0].integrations === "object") {
            existingIntegrations = rows[0].integrations as Record<string, any>;
          }
        }
      } else {
        const { data: current } = await supabase.from("business_settings").select("integrations").eq("id", targetId).single();
        if (current?.integrations && typeof current.integrations === "object") {
          existingIntegrations = current.integrations as Record<string, any>;
        }
      }
      const merged = { ...existingIntegrations, ...integrations, ...(extra || {}) };
      if (targetId) {
        const { error } = await supabase.from("business_settings").update({ integrations: merged }).eq("id", targetId);
        if (error) toast.error(error.message);
        else {
          ok = true;
          if (!silent) toast.success("Settings saved");
        }
      } else {
        const { data, error } = await supabase.from("business_settings").insert({ integrations: merged } as any).select().single();
        if (error) toast.error(error.message);
        else {
          setSettingsId(data.id);
          ok = true;
          if (!silent) toast.success("Settings saved");
        }
      }
    } finally {
      setSaving(false);
    }
    return ok;
  };

  const saveIntegrations = () => persistIntegrations(false);
  const saveIntegrationsWith = (extra: Record<string, any>, silent = false) => persistIntegrations(silent, extra);
  const saveIntegrationsSilent = () => persistIntegrations(true);

  return { integrations, updateField, saveIntegrations, saveIntegrationsWith, saveIntegrationsSilent, saving };
}

function IntegrationFieldGroup({
  title,
  description,
  fields,
  integrations,
  updateField,
}: {
  title: string;
  description: string;
  fields: {
    key: string;
    label: string;
    type?: string;
    placeholder?: string;
    readOnly?: boolean;
    copyable?: boolean;
  }[];
  integrations: Record<string, string>;
  updateField: (k: string, v: string) => void;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  return (
    <Card>
      <CardSectionHeader title={title} subtitle={description} />
      <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 1.75 } }}>
        {fields.map((f) => {
          const isPwd = f.type === "password";
          const effectiveType = isPwd ? (revealed[f.key] ? "text" : "password") : f.type || "text";
          return (
            <Box key={f.key} sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
              <FormLabel>{f.label}</FormLabel>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  type={effectiveType}
                  placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
                  value={integrations[f.key] || ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{
                    htmlInput: { readOnly: f.readOnly, "aria-label": f.placeholder || `Enter ${f.label.toLowerCase()}` },
                    input: isPwd
                      ? {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                aria-label={revealed[f.key] ? `Hide ${f.label}` : `Show ${f.label}`}
                                onClick={() => setRevealed((p) => ({ ...p, [f.key]: !p[f.key] }))}
                                edge="end"
                              >
                                {revealed[f.key] ? <EyeOff size={15} /> : <Eye size={15} />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }
                      : undefined,
                  }}
                  sx={f.readOnly ? { bgcolor: "action.hover" } : {}}
                />
                {f.copyable && (
                  <IconButton onClick={() => copyToClipboard(integrations[f.key] || "")} aria-label="Copy" sx={{ flexShrink: 0 }}>
                    <Copy size={16} />
                  </IconButton>
                )}
              </Box>
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Email / SMTP Tab ───────────────────────────────────────────
function EmailTab({ defaultTestEmail }: { defaultTestEmail: string }) {
  const { integrations, updateField, saveIntegrations, saveIntegrationsSilent, saving } = useIntegrations();
  const [testTo, setTestTo] = useState(defaultTestEmail);
  const [testing, setTesting] = useState(false);

  const sendTestEmail = async () => {
    const clean = testTo.trim();
    if (!clean) {
      toast.error("Enter a recipient email to test SMTP");
      return;
    }
    setTesting(true);
    try {
      const okSave = await saveIntegrationsSilent();
      if (!okSave) {
        setTesting(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: clean,
          subject: "ALVStore SMTP Test Email",
          body: "Your ALVStore SMTP configuration is working properly and ready to dispatch branded A4 Quotation & Invoice PDFs.",
          plain_text: true,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "SMTP test failed");
      }
      toast.success(`Test email sent to ${clean}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
      <Stack spacing={2}>
        <IntegrationFieldGroup
          title="SMTP Configuration"
          description="Powers outbound Quotation, Tax Invoice & Delivery Challan PDF emails"
          fields={[
            { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.hostinger.com" },
            { key: "smtp_port", label: "SMTP Port", placeholder: "465 or 587" },
            { key: "smtp_user", label: "Username" },
            { key: "smtp_pass", label: "Password", type: "password" },
            { key: "smtp_from_name", label: "From Name", placeholder: "ALVStore" },
            { key: "smtp_from_email", label: "From Email", placeholder: "sales@alvstore.in" },
          ]}
          integrations={integrations}
          updateField={updateField}
        />
        <Button onClick={saveIntegrations} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
          {saving ? "Saving..." : "Save Email Settings"}
        </Button>
      </Stack>

      <Card>
        <CardSectionHeader
          icon={Send}
          title="Verify SMTP Delivery"
          subtitle="Save current credentials and dispatch a live test message"
        />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <Alert severity="info">
            Port <strong>465</strong> uses implicit TLS automatically; port <strong>587</strong> uses STARTTLS. If empty, the server falls back to `.env` SMTP credentials.
          </Alert>
          <TextField
            label="Test Recipient Email"
            type="email"
            size="small"
            fullWidth
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@alvstore.in"
          />
          <Button
            variant="outlined"
            disabled={testing || saving}
            onClick={() => void sendTestEmail()}
            startIcon={<Send size={15} />}
          >
            {testing ? "Sending Test..." : "Save & Send Test Email"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── SMS Tab ────────────────────────────────────────────────────
function SMSTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  return (
    <Box sx={{ display: "grid", gap: 2.5, maxWidth: "46rem" }}>
      <IntegrationFieldGroup
        title="SMS API Configuration"
        description="DLT-compliant SMS gateway settings"
        fields={[
          { key: "sms_api_url", label: "API Endpoint", placeholder: "https://api.sms-provider.com/send" },
          { key: "sms_api_key", label: "API Key", type: "password" },
          { key: "sms_sender_id", label: "Sender ID", placeholder: "MYCOMP" },
          { key: "sms_dlt_entity_id", label: "DLT Entity ID" },
        ]}
        integrations={integrations}
        updateField={updateField}
      />
      <Box>
        <Button onClick={saveIntegrations} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
          {saving ? "Saving..." : "Save SMS Settings"}
        </Button>
      </Box>
    </Box>
  );
}

// ─── WhatsApp Tab ───────────────────────────────────────────────
interface WaSessionStatus {
  provider: "openwa" | "evolution" | "meta";
  instance: string;
  state: "connected" | "qr_ready" | "connecting" | "disconnected" | "error";
  connected: boolean;
  configured?: boolean;
  phone?: string;
  pushName?: string;
  qrCode?: string;
  pairingCode?: string;
  detail?: string;
  webhook_url?: string;
}

function WhatsAppTab() {
  const [form, setForm] = useState({ whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_phone_id: "" });
  const { integrations, updateField, saveIntegrationsWith, saving: intSaving } = useIntegrations();
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [showGatewayKey, setShowGatewayKey] = useState(false);
  const [linkMode, setLinkMode] = useState<"qr" | "pairing_code">("qr");
  const [pairingPhone, setPairingPhone] = useState("");
  const [session, setSession] = useState<WaSessionStatus | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testText, setTestText] = useState("Hello from ALVStore CRM!");
  const [testingSend, setTestingSend] = useState(false);

  const webhookUrl = `${window.location.origin}/api/backend/functions/whatsapp-webhook`;
  const [generatedToken] = useState(() => "alvstore_wa_verify_" + Math.random().toString(36).substring(2, 10));
  const [generatedWebhookSecret] = useState(() => "alv_wh_" + Math.random().toString(36).substring(2, 14));
  const verifyToken = integrations["wa_verify_token"] || generatedToken;
  const gatewaySecret = integrations["whatsapp_webhook_secret"] || generatedWebhookSecret;

  const provider = (integrations["whatsapp_provider"] ||
    (integrations["whatsapp_gateway_url"] ? "openwa" : form.whatsapp_phone_id ? "meta" : "openwa")) as
    | "openwa"
    | "evolution"
    | "meta";

  const fetchSessionStatus = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/backend/functions/whatsapp-session/status", {
        headers: getBackendAuthHeaders(),
      });
      const data = (await res.json().catch(() => ({}))) as WaSessionStatus & {
        success?: boolean;
        error?: string;
      };
      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Could not reach WhatsApp gateway");
        return;
      }
      if (data?.success) {
        setSession((prev) =>
          data.connected
            ? data
            : {
                ...data,
                pairingCode:
                  data.pairingCode ||
                  (data.state === "qr_ready" || data.state === "connecting" ? prev?.pairingCode : undefined),
              }
        );
      }
    } catch (err: any) {
      if (!silent) toast.error(err?.message || "Gateway status check failed");
    }
  }, []);

  useEffect(() => {
    supabase
      .from("business_settings")
      .select("*")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          const d = data as any;
          setForm({
            whatsapp_api_url: d.whatsapp_api_url || "",
            whatsapp_api_key: d.whatsapp_api_key || "",
            whatsapp_phone_id: d.whatsapp_phone_id || "",
          });
        }
      });
    void fetchSessionStatus(true);
  }, [fetchSessionStatus]);

  // Poll session status every 3s while awaiting QR scan / phone pairing confirmation
  useEffect(() => {
    if (provider === "meta") return;
    if (!session || (session.state !== "qr_ready" && session.state !== "connecting")) return;
    const timer = window.setInterval(() => {
      void fetchSessionStatus(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [provider, session, fetchSessionStatus]);

  const save = async (silent = false) => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
      if (error && !silent) toast.error(error.message);
    }
    const patch: Record<string, string> = {
      whatsapp_provider: provider,
      wa_verify_token: verifyToken,
    };
    if (provider !== "meta") {
      patch.whatsapp_webhook_secret = gatewaySecret;
      if (!integrations["whatsapp_instance"]) {
        patch.whatsapp_instance = "alvstore";
      }
    }
    await saveIntegrationsWith(patch, silent);
    setSaving(false);
    if (!silent) void fetchSessionStatus(true);
  };

  const handleConnect = async () => {
    if (provider === "meta") return;
    if (!(integrations["whatsapp_gateway_url"] || "").trim()) {
      toast.error("Save your Gateway URL first before linking a WhatsApp number.");
      return;
    }
    if (linkMode === "pairing_code" && pairingPhone.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid WhatsApp phone number with country code (e.g. +919887601200).");
      return;
    }
    setSessionBusy(true);
    try {
      await save(true);
      const { data, error } = await supabase.functions.invoke("whatsapp-session-connect", {
        body: {
          method: linkMode,
          phone_number: linkMode === "pairing_code" ? pairingPhone.trim() : undefined,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Connection attempt failed");
      setSession(data as WaSessionStatus);
      toast.success(
        data.connected
          ? `Connected to WhatsApp${data.phone ? ` (+${data.phone})` : ""}`
          : linkMode === "pairing_code"
            ? "Pairing code ready — enter it on your phone"
            : "QR code ready — scan with WhatsApp"
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to start WhatsApp linking");
    } finally {
      setSessionBusy(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await confirmAction(
      "Disconnect the active WhatsApp Web session from ALVStore CRM? You can re-link anytime via QR scan."
    );
    if (!confirmed) return;
    setSessionBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-session-logout", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Disconnect failed");
      toast.success("WhatsApp number disconnected");
      await fetchSessionStatus(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to disconnect session");
    } finally {
      setSessionBusy(false);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone.trim() || !testText.trim()) {
      toast.error("Enter both a recipient phone number and a message.");
      return;
    }
    setTestingSend(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: testPhone.trim(), message: testText.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Test send failed");
      toast.success(`Test message sent${data.whatsapp_message_id ? ` (${data.whatsapp_message_id})` : ""}`);
    } catch (err: any) {
      toast.error(err?.message || "Test send failed");
    } finally {
      setTestingSend(false);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  const statusChipProps =
    session?.connected
      ? { label: session.phone ? `Connected · +${session.phone}` : "Connected", color: "success" as const }
      : session?.state === "qr_ready" || session?.state === "connecting"
        ? { label: session.state === "qr_ready" ? "Awaiting Scan" : "Connecting...", color: "warning" as const }
        : session?.state === "error"
          ? { label: "Gateway Error", color: "error" as const }
          : { label: "Not Linked", color: "default" as const };

  return (
    <Stack spacing={3}>
      <Card>
        <CardSectionHeader
          icon={MessageCircle}
          title="WhatsApp Transport Mode"
          subtitle="Choose your self-hosted WhatsApp Web gateway (QR / pairing) or Meta Official Cloud API"
          action={<StatusChip label={statusChipProps.label} color={statusChipProps.color} variant="filled" />}
        />
        <CardContent sx={{ px: 3, pb: 3 }}>
          <TextField
            select
            label="Active Provider"
            size="small"
            fullWidth
            value={provider}
            onChange={(e) => updateField("whatsapp_provider", e.target.value)}
          >
            <MenuItem value="openwa">OpenWA Gateway (Self-Hosted Baileys · Lightweight · Recommended)</MenuItem>
            <MenuItem value="evolution">Evolution API v2 (Self-Hosted Baileys)</MenuItem>
            <MenuItem value="meta">Meta Official Cloud API (graph.facebook.com)</MenuItem>
          </TextField>
        </CardContent>
      </Card>

      {provider !== "meta" ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
          <Card>
            <CardSectionHeader
              icon={provider === "openwa" ? QrCode : Globe}
              title={provider === "openwa" ? "OpenWA Gateway Config" : "Evolution API v2 Config"}
              subtitle="Connect your self-hosted container URL and webhook secret"
            />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              <TextField
                value={integrations["whatsapp_gateway_url"] || ""}
                onChange={(e) => updateField("whatsapp_gateway_url", e.target.value)}
                placeholder="http://127.0.0.1:2785 or https://wa.yourdomain.com"
                label="Gateway URL"
                size="small"
                fullWidth
              />
              <TextField
                type={showGatewayKey ? "text" : "password"}
                value={integrations["whatsapp_gateway_key"] || ""}
                onChange={(e) => updateField("whatsapp_gateway_key", e.target.value)}
                label={provider === "evolution" ? "Evolution Global / Instance API Key" : "OpenWA X-API-Key"}
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={showGatewayKey ? "Hide gateway key" : "Show gateway key"}
                          onClick={() => setShowGatewayKey((p) => !p)}
                          edge="end"
                        >
                          {showGatewayKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                value={integrations["whatsapp_instance"] || "alvstore"}
                onChange={(e) => updateField("whatsapp_instance", e.target.value)}
                label="Session / Instance Name"
                placeholder="alvstore"
                size="small"
                fullWidth
              />
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
                <FormLabel>Webhook HMAC Secret</FormLabel>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    value={gatewaySecret}
                    onChange={(e) => updateField("whatsapp_webhook_secret", e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { "aria-label": "Webhook HMAC Secret" } }}
                    sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
                  />
                  <IconButton onClick={() => copyToClipboard(gatewaySecret)} aria-label="Copy webhook secret">
                    <Copy size={16} />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
                <FormLabel>Auto-Registered Webhook URL</FormLabel>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    value={webhookUrl}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { readOnly: true, "aria-label": "Webhook Callback URL" } }}
                    sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
                  />
                  <IconButton onClick={() => copyToClipboard(webhookUrl)} aria-label="Copy webhook URL">
                    <Copy size={16} />
                  </IconButton>
                </Box>
              </Box>
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                <Button
                  onClick={() => void save(false)}
                  disabled={saving || intSaving}
                  variant="contained"
                  startIcon={<Save size={16} />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {saving || intSaving ? "Saving..." : "Save Gateway Settings"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => void fetchSessionStatus(false)}
                  disabled={sessionBusy}
                  startIcon={<RefreshCw size={15} />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Check Status
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardSectionHeader
              icon={Smartphone}
              title="Link WhatsApp Number"
              subtitle="Scan QR code or pair via 8-character code on your phone"
            />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              {session?.connected ? (
                <Stack spacing={2}>
                  <Alert severity="success" icon={<CheckCircle2 size={18} />}>
                    Bound number:{" "}
                    <strong>{session.phone ? `+${session.phone}` : session.instance}</strong>
                    {session.pushName ? ` (${session.pushName})` : ""}
                  </Alert>
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => void handleDisconnect()}
                    disabled={sessionBusy}
                    startIcon={<Unplug size={15} />}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Disconnect Number
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant={linkMode === "qr" ? "contained" : "outlined"}
                      onClick={() => setLinkMode("qr")}
                      startIcon={<QrCode size={15} />}
                    >
                      Scan QR Code
                    </Button>
                    <Button
                      size="small"
                      variant={linkMode === "pairing_code" ? "contained" : "outlined"}
                      onClick={() => setLinkMode("pairing_code")}
                      startIcon={<KeyRound size={15} />}
                    >
                      Phone Pairing Code
                    </Button>
                  </Stack>

                  {linkMode === "pairing_code" && (
                    <TextField
                      label="Business Phone Number (with country code)"
                      placeholder="+919887601200"
                      size="small"
                      fullWidth
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                    />
                  )}

                  <Button
                    variant="contained"
                    onClick={() => void handleConnect()}
                    disabled={sessionBusy}
                    startIcon={sessionBusy ? <Loader2 size={15} /> : <Link2 size={15} />}
                  >
                    {sessionBusy
                      ? "Connecting..."
                      : linkMode === "qr"
                        ? session?.qrCode
                          ? "Refresh QR Code"
                          : "Generate QR Code"
                        : "Request 8-Char Pairing Code"}
                  </Button>

                  {linkMode === "qr" && session?.qrCode && (
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "common.white",
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "center",
                        alignSelf: "center",
                        gap: 1,
                      }}
                    >
                      <Box
                        component="img"
                        src={session.qrCode}
                        alt="WhatsApp Link QR Code"
                        sx={{ width: 220, height: 220, objectFit: "contain" }}
                      />
                      <Typography variant="caption" sx={{ color: "grey.700", fontWeight: 600 }}>
                        Open WhatsApp &rarr; Linked Devices &rarr; Link a Device
                      </Typography>
                    </Box>
                  )}

                  {linkMode === "pairing_code" && session?.pairingCode && (
                    <Alert severity="info" icon={<KeyRound size={18} />}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption">
                          Enter this code on WhatsApp (&ldquo;Link with phone number instead&rdquo;):
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Typography
                            variant="h6"
                            sx={{ fontFamily: "JetBrains Mono, monospace", letterSpacing: 3, fontWeight: 700 }}
                          >
                            {session.pairingCode}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => copyToClipboard(session.pairingCode || "")}
                            aria-label="Copy pairing code"
                          >
                            <Copy size={15} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Alert>
                  )}

                  {session?.detail && !session.qrCode && !session.pairingCode && (
                    <Typography variant="caption" color="text.secondary">
                      {session.detail}
                    </Typography>
                  )}
                </Stack>
              )}

              <Divider />

              <Stack spacing={1.5}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase" }}>
                  Send Test Message
                </Typography>
                <TextField
                  label="Recipient WhatsApp Number"
                  placeholder="+919887601200"
                  size="small"
                  fullWidth
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <TextField
                  label="Test Message"
                  size="small"
                  fullWidth
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                />
                <Button
                  variant="outlined"
                  onClick={() => void handleTestSend()}
                  disabled={testingSend}
                  startIcon={<Send size={15} />}
                  sx={{ alignSelf: "flex-start" }}
                >
                  {testingSend ? "Sending..." : "Send Test Message"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
          <Card>
            <CardSectionHeader
              icon={Phone}
              title="WhatsApp Business API"
              subtitle="Configure Meta Cloud API credentials"
            />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              <TextField
                value={form.whatsapp_api_url}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp_api_url: e.target.value }))}
                placeholder="https://graph.facebook.com/v21.0"
                label="API URL"
                size="small"
                fullWidth
              />
              <TextField
                type={showKey ? "text" : "password"}
                value={form.whatsapp_api_key}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp_api_key: e.target.value }))}
                label="API Key / Access Token"
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={showKey ? "Hide API key" : "Show API key"}
                          onClick={() => setShowKey((p) => !p)}
                          edge="end"
                        >
                          {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                value={form.whatsapp_phone_id}
                onChange={(e) => setForm((p) => ({ ...p, whatsapp_phone_id: e.target.value }))}
                label="Phone Number ID"
                size="small"
                fullWidth
              />
              <Button onClick={() => void save(false)} disabled={saving || intSaving} variant="contained" startIcon={<Save size={16} />}>
                {saving || intSaving ? "Saving..." : "Save WhatsApp Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardSectionHeader
              icon={Globe}
              title="Facebook Developer Portal"
              subtitle="Webhook verification values for Meta App Dashboard"
            />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              <TextField
                value={integrations["fb_app_id"] || ""}
                onChange={(e) => updateField("fb_app_id", e.target.value)}
                placeholder="Enter Facebook App ID"
                label="Facebook App ID"
                size="small"
                fullWidth
              />
              <TextField
                type="password"
                value={integrations["fb_app_secret"] || ""}
                onChange={(e) => updateField("fb_app_secret", e.target.value)}
                placeholder="Enter Facebook App Secret"
                label="Facebook App Secret"
                size="small"
                fullWidth
              />
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
                <FormLabel>Webhook Verify Token</FormLabel>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    value={verifyToken}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { readOnly: true, "aria-label": "Webhook Verify Token" } }}
                    sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
                  />
                  <IconButton onClick={() => copyToClipboard(verifyToken)} aria-label="Copy token">
                    <Copy size={16} />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
                <FormLabel>Webhook Callback URL</FormLabel>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    value={webhookUrl}
                    size="small"
                    fullWidth
                    slotProps={{ htmlInput: { readOnly: true, "aria-label": "Webhook Callback URL" } }}
                    sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
                  />
                  <IconButton onClick={() => copyToClipboard(webhookUrl)} aria-label="Copy webhook URL">
                    <Copy size={16} />
                  </IconButton>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      <WhatsAppAutomationSection />
    </Stack>
  );
}

// ─── WhatsApp Automation Settings ───────────────────────────────
const AUTOMATION_EVENTS = [
  { id: "lead_created", label: "New Lead Created", desc: "When a new lead is captured" },
  { id: "job_created", label: "Job Sheet Created", desc: "When a repair job is created" },
  { id: "job_approved", label: "Job Approved", desc: "When customer approves the job" },
  { id: "job_in_progress", label: "Repair In Progress", desc: "When repair work starts" },
  { id: "job_ready", label: "Ready for Pickup", desc: "When repair is completed" },
  { id: "job_delivered", label: "Job Delivered", desc: "When device is delivered" },
  { id: "invoice_generated", label: "Invoice Generated", desc: "When invoice is created" },
  { id: "payment_received", label: "Payment Received", desc: "When payment is confirmed" },
  { id: "quotation_sent", label: "Quotation Sent", desc: "When quotation is shared" },
  { id: "payment_reminder", label: "Payment Reminder", desc: "Overdue payment reminder" },
];

function WhatsAppAutomationSection() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from("templates").select("*").not("event_type", "is", null);
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  const getTemplateForEvent = (eventType: string) => templates.find((t: any) => t.event_type === eventType);

  const createDefaultTemplate = async (eventId: string, eventLabel: string) => {
    const defaultBodies: Record<string, string> = {
      lead_created: "Hello {{customer_name}}, thank you for your interest! Our team will contact you shortly.",
      job_created: "Hello {{customer_name}}, your repair job {{job_id}} has been created. Track: {{link}}",
      job_approved: "Hello {{customer_name}}, your job {{job_id}} has been approved. We'll begin work shortly.",
      job_in_progress: "Hello {{customer_name}}, repair on {{job_id}} is now in progress. Track: {{link}}",
      job_ready: "Hello {{customer_name}}, your device ({{job_id}}) is ready for pickup! Track: {{link}}",
      job_delivered: "Hello {{customer_name}}, job {{job_id}} delivered successfully. Thank you for choosing us!",
      invoice_generated: "Hello {{customer_name}}, invoice for ₹{{amount}} has been generated. View: {{link}}",
      payment_received: "Hello {{customer_name}}, payment of ₹{{amount}} received. Thank you!",
      quotation_sent: "Hello {{customer_name}}, your quotation is ready. View: {{link}}",
      payment_reminder: "Hello {{customer_name}}, payment of ₹{{amount}} is pending. Pay now: {{link}}",
    };
    const { error } = await supabase.from("templates").insert({
      name: `WA: ${eventLabel}`,
      type: "sms" as any,
      body: defaultBodies[eventId] || `Hello {{customer_name}}, update on your job {{job_id}}: {{status}}`,
      event_type: eventId,
      created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Template created");
      void fetchTemplates();
    }
  };

  const removeAutomation = async (templateId: string) => {
    const { error } = await supabase.from("templates").update({ event_type: null } as any).eq("id", templateId);
    if (error) toast.error(error.message);
    else {
      toast.success("Automation removed");
      void fetchTemplates();
    }
  };

  const testAutomation = async (eventId: string) => {
    try {
      const result = await supabase.functions.invoke("whatsapp-automation", {
        body: {
          event_type: eventId,
          customer_phone: "919999999999",
          variables: {
            customer_name: "Test Customer",
            job_id: "JOB-2026-00001",
            status: "test",
            link: window.location.origin,
            amount: "1000",
          },
        },
      });
      if (result.data?.success) toast.success(`Test sent via ${result.data.channel}`);
      else if (result.data?.skipped) toast.info("No template configured for this event");
      else toast.error(result.data?.error || "Test failed");
    } catch {
      toast.error("Failed to test automation");
    }
  };

  return (
    <Card>
      <CardSectionHeader
        icon={MessageSquare}
        title="WhatsApp Automation"
        subtitle="Auto-send WhatsApp updates on key ERP milestones (falls back to SMS)"
      />
      <CardContent sx={{ px: 3, pb: 3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <Box component={Loader2} sx={{ width: 20, height: 20, animation: "spin 1s linear infinite", color: "text.secondary" }} />
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {AUTOMATION_EVENTS.map((evt) => {
              const tpl = getTemplateForEvent(evt.id);
              return (
                <Box
                  key={evt.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {evt.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                      {evt.desc}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                    {tpl ? (
                      <>
                        <StatusChip label="Active" size="small" color="success" />
                        <Button onClick={() => void testAutomation(evt.id)} variant="text" size="small" startIcon={<TestTube size={13} />}>
                          Test
                        </Button>
                        <IconButton onClick={() => void removeAutomation(tpl.id)} aria-label="Remove automation" size="small" color="error">
                          <Trash2 size={14} />
                        </IconButton>
                      </>
                    ) : (
                      <Button onClick={() => void createDefaultTemplate(evt.id, evt.label)} variant="outlined" size="small" startIcon={<Plus size={13} />}>
                        Enable
                      </Button>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Razorpay Tab ───────────────────────────────────────────────
function RazorpayTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  const webhookUrl = `${window.location.origin}/api/backend/functions/razorpay-webhook`;
  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, alignItems: "start" }}>
      <Stack spacing={2}>
        <IntegrationFieldGroup
          title="Razorpay Payment Gateway"
          description="Configure Razorpay for online payment links on invoices"
          fields={[
            { key: "razorpay_key_id", label: "Key ID", placeholder: "rzp_live_xxxxxxxxxxxx" },
            { key: "razorpay_key_secret", label: "Key Secret", type: "password", placeholder: "Enter Key Secret" },
            { key: "razorpay_webhook_secret", label: "Webhook Secret", type: "password", placeholder: "Enter Webhook Secret" },
          ]}
          integrations={integrations}
          updateField={updateField}
        />
        <Button onClick={saveIntegrations} disabled={saving} variant="contained" startIcon={<Save size={16} />}>
          {saving ? "Saving..." : "Save Razorpay Settings"}
        </Button>
      </Stack>

      <Card>
        <CardSectionHeader
          icon={Globe}
          title="Razorpay Webhook Setup"
          subtitle="Register this callback in Razorpay Dashboard -> Settings -> Webhooks"
        />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { mt: 0.5 } }}>
            <FormLabel>Webhook URL</FormLabel>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                value={webhookUrl}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { readOnly: true, "aria-label": "Razorpay Webhook URL" } }}
                sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}
              />
              <IconButton onClick={() => copyToClipboard(webhookUrl)} aria-label="Copy webhook URL">
                <Copy size={16} />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Required Webhook Events
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Select <strong>payment.captured</strong> and <strong>payment_link.paid</strong> using the same Webhook Secret configured on the left.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

// ─── Hikvision Tab ──────────────────────────────────────────────
function HikvisionTab() {
  const { integrations, updateField, saveIntegrations, saveIntegrationsSilent, saving } = useIntegrations();
  const [step, setStep] = useState(1);
  const [credentialStatus, setCredentialStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [credentialError, setCredentialError] = useState("");
  const [testingCredentials, setTestingCredentials] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ configured?: boolean; source?: string; hasEnvFallback?: boolean } | null>(null);
  const [credentialInfo, setCredentialInfo] = useState<{ areaDomain?: string; expireTime?: number } | null>(null);
  const [sites, setSites] = useState<Array<{ id: string; siteName: string }>>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState(integrations["hik_default_site_id"] || "");
  const [cloudDevices, setCloudDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [importingDevices, setImportingDevices] = useState(false);
  const [savedDevices, setSavedDevices] = useState<any[]>([]);
  const [syncingAction, setSyncingAction] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, any>>({});
  const [backfillStart, setBackfillStart] = useState("");
  const [backfillEnd, setBackfillEnd] = useState("");

  const refreshCredentialStatus = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "credential-status" },
      });
      if (data?.success) setServerStatus(data);
    } catch {
      // Non-blocking status probe
    }
  }, []);

  useEffect(() => {
    supabase.from("hikvision_devices").select("*").order("created_at").then(({ data }) => setSavedDevices(data || []));
    void refreshCredentialStatus();
  }, [refreshCredentialStatus]);

  useEffect(() => {
    if (integrations["hik_default_site_id"]) setSelectedSiteId(integrations["hik_default_site_id"]);
  }, [integrations]);

  const hasFormKeys = Boolean(
    (integrations["hik_partner_app_key"] || "").trim() ||
      (integrations["hik_partner_secret_key"] || "").trim() ||
      (integrations["hik_webhook_sign_secret"] || "").trim()
  );

  const saveHikCredentials = async () => {
    const ok = await saveIntegrations();
    if (ok) await refreshCredentialStatus();
  };

  const testCredentials = async () => {
    setTestingCredentials(true);
    setCredentialStatus("idle");
    setCredentialError("");
    try {
      if (hasFormKeys) {
        const saved = await saveIntegrationsSilent();
        if (!saved) {
          setCredentialStatus("invalid");
          setTestingCredentials(false);
          return;
        }
        await refreshCredentialStatus();
      }
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "test-credentials" },
      });
      if (error) throw error;
      if (data?.success) {
        setCredentialStatus("valid");
        setCredentialInfo({ areaDomain: data.areaDomain, expireTime: data.expireTime });
        toast.success("Hik-Partner Pro credentials verified!");
        setStep(2);
      } else {
        const errMsg = typeof data?.error === "string" ? data.error : data?.error?.message || "Invalid credentials";
        setCredentialStatus("invalid");
        setCredentialError(errMsg);
        toast.error(errMsg);
      }
    } catch (e: any) {
      setCredentialStatus("invalid");
      setCredentialError(e?.message || "Credential test failed");
      toast.error(e.message || "Credential test failed");
    }
    setTestingCredentials(false);
  };

  const discoverSites = async () => {
    setLoadingSites(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "site-search" } });
      if (error) throw error;
      if (data?.success) {
        setSites(data.sites || []);
        toast.success(`Found ${data.sites?.length || 0} sites`);
      } else toast.error(data?.error || "Failed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingSites(false);
  };

  const selectSite = async (siteId: string) => {
    setSelectedSiteId(siteId);
    updateField("hik_default_site_id", siteId);
    await saveIntegrations();
    toast.success("Default site saved");
    setStep(3);
  };

  const discoverDevices = async () => {
    setLoadingDevices(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "list-devices" } });
      if (error) throw error;
      if (data?.success) {
        setCloudDevices(data.devices || []);
        toast.success(`Found ${data.devices?.length || 0} devices`);
      } else toast.error(data?.error || "Failed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoadingDevices(false);
  };

  const importAllDevices = async () => {
    setImportingDevices(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "list-cloud-devices", import_devices: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Imported ${data.imported || 0} devices`);
        const { data: devs } = await supabase.from("hikvision_devices").select("*").order("created_at");
        setSavedDevices(devs || []);
        setStep(4);
      } else toast.error(data?.error || "Failed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setImportingDevices(false);
  };

  const runDeviceSync = async (deviceId: string, deviceSerial: string, action: string, extraBody?: Record<string, any>) => {
    setSyncingAction(`${deviceId}-${action}`);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action, device_id: deviceId, device_serial: deviceSerial, ...extraBody },
      });
      if (error) throw error;
      setSyncResults((prev) => ({ ...prev, [`${deviceId}-${action}`]: data }));
      const syncedCount =
        data?.records_synced ??
        ((data?.results?.["sync-attendance"]?.records_synced || 0) +
          (data?.results?.["sync-employees"]?.records_synced || 0));
      if (data?.success) toast.success(`${action.replace(/-/g, " ")} completed — ${syncedCount} records`);
      else toast.error(data?.error || "Failed");
    } catch (e: any) {
      toast.error(e.message);
    }
    setSyncingAction(null);
  };

  const functionsUrl = `${window.location.origin}/api/backend/functions`;
  const webhookUrl = `${functionsUrl}/hikvision-webhook`;
  const STEPS = [
    { num: 1, label: "Connection" },
    { num: 2, label: "Select Site" },
    { num: 3, label: "Devices" },
    { num: 4, label: "Sync & Monitor" },
  ];

  return (
    <Box sx={{ display: "grid", gap: 3, maxWidth: "56rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        {STEPS.map((s, idx) => (
          <Box key={s.num} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ButtonBase
              onClick={() => setStep(s.num)}
              type="button"
              sx={mergeSx(
                {
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                },
                step === s.num
                  ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }
                  : step > s.num
                  ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }
                  : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
              )}
            >
              <Box
                component="span"
                sx={{
                  height: 20,
                  width: 20,
                  borderRadius: "9999px",
                  backgroundColor: "color-mix(in srgb, hsl(var(--background)) 20%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: 700,
                }}
              >
                {step > s.num ? "✓" : s.num}
              </Box>
              {s.label}
            </ButtonBase>
            {idx < STEPS.length - 1 && <Box sx={{ width: 24, height: "1px", bgcolor: "divider" }} />}
          </Box>
        ))}
      </Box>

      {step === 1 && (
        <Card>
          <CardSectionHeader
            icon={Cloud}
            title="Hik-Partner Pro Cloud API"
            subtitle="Keys saved here take priority over server .env fallback secrets"
          />
          <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
            <Alert severity="info">
              {integrations["hik_partner_app_key"]?.trim() && integrations["hik_partner_secret_key"]?.trim()
                ? "Credentials Source: Database Settings (Active)"
                : serverStatus?.hasEnvFallback
                ? "Credentials Source: Server .env Fallback Detected"
                : "Paste your App Key and Secret Key from Hik-Partner Pro OpenAPI Developer Portal."}
            </Alert>
            <TextField
              label="Hik-Partner App Key (HIK_PARTNER_APP_KEY)"
              value={integrations["hik_partner_app_key"] || ""}
              onChange={(e) => updateField("hik_partner_app_key", e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Hik-Partner Secret Key (HIK_PARTNER_SECRET_KEY)"
              type={showSecretKey ? "text" : "password"}
              value={integrations["hik_partner_secret_key"] || ""}
              onChange={(e) => updateField("hik_partner_secret_key", e.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={showSecretKey ? "Hide secret key" : "Show secret key"}
                        onClick={() => setShowSecretKey((prev) => !prev)}
                        edge="end"
                      >
                        {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Webhook Signing Secret (Optional)"
              type={showWebhookSecret ? "text" : "password"}
              value={integrations["hik_webhook_sign_secret"] || ""}
              onChange={(e) => updateField("hik_webhook_sign_secret", e.target.value)}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        aria-label={showWebhookSecret ? "Hide webhook secret" : "Show webhook secret"}
                        onClick={() => setShowWebhookSecret((prev) => !prev)}
                        edge="end"
                      >
                        {showWebhookSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {credentialStatus !== "idle" && (
              <Alert severity={credentialStatus === "valid" ? "success" : "error"}>
                {credentialStatus === "valid"
                  ? `Connected. Area Domain: ${credentialInfo?.areaDomain || "detected"}`
                  : credentialError || "Connection failed. Check your App Key and Secret Key."}
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Button onClick={saveHikCredentials} disabled={saving || testingCredentials} variant="outlined" startIcon={<Save size={15} />}>
                Save Keys
              </Button>
              <Button onClick={testCredentials} disabled={testingCredentials || saving} variant="contained" startIcon={<TestTube size={15} />}>
                {testingCredentials ? "Testing..." : "Save & Test Connection"}
              </Button>
              {credentialStatus === "valid" && (
                <Button onClick={() => setStep(2)} variant="outlined">
                  Continue to Sites
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardSectionHeader icon={Cloud} title="Discover & Select Site" subtitle="Choose default Hik-Partner site" />
          <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
            <Button onClick={discoverSites} disabled={loadingSites} variant="contained" startIcon={<Cloud size={15} />}>
              {loadingSites ? "Discovering..." : "Discover Sites"}
            </Button>
            {sites.length > 0 && (
              <DataTable columnsCount={3}>
                <TableHead>
                  <TableRow>
                    <TableCell>Site Name</TableCell>
                    <TableCell>Site ID</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sites.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.siteName}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>{s.id}</TableCell>
                      <TableCell>
                        {selectedSiteId === s.id ? (
                          <StatusChip label="Default" color="success" />
                        ) : (
                          <Button onClick={() => void selectSite(s.id)} variant="outlined" size="small">
                            Set Default
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            )}
            {selectedSiteId && <Alert severity="success">Default site ID: {selectedSiteId}</Alert>}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Stack spacing={2}>
          <Card>
            <CardSectionHeader icon={Cloud} title="Device Discovery" subtitle="Discover and import cloud biometric readers" />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              <Stack direction="row" spacing={1}>
                <Button onClick={discoverDevices} disabled={loadingDevices} variant="outlined" startIcon={<Cloud size={15} />}>
                  {loadingDevices ? "Loading..." : "Discover Devices"}
                </Button>
                {cloudDevices.length > 0 && (
                  <Button onClick={importAllDevices} disabled={importingDevices} variant="contained" startIcon={<Plus size={15} />}>
                    Import All Devices
                  </Button>
                )}
              </Stack>
              {cloudDevices.length > 0 && (
                <DataTable columnsCount={5}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Device</TableCell>
                      <TableCell>Serial</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Site</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cloudDevices.map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{d.deviceName || d.deviceSerial}</TableCell>
                        <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>{d.deviceSerial}</TableCell>
                        <TableCell>{d.deviceModel || "—"}</TableCell>
                        <TableCell>{d._siteName || "—"}</TableCell>
                        <TableCell>
                          <StatusChip label={String(d.deviceOnlineStatus) === "1" ? "Online" : "Offline"} color={String(d.deviceOnlineStatus) === "1" ? "success" : "default"} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              )}
            </CardContent>
          </Card>
          <Button onClick={() => setStep(4)} disabled={savedDevices.length === 0} variant="contained" sx={{ alignSelf: "flex-start" }}>
            Continue to Sync
          </Button>
        </Stack>
      )}

      {step === 4 && (
        <Stack spacing={3}>
          <Card>
            <CardSectionHeader icon={Globe} title="Webhook Configuration" subtitle="Set this URL in Hik-Partner Pro for live attendance events" />
            <CardContent sx={{ px: 3, pb: 3 }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField value={webhookUrl} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Hikvision Webhook URL" } }} sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }} />
                <IconButton onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copied!"); }} aria-label="Copy webhook URL">
                  <Copy size={16} />
                </IconButton>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardSectionHeader icon={RefreshCw} title="Sync Actions" subtitle="Trigger manual employee or attendance sync per device" />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
              {savedDevices.length === 0 ? (
                <Typography color="text.secondary">No saved devices. Go back to Step 3.</Typography>
              ) : (
                savedDevices.map((d) => (
                  <Box key={d.id} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, "& > :not([hidden]) ~ :not([hidden])": { mt: 1.5 } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>
                          {d.device_serial} · {d.device_model || "Unknown"}
                        </Typography>
                      </Box>
                      <StatusChip label={d.status} color={d.status === "active" ? "success" : "default"} />
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                      <Button onClick={() => void runDeviceSync(d.id, d.device_serial || d.ip_address, "sync-employees")} disabled={!!syncingAction} variant="outlined" size="small" startIcon={<User size={14} />}>
                        Sync Employees
                      </Button>
                      <Button onClick={() => void runDeviceSync(d.id, d.device_serial || d.ip_address, "sync-attendance")} disabled={!!syncingAction} variant="outlined" size="small" startIcon={<Clock size={14} />}>
                        Poll Attendance
                      </Button>
                      <Button onClick={() => void runDeviceSync(d.id, d.device_serial || d.ip_address, "full-sync")} disabled={!!syncingAction} variant="outlined" size="small" startIcon={<RefreshCw size={14} />}>
                        Full Sync
                      </Button>
                    </Stack>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", pt: 1 }}>
                      <TextField
                        type="datetime-local"
                        value={backfillStart}
                        onChange={(e) => setBackfillStart(e.target.value)}
                        label="Start"
                        size="small"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        type="datetime-local"
                        value={backfillEnd}
                        onChange={(e) => setBackfillEnd(e.target.value)}
                        label="End"
                        size="small"
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <Button
                        disabled={!!syncingAction || !backfillStart || !backfillEnd}
                        onClick={() =>
                          void runDeviceSync(d.id, d.device_serial || d.ip_address, "backfill-attendance", {
                            start_time: new Date(backfillStart).toISOString(),
                            end_time: new Date(backfillEnd).toISOString(),
                          })
                        }
                        variant="outlined"
                        size="small"
                      >
                        Backfill
                      </Button>
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardSectionHeader icon={Code} title="End-to-End Pipeline Test" subtitle="Insert mock attendance punch events for verification" />
            <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 1.5 } }}>
              <Button onClick={() => void runDeviceSync(savedDevices[0]?.id || "", savedDevices[0]?.device_serial || "", "demo-test")} disabled={!!syncingAction} variant="outlined" startIcon={<TestTube size={15} />}>
                Run Demo Test
              </Button>
              {syncResults[`${savedDevices[0]?.id || ""}-demo-test`] && (
                <Alert severity={syncResults[`${savedDevices[0]?.id || ""}-demo-test`].errors?.length ? "error" : "success"}>
                  Logs in DB: {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification?.logs_in_db ?? 0}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}

// ─── Templates Tab ──────────────────────────────────────────────
interface Template {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables: any;
  is_default: boolean;
  created_at: string;
}

const typeIcons: Record<string, any> = { email: Mail, sms: MessageSquare, invoice: FileText, quotation: File };
const variablesList = ["{{customer_name}}", "{{invoice_number}}", "{{quotation_number}}", "{{amount}}", "{{date}}", "{{company_name}}", "{{repair_status}}"];

function TemplatesTab() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "email", subject: "", body: "" });

  const fetchTemplates = async () => {
    setLoading(true);
    let query = supabase.from("templates").select("*").order("created_at", { ascending: false });
    if (tab !== "all") query = query.eq("type", tab as any);
    const { data } = await query;
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => {
    void fetchTemplates();
  }, [tab]);

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", type: "email", subject: "", body: "" });
    setSheetOpen(true);
  };

  const openEdit = (t: Template) => {
    setEditId(t.id);
    setForm({ name: t.name, type: t.type, subject: t.subject || "", body: t.body });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.body) {
      toast.error("Name and body are required");
      return;
    }
    const payload = { name: form.name, type: form.type as any, subject: form.subject || null, body: form.body, created_by: user?.id };
    if (editId) {
      const { error } = await supabase.from("templates").update(payload).eq("id", editId);
      if (error) toast.error(error.message);
      else toast.success("Template updated");
    } else {
      const { error } = await supabase.from("templates").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Template created");
    }
    setSheetOpen(false);
    void fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Delete this template?"))) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void fetchTemplates();
    }
  };

  return (
    <Card>
      <CardSectionHeader
        icon={File}
        title="Message & Document Templates"
        subtitle="Manage reusable email, SMS, invoice, and quotation copy"
        action={
          <Button onClick={openNew} size="small" variant="contained" startIcon={<Plus size={15} />}>
            New Template
          </Button>
        }
      />
      <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
        <TabView value={tab} onChange={setTab}>
          <TabBar>
            <Tab value="all" label="All" />
            <Tab value="email" label="Email" />
            <Tab value="sms" label="SMS" />
            <Tab value="invoice" label="Invoice" />
            <Tab value="quotation" label="Quotation" />
          </TabBar>
        </TabView>

        {loading ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Loading templates...
          </Typography>
        ) : templates.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            No templates yet. Create your first one!
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
            {templates.map((t) => {
              const Icon = typeIcons[t.type] || File;
              return (
                <Card key={t.id} variant="outlined">
                  <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: "action.hover", display: "grid", placeItems: "center" }}>
                      <Icon size={18} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {t.name}
                      </Typography>
                      {t.subject && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {t.subject}
                        </Typography>
                      )}
                    </Box>
                    <StatusChip label={t.type} variant="outlined" sx={{ textTransform: "capitalize" }} />
                    <IconButton onClick={() => openEdit(t)} aria-label="Edit template" size="small">
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton onClick={() => void handleDelete(t.id)} aria-label="Delete template" size="small" color="error">
                      <Trash2 size={15} />
                    </IconButton>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </CardContent>

      <SideDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editId ? "Edit Template" : "New Template"}
        description="Create reusable message templates with dynamic variables"
        width={520}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} variant="contained">
              {editId ? "Update" : "Create"} Template
            </Button>
          </>
        }
      >
        <Stack spacing={2}>
          <TextField value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} label="Name *" size="small" fullWidth />
          <TextField value={form.type} label="Type" select size="small" fullWidth onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            <MenuItem value="email">Email</MenuItem>
            <MenuItem value="sms">SMS</MenuItem>
            <MenuItem value="invoice">Invoice</MenuItem>
            <MenuItem value="quotation">Quotation</MenuItem>
          </TextField>
          {form.type === "email" && (
            <TextField value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} label="Subject" size="small" fullWidth />
          )}
          <TextField value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={8} label="Body *" size="small" fullWidth multiline />
          {form.type === "sms" && (
            <Typography variant="caption" color="text.secondary">
              {form.body.length}/160 characters
            </Typography>
          )}
          <Box>
            <FormLabel>Insert Variable</FormLabel>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
              {variablesList.map((v) => (
                <Button key={v} onClick={() => setForm((p) => ({ ...p, body: p.body + v }))} variant="outlined" size="small" sx={{ fontSize: "0.75rem" }}>
                  {v}
                </Button>
              ))}
            </Box>
          </Box>
        </Stack>
      </SideDrawer>
    </Card>
  );
}

// ─── Service Categories Tab ─────────────────────────────────────
function ServiceCategoriesTab() {
  const [categories, setCategories] = useState<{ id: string; name: string; default_charge: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", default_charge: "" });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from("service_charge_categories").select("*").order("name");
    if (data) setCategories(data);
    setLoading(false);
  };

  useEffect(() => {
    void fetchCategories();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = { name: form.name, default_charge: parseFloat(form.default_charge) || 0 };
    if (editId) {
      const { error } = await supabase.from("service_charge_categories").update(payload).eq("id", editId);
      if (error) toast.error(error.message);
      else {
        toast.success("Category updated");
        setEditId(null);
        setForm({ name: "", default_charge: "" });
        void fetchCategories();
      }
    } else {
      const { error } = await supabase.from("service_charge_categories").insert(payload);
      if (error) toast.error(error.message);
      else {
        toast.success("Category added");
        setForm({ name: "", default_charge: "" });
        void fetchCategories();
      }
    }
    setSaving(false);
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("service_charge_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void fetchCategories();
    }
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" }, gap: 3, alignItems: "start" }}>
      <Card>
        <CardSectionHeader
          icon={Wrench}
          title={editId ? "Edit Service Category" : "Add Service Category"}
          subtitle="Set default service charges per device category"
        />
        <CardContent sx={{ px: 3, pb: 3, "& > :not([hidden]) ~ :not([hidden])": { mt: 2 } }}>
          <TextField
            placeholder="e.g. iPhone"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            label="Category Name"
            size="small"
            fullWidth
          />
          <TextField
            type="number"
            placeholder="e.g. 750"
            value={form.default_charge}
            onChange={(e) => setForm((p) => ({ ...p, default_charge: e.target.value }))}
            label="Default Charge (₹)"
            size="small"
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <Button onClick={save} disabled={saving || !form.name} variant="contained" startIcon={<Save size={15} />}>
              {editId ? "Update" : "Add Category"}
            </Button>
            {editId && (
              <Button onClick={() => { setEditId(null); setForm({ name: "", default_charge: "" }); }} variant="outlined">
                Cancel
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardSectionHeader title="Existing Categories" subtitle={`${categories.length} device service categories configured`} />
        <CardContent sx={{ px: 3, pb: 3 }}>
          {loading ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Loading categories...
            </Typography>
          ) : (
            <DataTable columnsCount={3}>
              <TableHead>
                <TableRow>
                  <TableCell>Device Category</TableCell>
                  <TableCell>Default Charge</TableCell>
                  <TableCell sx={{ width: 96 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ fontWeight: 500 }}>{c.name}</TableCell>
                    <TableCell>₹{c.default_charge.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton onClick={() => { setEditId(c.id); setForm({ name: c.name, default_charge: String(c.default_charge) }); }} aria-label="Edit category" size="small">
                          <Pencil size={14} />
                        </IconButton>
                        <IconButton onClick={() => void deleteCategory(c.id)} aria-label="Delete category" size="small" color="error">
                          <Trash2 size={14} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
