"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  IconButton,
  MenuItem,
  Skeleton,
  Tab,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Mail,
  MapPin,
  MessageSquare,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Quote,
  ShieldAlert,
  Sparkles,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  ActionMenu,
  AnimatedPage,
  DataTable,
  DistributionWidget,
  EmptyState,
  MetricStrip,
  MotionSection,
  PageHeader,
  ProgressRing,
  SearchToolbar,
  SegmentedControl,
  SideDrawer,
  StatusChip,
  TabBar,
  TabView,
  WidgetCard,
  confirmAction,
  mergeSx,
  toast,
  type MetricStripItem,
} from "@/components/mui";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { easeOut, motionTokens } from "@/lib/motion-presets";
import { pastelPillColors } from "@/lib/pill-style";
import {
  buildCallLink,
  buildMailLink,
  buildWhatsAppLink,
  computeLeadScore,
  detectSuspiciousLead,
  filterAndSortLeads,
  formatLeadAge,
  getFollowUpStatus,
  getLeadInitials,
  parseLeadNotes,
  type LeadQuickFilter,
  type LeadRecordLike,
  type LeadSortBy,
} from "@/lib/leads-utils";

type Lead = LeadRecordLike;

interface LeadActivity {
  id: string;
  lead_id: string;
  type: string;
  description: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

const PIPELINE_STAGES: {
  id: string;
  label: string;
  accent: "info" | "primary" | "warning" | "secondary" | "success" | "error";
  next?: string;
}[] = [
  { id: "new", label: "New", accent: "info", next: "contacted" },
  { id: "contacted", label: "Contacted", accent: "primary", next: "qualified" },
  { id: "qualified", label: "Qualified", accent: "warning", next: "proposal" },
  { id: "proposal", label: "Proposal", accent: "secondary", next: "negotiation" },
  { id: "negotiation", label: "Negotiation", accent: "info", next: "converted" },
  { id: "converted", label: "Converted", accent: "success" },
  { id: "lost", label: "Lost", accent: "error" },
];

const ACTIVITY_TYPES = [
  { id: "call", label: "Call", icon: Phone },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "email", label: "Email", icon: Mail },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "note", label: "Note", icon: Target },
];

const SOURCES = ["website", "whatsapp", "walkin", "referral", "ads", "social", "cold_call"];
const LOST_REASONS = ["Fake / Spam Bot", "No Response", "Price / Budget", "Competitor", "Not Ready Yet"];

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  source: "walkin",
  notes: "",
  assigned_to: "",
  expected_value: "",
  next_follow_up: "",
  pipeline_stage: "new",
  lost_reason: "",
};

function addDaysLocalInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(11, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T11:00`;
}

function downloadLeadsCsv(rows: Lead[], staffMap: Map<string, string>) {
  const headers = [
    "Name",
    "Phone",
    "Email",
    "Source",
    "Stage",
    "Topic",
    "City",
    "Score",
    "Expected Value",
    "Assigned To",
    "Next Follow-up",
    "Lost Reason",
    "Notes",
    "Created At",
  ];
  const escapeCsv = (val: unknown) => {
    const s = String(val ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csvLines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((l) => {
      const parsed = parseLeadNotes(l.notes);
      return [
        l.name,
        l.phone || "",
        l.email || "",
        l.source,
        l.pipeline_stage || "new",
        parsed.topic || "",
        parsed.city || "",
        l.score ?? 0,
        l.expected_value ?? 0,
        l.assigned_to ? staffMap.get(l.assigned_to) || "" : "",
        l.next_follow_up || "",
        l.lost_reason || "",
        parsed.summary || l.notes || "",
        l.created_at,
      ]
        .map(escapeCsv)
        .join(",");
    }),
  ];
  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alvstore-leads-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Leads() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [activityCounts, setActivityCounts] = useState<Record<string, number>>({});
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // View & Filter state
  const [viewMode, setViewMode] = useState<"pipeline" | "table" | "split">("pipeline");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState<LeadQuickFilter>("all");
  const [sortBy, setSortBy] = useState<LeadSortBy>("newest");
  const [showClosedStages, setShowClosedStages] = useState(true);
  const [showInsights, setShowInsights] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("alv-leads-insights") !== "hidden";
  });

  // Multi-select / Bot Purge & DnD state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStageTarget, setBulkStageTarget] = useState("contacted");
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  // Drawer / Split Inspector state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [splitSelectedId, setSplitSelectedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activityForm, setActivityForm] = useState({ type: "note", description: "", outcome: "" });

  const staffMap = useMemo(() => {
    const map = new Map<string, string>();
    staffList.forEach((s) => map.set(s.user_id, s.full_name || "Unnamed"));
    return map;
  }, [staffList]);

  const toggleInsights = () => {
    setShowInsights((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("alv-leads-insights", next ? "visible" : "hidden");
      }
      return next;
    });
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const [leadsRes, actsRes] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("lead_activities").select("lead_id"),
    ]);

    if (leadsRes.error) {
      toast.error(leadsRes.error.message);
    } else {
      const rows = (leadsRes.data || []) as Lead[];
      setLeads(rows);
      setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
      setSplitSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    }

    if (!actsRes.error && actsRes.data) {
      const counts: Record<string, number> = {};
      for (const row of actsRes.data as { lead_id: string }[]) {
        counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
      }
      setActivityCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .then(({ data }) => setStaffList((data || []) as StaffMember[]));
  }, []);

  const fetchActivities = useCallback(async (leadId: string) => {
    const { data } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setActivities((data || []) as LeadActivity[]);
  }, []);

  const populateInspector = useCallback(
    (lead: Lead) => {
      setEditId(lead.id);
      setDetailLead(lead);
      setForm({
        name: lead.name,
        phone: lead.phone || "",
        email: lead.email || "",
        source: lead.source || "walkin",
        notes: lead.notes || "",
        assigned_to: lead.assigned_to || "",
        expected_value: lead.expected_value != null && Number(lead.expected_value) > 0 ? String(lead.expected_value) : "",
        next_follow_up: lead.next_follow_up ? lead.next_follow_up.substring(0, 16) : "",
        pipeline_stage: lead.pipeline_stage || "new",
        lost_reason: lead.lost_reason || "",
      });
      void fetchActivities(lead.id);
    },
    [fetchActivities]
  );

  // Sync Split View inspector with selected item
  useEffect(() => {
    if (viewMode === "split" && splitSelectedId) {
      const found = leads.find((l) => l.id === splitSelectedId);
      if (found) populateInspector(found);
    }
  }, [viewMode, splitSelectedId, leads, populateInspector]);

  const openNew = () => {
    setEditId(null);
    setDetailLead(null);
    setActivities([]);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (lead: Lead) => {
    populateInspector(lead);
    if (viewMode === "split") {
      setSplitSelectedId(lead.id);
    } else {
      setSheetOpen(true);
    }
  };

  const suspiciousMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof detectSuspiciousLead>>();
    for (const l of leads) m.set(l.id, detectSuspiciousLead(l));
    return m;
  }, [leads]);

  const dynamicScoreFor = useCallback(
    (lead: Lead) => computeLeadScore(lead, activityCounts[lead.id] || 0),
    [activityCounts]
  );

  const filteredLeads = useMemo(
    () =>
      filterAndSortLeads(
        leads,
        {
          search,
          stageFilter,
          sourceFilter,
          assigneeFilter,
          quickFilter,
          sortBy,
        },
        activityCounts
      ),
    [leads, search, stageFilter, sourceFilter, assigneeFilter, quickFilter, sortBy, activityCounts]
  );

  const kpis = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const total = leads.length;
    const thisWeek = leads.filter((l) => Date.parse(l.created_at) >= weekAgo).length;
    const converted = leads.filter((l) => (l.pipeline_stage || "new") === "converted").length;
    const lost = leads.filter((l) => (l.pipeline_stage || "new") === "lost").length;
    const active = leads.filter((l) => !["converted", "lost"].includes(l.pipeline_stage || "new"));
    const overdue = active.filter((l) => getFollowUpStatus(l) === "overdue").length;
    const hot = active.filter((l) => dynamicScoreFor(l) >= 70).length;
    const suspicious = leads.filter((l) => suspiciousMap.get(l.id)?.suspicious).length;
    const pipelineValue = active.reduce((s, l) => s + Number(l.expected_value || 0), 0);
    const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const readyActive = active.filter(
      (l) => Boolean(l.phone || l.email) && (Boolean(l.next_follow_up) || (activityCounts[l.id] || 0) > 0)
    ).length;
    const readinessPct = active.length > 0 ? Math.round((readyActive / active.length) * 100) : total > 0 ? 100 : 0;

    return {
      total,
      thisWeek,
      converted,
      lost,
      activeCount: active.length,
      overdue,
      hot,
      suspicious,
      pipelineValue,
      convRate,
      readinessPct,
    };
  }, [leads, dynamicScoreFor, suspiciousMap, activityCounts]);

  const sourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) {
      const key = (l.source || "walkin").replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [leads]);

  const pipelineGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    PIPELINE_STAGES.forEach((s) => {
      groups[s.id] = [];
    });
    for (const l of filteredLeads) {
      const st = l.pipeline_stage || "new";
      if (groups[st]) groups[st].push(l);
      else groups.new.push(l);
    }
    return groups;
  }, [filteredLeads]);

  const allStageTotals = useMemo(() => {
    const groups: Record<string, { count: number; value: number }> = {};
    PIPELINE_STAGES.forEach((s) => {
      groups[s.id] = { count: 0, value: 0 };
    });
    for (const l of leads) {
      const st = l.pipeline_stage || "new";
      if (!groups[st]) groups[st] = { count: 0, value: 0 };
      groups[st].count += 1;
      groups[st].value += Number(l.expected_value || 0);
    }
    return groups;
  }, [leads]);

  const visiblePipelineStages = useMemo(
    () => (showClosedStages ? PIPELINE_STAGES : PIPELINE_STAGES.filter((s) => s.id !== "converted" && s.id !== "lost")),
    [showClosedStages]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const convertLead = async (
    lead: Lead,
    opts?: { openQuotation?: boolean; silentToast?: boolean }
  ): Promise<string | null> => {
    setBusyLeadId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("leads-convert", {
        body: { lead_id: lead.id },
      });
      if (error) {
        toast.error(error.message || "Conversion failed");
        return null;
      }
      const customerId = data?.customer?.id || data?.lead?.converted_customer_id;
      if (!customerId) {
        toast.error("Customer conversion did not return an ID");
        return null;
      }
      if (!opts?.silentToast) {
        toast.success(
          data?.reusedExistingCustomer
            ? "Linked lead to matching existing customer"
            : "Lead converted & added to Customers"
        );
      }
      await fetchLeads();
      if (opts?.openQuotation) {
        setSheetOpen(false);
        navigate(`/sales/new?customerId=${customerId}`);
      }
      return customerId;
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleCreateQuotation = async (lead: Lead) => {
    if (lead.converted_customer_id) {
      setSheetOpen(false);
      navigate(`/sales/new?customerId=${lead.converted_customer_id}`);
      return;
    }
    await convertLead(lead, { openQuotation: true });
  };

  const handleStageChange = async (lead: Lead, nextStage: string, extraFields?: Record<string, unknown>) => {
    if ((lead.pipeline_stage || "new") === nextStage && !extraFields) return;
    if (nextStage === "converted") {
      await convertLead(lead, { openQuotation: false });
      return;
    }
    const status = nextStage === "lost" ? "lost" : "new";
    setBusyLeadId(lead.id);
    // Optimistic update for responsive DnD feel
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, pipeline_stage: nextStage, status, ...(extraFields || {}) } : l))
    );
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_stage: nextStage, status, ...(extraFields || {}) } as any)
      .eq("id", lead.id);
    setBusyLeadId(null);
    if (error) {
      toast.error(error.message);
      await fetchLeads();
    } else {
      const stageLabel = PIPELINE_STAGES.find((s) => s.id === nextStage)?.label || nextStage;
      toast.success(`Moved ${lead.name} to ${stageLabel}`);
      await fetchLeads();
    }
  };

  const handleDeleteLeads = async (targetLeads: Lead[]) => {
    if (targetLeads.length === 0) return;
    const isBulk = targetLeads.length > 1;
    const ok = await confirmAction(
      isBulk
        ? `Permanently delete ${targetLeads.length} selected leads and their linked notes & alerts? This cannot be undone.`
        : `Permanently delete lead "${targetLeads[0].name}" and all linked notes & alerts? This cannot be undone.`
    );
    if (!ok) return;

    const ids = targetLeads.map((l) => l.id);
    setBusyLeadId(ids[0]);
    const { data, error } = await supabase.functions.invoke("leads-delete", {
      body: { ids },
    });
    setBusyLeadId(null);

    if (error) {
      toast.error(error.message || "Failed to delete leads");
      return;
    }

    toast.success(`Deleted ${data?.deletedCount ?? ids.length} lead${ids.length > 1 ? "s" : ""}`);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    if (editId && ids.includes(editId)) {
      setSheetOpen(false);
      setEditId(null);
      setDetailLead(null);
    }
    await fetchLeads();
  };

  const handleBulkStageMove = async () => {
    if (selectedIds.length === 0 || bulkStageTarget === "converted") return;
    const status = bulkStageTarget === "lost" ? "lost" : "new";
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_stage: bulkStageTarget, status })
      .in("id", selectedIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Updated ${selectedIds.length} lead(s)`);
    setSelectedIds([]);
    await fetchLeads();
  };

  const handleBulkMarkSpamLost = async () => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase
      .from("leads")
      .update({ pipeline_stage: "lost", status: "lost", lost_reason: "Fake / Spam Bot" })
      .in("id", selectedIds);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked ${selectedIds.length} lead(s) as Spam (Lost)`);
    setSelectedIds([]);
    await fetchLeads();
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const score = computeLeadScore(
      {
        name: form.name,
        phone: form.phone,
        email: form.email,
        source: form.source,
        notes: form.notes,
        expected_value: form.expected_value,
      },
      editId ? activityCounts[editId] || 0 : 0
    );

    const isConvertingNow = form.pipeline_stage === "converted" && editId && !detailLead?.converted_customer_id;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: form.source,
      notes: form.notes.trim() || null,
      assigned_to: form.assigned_to || null,
      score,
      expected_value: form.expected_value ? parseFloat(form.expected_value) : 0,
      next_follow_up: form.next_follow_up || null,
      pipeline_stage: isConvertingNow ? detailLead?.pipeline_stage || "new" : form.pipeline_stage,
      status: form.pipeline_stage === "converted" ? "converted" : form.pipeline_stage === "lost" ? "lost" : "new",
      lost_reason: form.pipeline_stage === "lost" ? form.lost_reason.trim() || null : null,
    };

    if (editId) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editId);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      if (isConvertingNow) {
        const res = await supabase.functions.invoke("leads-convert", { body: { lead_id: editId } });
        if (res.error) toast.warning("Lead saved, customer conversion failed: " + res.error.message);
        else toast.success("Lead updated & linked to Customer");
      } else {
        toast.success("Lead updated");
      }
    } else {
      const createPayload = { ...payload, pipeline_stage: form.pipeline_stage };
      const { data: inserted, error } = await supabase.from("leads").insert(createPayload as any).select().single();
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      if (form.pipeline_stage === "converted" && inserted?.id) {
        await supabase.functions.invoke("leads-convert", { body: { lead_id: inserted.id } });
      }
      toast.success("Lead created");
    }

    setSaving(false);
    setSheetOpen(false);
    await fetchLeads();
  };

  const addActivity = async () => {
    if (!detailLead || !activityForm.description.trim()) {
      toast.error("Activity description is required");
      return;
    }
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: detailLead.id,
      type: activityForm.type,
      description: activityForm.description.trim(),
      outcome: activityForm.outcome.trim() || null,
      created_by: user?.id || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const nextCount = (activityCounts[detailLead.id] || 0) + 1;
    const recomputedScore = computeLeadScore(detailLead, nextCount);
    await supabase.from("leads").update({ score: recomputedScore }).eq("id", detailLead.id);
    toast.success("Activity logged");
    setActivityForm({ type: "note", description: "", outcome: "" });
    await Promise.all([fetchActivities(detailLead.id), fetchLeads()]);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllFlagged = () => {
    const flagged = leads.filter((l) => suspiciousMap.get(l.id)?.suspicious).map((l) => l.id);
    if (flagged.length === 0) {
      toast.info("No suspicious or bot-like leads detected right now");
      return;
    }
    setSelectedIds(flagged);
    setQuickFilter("suspicious");
  };

  // ── Top KPI Strip ─────────────────────────────────────────────────────────
  const metricItems: MetricStripItem[] = useMemo(
    () => [
      {
        id: "total",
        label: "Total Leads",
        value: kpis.total,
        caption: `+${kpis.thisWeek} this week`,
        icon: <Target size={19} />,
        accent: "primary",
        onClick: () => {
          setQuickFilter("all");
          setStageFilter("all");
        },
      },
      {
        id: "pipeline",
        label: "Active Pipeline",
        value: kpis.pipelineValue,
        isCurrency: true,
        caption: `${kpis.activeCount} active deals`,
        icon: <TrendingUp size={19} />,
        accent: "info",
        onClick: () => setQuickFilter("unconverted"),
      },
      {
        id: "hot",
        label: "Hot Leads (70+)",
        value: kpis.hot,
        caption: "High intent / scored",
        icon: <Flame size={19} />,
        accent: "success",
        onClick: () => setQuickFilter((q) => (q === "hot" ? "all" : "hot")),
      },
      {
        id: "overdue",
        label: "Overdue",
        value: kpis.overdue,
        caption: kpis.overdue > 0 ? "Needs immediate call" : "All caught up",
        icon: <AlertTriangle size={19} />,
        accent: "warning",
        onClick: () => setQuickFilter((q) => (q === "overdue" ? "all" : "overdue")),
      },
      {
        id: "conversion",
        label: "Conversion Rate",
        value: kpis.convRate,
        formatter: (v) => `${Math.round(v)}%`,
        caption: `${kpis.converted} converted · ${kpis.lost} lost`,
        icon: <UserPlus size={19} />,
        accent: "primary",
        onClick: () => setStageFilter((s) => (s === "converted" ? "all" : "converted")),
      },
    ],
    [kpis]
  );

  // ── Shared Lead Inspector Form & Timeline Body (used by SideDrawer + Split View) ──
  const renderLeadFormAndTimeline = (inSplitPane: boolean) => (
    <Box sx={{ display: "grid", gap: 2 }}>
      {/* Stage Stepper Pills */}
      {editId && detailLead && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Pipeline Stage
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {PIPELINE_STAGES.map((st) => {
              const active = form.pipeline_stage === st.id;
              const pillColor = pastelPillColors(theme.palette[st.accent].main, theme.palette.background.paper, isDark);
              return (
                <Chip
                  key={st.id}
                  size="small"
                  label={st.label}
                  clickable
                  onClick={() => setForm((p) => ({ ...p, pipeline_stage: st.id }))}
                  sx={{
                    fontWeight: active ? 700 : 500,
                    border: "1px solid",
                    borderColor: active ? theme.palette[st.accent].main : "divider",
                    ...(active ? pillColor : { bgcolor: "transparent", color: "text.secondary" }),
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {detailLead && suspiciousMap.get(detailLead.id)?.suspicious && (
        <Alert
          severity="warning"
          icon={<Bot size={18} />}
          action={
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => void handleDeleteLeads([detailLead])}
            >
              Delete Lead
            </Button>
          }
        >
          Suspicious signals: {suspiciousMap.get(detailLead.id)!.reasons.join(" · ")}
        </Alert>
      )}

      <TextField
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        label="Name *"
        size="small"
        fullWidth
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        <TextField
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          label="Phone"
          size="small"
          fullWidth
        />
        <TextField
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          label="Email"
          size="small"
          fullWidth
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        <TextField
          value={form.source}
          label="Source"
          select
          size="small"
          fullWidth
          onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          {SOURCES.map((s) => (
            <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>
              {s.replace("_", " ")}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          value={form.pipeline_stage}
          label="Pipeline Stage"
          select
          size="small"
          fullWidth
          onChange={(e) => setForm((p) => ({ ...p, pipeline_stage: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          {PIPELINE_STAGES.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {form.pipeline_stage === "lost" && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <TextField
            value={form.lost_reason}
            onChange={(e) => setForm((p) => ({ ...p, lost_reason: e.target.value }))}
            label="Lost / Rejection Reason"
            size="small"
            fullWidth
          />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {LOST_REASONS.map((r) => (
              <Chip
                key={r}
                size="small"
                label={r}
                variant={form.lost_reason === r ? "filled" : "outlined"}
                onClick={() => setForm((p) => ({ ...p, lost_reason: r }))}
              />
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
        <TextField
          type="number"
          value={form.expected_value}
          onChange={(e) => setForm((p) => ({ ...p, expected_value: e.target.value }))}
          label="Expected Value (₹)"
          size="small"
          fullWidth
        />
        <TextField
          type="datetime-local"
          value={form.next_follow_up}
          onChange={(e) => setForm((p) => ({ ...p, next_follow_up: e.target.value }))}
          label="Next Follow-up"
          size="small"
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>

      {/* Quick Follow-Up Scheduling Presets */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary">
          Quick follow-up:
        </Typography>
        {[
          { label: "Tomorrow 11am", days: 1 },
          { label: "+3 Days", days: 3 },
          { label: "+1 Week", days: 7 },
        ].map((preset) => (
          <Chip
            key={preset.label}
            size="small"
            variant="outlined"
            label={preset.label}
            onClick={() => setForm((p) => ({ ...p, next_follow_up: addDaysLocalInput(preset.days) }))}
          />
        ))}
      </Box>

      <TextField
        value={form.assigned_to}
        label="Assign To"
        select
        size="small"
        fullWidth
        onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
      >
        <MenuItem value="">Unassigned</MenuItem>
        {staffList.map((s) => (
          <MenuItem key={s.user_id} value={s.user_id}>
            {s.full_name || "Unnamed"}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        rows={3}
        label="Enquiry Notes (Topic:, City:, requirements)"
        size="small"
        fullWidth
        multiline
      />

      {inSplitPane && detailLead && (
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 1, pt: 0.5 }}>
          <Button
            color="error"
            variant="outlined"
            size="small"
            startIcon={<Trash2 size={15} />}
            onClick={() => void handleDeleteLeads([detailLead])}
          >
            Delete Lead
          </Button>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {!detailLead.converted_customer_id ? (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UserPlus size={15} />}
                  onClick={() => void convertLead(detailLead)}
                >
                  Convert Customer
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="success"
                  startIcon={<FileText size={15} />}
                  onClick={() => void handleCreateQuotation(detailLead)}
                >
                  Convert & Quote
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<FileText size={15} />}
                onClick={() => void handleCreateQuotation(detailLead)}
              >
                Create Quotation
              </Button>
            )}
            <Button size="small" variant="contained" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Update Lead"}
            </Button>
          </Box>
        </Box>
      )}

      {/* Activity Timeline */}
      {editId && detailLead && (
        <Box sx={{ mt: 1, display: "grid", gap: 1.5 }}>
          <Divider />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Activity Timeline ({activities.length})
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75 }}>
              {buildCallLink(detailLead.phone) && (
                <Button size="small" variant="outlined" component="a" href={buildCallLink(detailLead.phone)!} startIcon={<Phone size={13} />}>
                  Call
                </Button>
              )}
              {buildWhatsAppLink(detailLead.phone, detailLead.name) && (
                <Button
                  size="small"
                  variant="outlined"
                  component="a"
                  href={buildWhatsAppLink(detailLead.phone, detailLead.name)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<MessageSquare size={13} />}
                >
                  WhatsApp
                </Button>
              )}
              {buildMailLink(detailLead.email, parseLeadNotes(detailLead.notes).topic) && (
                <Button
                  size="small"
                  variant="outlined"
                  component="a"
                  href={buildMailLink(detailLead.email, parseLeadNotes(detailLead.notes).topic)!}
                  startIcon={<Mail size={13} />}
                >
                  Email
                </Button>
              )}
            </Box>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: "12px" }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "grid", gap: 1 }}>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  value={activityForm.type}
                  select
                  size="small"
                  onChange={(e) => setActivityForm((p) => ({ ...p, type: e.target.value }))}
                  slotProps={{ select: { displayEmpty: true } }}
                  sx={{ width: 120 }}
                >
                  {ACTIVITY_TYPES.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  placeholder="What happened on this call / visit?"
                  value={activityForm.description}
                  onChange={(e) => setActivityForm((p) => ({ ...p, description: e.target.value }))}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { "aria-label": "What happened?" } }}
                />
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  placeholder="Outcome (optional)"
                  value={activityForm.outcome}
                  onChange={(e) => setActivityForm((p) => ({ ...p, outcome: e.target.value }))}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { "aria-label": "Outcome (optional)" } }}
                />
                <Button onClick={() => void addActivity()} variant="contained" size="small" startIcon={<Plus size={14} />}>
                  Log
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ display: "grid", gap: 1, maxHeight: 260, overflowY: "auto" }}>
            {activities.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                No logged interactions yet
              </Typography>
            ) : (
              activities.map((a) => {
                const actType = ACTIVITY_TYPES.find((t) => t.id === a.type);
                const Icon = actType?.icon || Target;
                return (
                  <Box
                    key={a.id}
                    sx={{
                      display: "flex",
                      gap: 1.25,
                      p: 1.25,
                      borderRadius: "10px",
                      bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        display: "grid",
                        placeItems: "center",
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: "primary.main",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <StatusChip label={a.type} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                          {format(new Date(a.created_at), "dd MMM, HH:mm")}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: 12.5, mt: 0.35 }}>
                        {a.description}
                      </Typography>
                      {a.outcome && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          Outcome: {a.outcome}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5, minWidth: 0 }}>
        {/* Header */}
        <PageHeader
          title="Lead Management"
          subtitle="2026 CRM pipeline · full-context cards, bot triage & quotation handoff"
          actions={
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<BarChart3 size={15} />}
                onClick={toggleInsights}
              >
                {showInsights ? "Hide Insights" : "Show Insights"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FileText size={15} />}
                onClick={() => downloadLeadsCsv(filteredLeads, staffMap)}
              >
                Export CSV
              </Button>
              <Button onClick={openNew} variant="contained" startIcon={<Plus size={16} />}>
                New Lead
              </Button>
            </Box>
          }
        />

        {/* Unified MetricStrip KPI Row */}
        <MetricStrip items={metricItems} loading={loading} />

        {/* Collapsible Bento Analytics Strip */}
        <Collapse in={showInsights} timeout={reduced ? 0 : 220}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                lg: "minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 0.95fr)",
              },
              gap: 2,
              minWidth: 0,
            }}
          >
            {/* Widget 1: Interactive Pipeline Funnel */}
            <WidgetCard
              title="Stage Funnel"
              subtitle="Click any stage bar to filter active view"
              index={1}
              action={
                stageFilter !== "all" ? (
                  <Button size="small" variant="text" onClick={() => setStageFilter("all")}>
                    Reset
                  </Button>
                ) : null
              }
            >
              <Box sx={{ display: "grid", gap: 1.15 }}>
                {PIPELINE_STAGES.map((st, idx) => {
                  const stat = allStageTotals[st.id] || { count: 0, value: 0 };
                  const pct = kpis.total > 0 ? Math.round((stat.count / kpis.total) * 100) : 0;
                  const barColor = theme.palette[st.accent].main;
                  const active = stageFilter === st.id;
                  return (
                    <Box
                      key={st.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setStageFilter((cur) => (cur === st.id ? "all" : st.id))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setStageFilter((cur) => (cur === st.id ? "all" : st.id));
                        }
                      }}
                      sx={{
                        p: 0.75,
                        mx: -0.75,
                        borderRadius: "10px",
                        cursor: "pointer",
                        bgcolor: active ? alpha(barColor, isDark ? 0.14 : 0.08) : "transparent",
                        transition: "background-color 140ms ease",
                        "&:hover": { bgcolor: alpha(barColor, isDark ? 0.1 : 0.05) },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.4, gap: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: barColor }} />
                          <Typography variant="caption" sx={{ fontWeight: active ? 700 : 600 }}>
                            {st.label}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {stat.count} · ₹{stat.value.toLocaleString("en-IN")} ({pct}%)
                        </Typography>
                      </Box>
                      <Box sx={{ height: 6, borderRadius: 4, bgcolor: alpha(barColor, 0.12), overflow: "hidden" }}>
                        <Box
                          component={motion.div}
                          initial={reduced ? false : { scaleX: 0 }}
                          animate={{ scaleX: Math.max(stat.count > 0 ? 0.04 : 0, pct / 100) }}
                          transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : idx * 0.03, ease: easeOut }}
                          sx={{ height: "100%", width: "100%", transformOrigin: "left center", borderRadius: 4, bgcolor: barColor }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </WidgetCard>

            {/* Widget 2: Source Attribution Donut */}
            <DistributionWidget
              title="Channel Mix"
              subtitle="Where enquiries originate"
              items={sourceBreakdown}
              loading={loading}
              index={2}
              formatter={(v) => `${Math.round(v)}`}
            />

            {/* Widget 3: Follow-up Readiness & Bot Watch */}
            <WidgetCard title="Follow-Up Hygiene & Bot Watch" subtitle="Active contact reachability & spam guard" index={3}>
              <Box sx={{ display: "grid", gap: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <ProgressRing
                    value={kpis.readinessPct}
                    label="CRM readiness"
                    size={96}
                    color={kpis.readinessPct >= 75 ? "success" : "primary"}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Active Hygiene
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                      % of active leads with contact details plus a scheduled follow-up or logged touchpoint.
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: "12px",
                    border: "1px solid",
                    borderColor: kpis.suspicious > 0 ? alpha(theme.palette.warning.main, 0.45) : "divider",
                    bgcolor:
                      kpis.suspicious > 0
                        ? alpha(theme.palette.warning.main, isDark ? 0.1 : 0.06)
                        : alpha(theme.palette.success.main, isDark ? 0.08 : 0.04),
                    display: "grid",
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      {kpis.suspicious > 0 ? (
                        <ShieldAlert size={17} color={theme.palette.warning.main} />
                      ) : (
                        <CheckCircle2 size={17} color={theme.palette.success.main} />
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>
                        {kpis.suspicious > 0
                          ? `${kpis.suspicious} Flagged / Bot-like`
                          : "No Spam Detected"}
                      </Typography>
                    </Box>
                    <StatusChip
                      label={kpis.suspicious > 0 ? "Review" : "Clean"}
                      variant="outlined"
                      sx={{ fontSize: 10 }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Detects dummy phone numbers, test/URL names, and disposable domains for fast deletion.
                  </Typography>
                  {kpis.suspicious > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        onClick={() => setQuickFilter((q) => (q === "suspicious" ? "all" : "suspicious"))}
                      >
                        {quickFilter === "suspicious" ? "Show All Leads" : `Filter Flagged (${kpis.suspicious})`}
                      </Button>
                      <Button size="small" variant="contained" color="warning" onClick={selectAllFlagged}>
                        Select Flagged
                      </Button>
                    </Box>
                  )}
                </Box>
              </Box>
            </WidgetCard>
          </Box>
        </Collapse>

        {/* Toolbar: Segmented Switcher + Search + Filters */}
        <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}
          >
            <SegmentedControl
              label="Leads view mode"
              value={viewMode}
              onChange={(val) => setViewMode(val)}
              options={[
                { value: "pipeline", label: "Pipeline" },
                { value: "table", label: "Table" },
                { value: "split", label: "Split View" },
              ]}
            />

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
              <SearchToolbar
                onSearch={setSearch}
                value={search}
                placeholder="Search leads, topic, city, phone..."
                sx={{ flex: 1, minWidth: 200, maxWidth: 320 }}
              />
              <TextField
                select
                size="small"
                label="Source"
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 130 }}
              >
                <MenuItem value="all">All Sources</MenuItem>
                {SOURCES.map((s) => (
                  <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>
                    {s.replace("_", " ")}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Owner"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 145 }}
              >
                <MenuItem value="all">All Owners</MenuItem>
                <MenuItem value="__unassigned__">Unassigned</MenuItem>
                {staffList.map((s) => (
                  <MenuItem key={s.user_id} value={s.user_id}>
                    {s.full_name || "Unnamed"}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as LeadSortBy)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 145 }}
              >
                <MenuItem value="newest">Newest First</MenuItem>
                <MenuItem value="score">Highest Score</MenuItem>
                <MenuItem value="value">Highest Deal Value</MenuItem>
                <MenuItem value="followup">Follow-up Due</MenuItem>
              </TextField>
            </Box>
          </Box>

          {/* Quick Triage Filter Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              {([
                ["all", `All (${leads.length})`],
                ["unconverted", `Active (${kpis.activeCount})`],
                ["hot", `Hot (${kpis.hot})`],
                ["overdue", `Overdue (${kpis.overdue})`],
                ["unassigned", "Unassigned"],
                ["suspicious", `Flagged / Spam (${kpis.suspicious})`],
              ] as [LeadQuickFilter, string][]).map(([key, label]) => (
                <Chip
                  key={key}
                  size="small"
                  label={label}
                  clickable
                  color={key === "suspicious" && kpis.suspicious > 0 ? "warning" : key === "overdue" && kpis.overdue > 0 ? "error" : "primary"}
                  variant={quickFilter === key ? "filled" : "outlined"}
                  onClick={() => setQuickFilter(key)}
                />
              ))}
              {stageFilter !== "all" && (
                <Chip
                  size="small"
                  label={`Stage: ${PIPELINE_STAGES.find((s) => s.id === stageFilter)?.label || stageFilter}`}
                  onDelete={() => setStageFilter("all")}
                  color="secondary"
                />
              )}
            </Box>

            {viewMode === "pipeline" && (
              <Chip
                size="small"
                clickable
                variant={showClosedStages ? "filled" : "outlined"}
                label={showClosedStages ? "Showing Won & Lost" : "Show Won & Lost"}
                onClick={() => setShowClosedStages((v) => !v)}
              />
            )}
          </Box>
        </Box>

        {/* Animated Floating Bulk Triage Toolbar */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <MotionSection index={0}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: "primary.main",
                  bgcolor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.06),
                  borderRadius: "14px",
                }}
              >
                <CardContent
                  sx={{
                    py: 1.25,
                    px: 2,
                    "&:last-child": { pb: 1.25 },
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected
                    </Typography>
                    <Button size="small" variant="text" onClick={() => setSelectedIds([])}>
                      Clear
                    </Button>
                  </Box>
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                    <TextField
                      select
                      size="small"
                      value={bulkStageTarget}
                      onChange={(e) => setBulkStageTarget(e.target.value)}
                      sx={{ width: 135 }}
                    >
                      {PIPELINE_STAGES.filter((s) => s.id !== "converted").map((s) => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.label}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Button size="small" variant="outlined" onClick={() => void handleBulkStageMove()}>
                      Move Stage
                    </Button>
                    <Button size="small" variant="outlined" color="warning" onClick={() => void handleBulkMarkSpamLost()}>
                      Mark Spam (Lost)
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      startIcon={<Trash2 size={14} />}
                      onClick={() => void handleDeleteLeads(leads.filter((l) => selectedIds.includes(l.id)))}
                    >
                      Delete Selected ({selectedIds.length})
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </MotionSection>
          )}
        </AnimatePresence>

        {/* ── VIEW 1: RICH DRAG-AND-DROP PIPELINE ───────────────────────────── */}
        {viewMode === "pipeline" && (
          <Box sx={{ minWidth: 0, width: "100%" }}>
            {loading ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2 }}>
                {[1, 2, 3, 4].map((n) => (
                  <Skeleton key={n} variant="rounded" height={240} sx={{ borderRadius: "16px" }} />
                ))}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  gap: 1.75,
                  overflowX: "auto",
                  pb: 1.5,
                  minWidth: 0,
                  alignItems: "flex-start",
                }}
              >
                {visiblePipelineStages.map((stage) => {
                  const stageLeads = pipelineGroups[stage.id] || [];
                  const stageTotal = stageLeads.reduce((s, l) => s + Number(l.expected_value || 0), 0);
                  const stageColor = theme.palette[stage.accent].main;
                  const stageChipStyle = pastelPillColors(stageColor, theme.palette.background.paper, isDark);
                  const isDropTarget = dragOverStage === stage.id && dragLeadId !== null;

                  return (
                    <Box
                      key={stage.id}
                      data-pipeline-column={stage.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverStage !== stage.id) setDragOverStage(stage.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverStage === stage.id) setDragOverStage(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedId = e.dataTransfer.getData("text/plain") || dragLeadId;
                        setDragOverStage(null);
                        setDragLeadId(null);
                        const droppedLead = leads.find((l) => l.id === droppedId);
                        if (droppedLead) void handleStageChange(droppedLead, stage.id);
                      }}
                      sx={{
                        width: 312,
                        minWidth: 312,
                        flexShrink: 0,
                        borderRadius: "16px",
                        p: 1.25,
                        border: "1px solid",
                        borderColor: isDropTarget ? stageColor : "divider",
                        bgcolor: isDropTarget
                          ? alpha(stageColor, isDark ? 0.12 : 0.06)
                          : alpha(theme.palette.text.primary, isDark ? 0.025 : 0.018),
                        transition: "border-color 150ms ease, background-color 150ms ease",
                        display: "grid",
                        gap: 1.25,
                      }}
                    >
                      {/* Framed Stage Column Header */}
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5, pt: 0.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <StatusChip label={stage.label} sx={mergeSx(stageChipStyle, { fontWeight: 700, fontSize: 11.5 })} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
                            {stageLeads.length}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {stageTotal > 0 ? `₹${stageTotal.toLocaleString("en-IN")}` : "—"}
                        </Typography>
                      </Box>

                      {/* Cards Stack */}
                      <Box sx={{ display: "grid", gap: 1.25 }}>
                        {stageLeads.map((lead, idx) => {
                          const parsed = parseLeadNotes(lead.notes);
                          const suspicion = suspiciousMap.get(lead.id);
                          const dynScore = dynamicScoreFor(lead);
                          const followStatus = getFollowUpStatus(lead);
                          const callHref = buildCallLink(lead.phone);
                          const waHref = buildWhatsAppLink(lead.phone, lead.name);
                          const mailHref = buildMailLink(lead.email, parsed.topic);
                          const isSelected = selectedIds.includes(lead.id);
                          const nextStageObj = stage.next ? PIPELINE_STAGES.find((s) => s.id === stage.next) : null;

                          return (
                            <Box
                              key={lead.id}
                              component={motion.div}
                              layout={!reduced}
                              initial={reduced ? false : { opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: reduced ? 0 : motionTokens.fast, delay: reduced ? 0 : Math.min(idx * 0.02, 0.16), ease: easeOut }}
                              draggable
                              onDragStart={(e: any) => {
                                setDragLeadId(lead.id);
                                e.dataTransfer?.setData("text/plain", lead.id);
                              }}
                              onDragEnd={() => {
                                setDragLeadId(null);
                                setDragOverStage(null);
                              }}
                              sx={{ minWidth: 0 }}
                            >
                              <Card
                                data-lead-card={lead.id}
                                onClick={() => openEdit(lead)}
                                sx={{
                                  cursor: "pointer",
                                  borderRadius: "14px",
                                  border: "1px solid",
                                  borderColor: isSelected
                                    ? "primary.main"
                                    : suspicion?.suspicious
                                    ? alpha(theme.palette.warning.main, 0.5)
                                    : "divider",
                                  opacity: dragLeadId === lead.id ? 0.55 : busyLeadId === lead.id ? 0.65 : 1,
                                  transition: "border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
                                  "&:hover": {
                                    borderColor: alpha(theme.palette.primary.main, 0.45),
                                    boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, isDark ? 0.28 : 0.07)}`,
                                  },
                                }}
                              >
                                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, display: "grid", gap: 1 }}>
                                  {/* Row 1: Identity, Score, Select, Quick Delete & Menu */}
                                  <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.75 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flex: 1 }}>
                                      <Checkbox
                                        size="small"
                                        checked={isSelected}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => toggleSelectId(lead.id)}
                                        slotProps={{ input: { "aria-label": `Select lead ${lead.name}` } }}
                                        sx={{ p: 0.25 }}
                                      />
                                      <Avatar
                                        sx={{
                                          width: 30,
                                          height: 30,
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          bgcolor: alpha(stageColor, 0.16),
                                          color: stageColor,
                                        }}
                                      >
                                        {getLeadInitials(lead.name)}
                                      </Avatar>
                                      <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="body2" noWrap sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                                          {lead.name}
                                        </Typography>
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                                            {formatLeadAge(lead.created_at)}
                                          </Typography>
                                          <Box
                                            component="span"
                                            sx={{
                                              fontSize: 10,
                                              fontWeight: 700,
                                              color:
                                                dynScore >= 70
                                                  ? "success.main"
                                                  : dynScore <= 35
                                                  ? "warning.main"
                                                  : "primary.main",
                                            }}
                                          >
                                            {dynScore} pts
                                          </Box>
                                        </Box>
                                      </Box>
                                    </Box>

                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                                      <Tooltip title="Delete lead">
                                        <IconButton
                                          size="small"
                                          color="error"
                                          aria-label={`Delete lead ${lead.name}`}
                                          onClick={() => void handleDeleteLeads([lead])}
                                          sx={{ p: 0.5 }}
                                        >
                                          <Trash2 size={14} />
                                        </IconButton>
                                      </Tooltip>
                                      <ActionMenu
                                        trigger={
                                          <IconButton size="small" aria-label={`Actions for ${lead.name}`} sx={{ p: 0.5 }}>
                                            <MoreVertical size={14} />
                                          </IconButton>
                                        }
                                      >
                                        <MenuItem onClick={() => openEdit(lead)}>
                                          <Pencil size={14} style={{ marginRight: 8 }} /> Edit & Timeline
                                        </MenuItem>
                                        {nextStageObj && (
                                          <MenuItem onClick={() => void handleStageChange(lead, nextStageObj.id)}>
                                            <ArrowRight size={14} style={{ marginRight: 8 }} /> Move to {nextStageObj.label}
                                          </MenuItem>
                                        )}
                                        {!lead.converted_customer_id && (
                                          <MenuItem onClick={() => void convertLead(lead)}>
                                            <UserPlus size={14} style={{ marginRight: 8 }} /> Convert to Customer
                                          </MenuItem>
                                        )}
                                        <MenuItem onClick={() => void handleCreateQuotation(lead)}>
                                          <FileText size={14} style={{ marginRight: 8 }} />{" "}
                                          {lead.converted_customer_id ? "Create Quotation" : "Convert & Quote"}
                                        </MenuItem>
                                        {stage.id !== "lost" && (
                                          <MenuItem
                                            onClick={() =>
                                              void handleStageChange(lead, "lost", { lost_reason: "Fake / Spam Bot" })
                                            }
                                          >
                                            <Bot size={14} style={{ marginRight: 8 }} /> Mark Spam (Lost)
                                          </MenuItem>
                                        )}
                                        <MenuItem sx={{ color: "error.main" }} onClick={() => void handleDeleteLeads([lead])}>
                                          <Trash2 size={14} style={{ marginRight: 8 }} /> Delete Lead
                                        </MenuItem>
                                      </ActionMenu>
                                    </Box>
                                  </Box>

                                  {/* Row 2: Full Contact Details (Both Phone & Email + 1-tap triggers) */}
                                  <Box sx={{ display: "grid", gap: 0.35 }}>
                                    {lead.phone && (
                                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75 }}>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                                          <Phone size={12} /> {lead.phone}
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                                          {callHref && (
                                            <Tooltip title="Call">
                                              <IconButton size="small" component="a" href={callHref} aria-label={`Call ${lead.name}`} sx={{ p: 0.35 }}>
                                                <Phone size={12.5} />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          {waHref && (
                                            <Tooltip title="WhatsApp">
                                              <IconButton
                                                size="small"
                                                component="a"
                                                href={waHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label={`WhatsApp ${lead.name}`}
                                                sx={{ p: 0.35, color: "success.main" }}
                                              >
                                                <MessageSquare size={12.5} />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Box>
                                      </Box>
                                    )}
                                    {lead.email && (
                                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75 }}>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "flex", alignItems: "center", gap: 0.6, minWidth: 0 }}>
                                          <Mail size={12} /> {lead.email}
                                        </Typography>
                                        {mailHref && (
                                          <Box onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title="Send Email">
                                              <IconButton size="small" component="a" href={mailHref} aria-label={`Email ${lead.name}`} sx={{ p: 0.35 }}>
                                                <Mail size={12.5} />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>
                                        )}
                                      </Box>
                                    )}
                                    {!lead.phone && !lead.email && (
                                      <Typography variant="caption" color="text.disabled">
                                        No phone or email provided
                                      </Typography>
                                    )}
                                  </Box>

                                  {/* Row 3: Topic / City Tags & Notes Snippet */}
                                  {(parsed.topic || parsed.city || parsed.summary || suspicion?.suspicious) && (
                                    <Box sx={{ display: "grid", gap: 0.6 }}>
                                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                        <StatusChip label={lead.source.replace("_", " ")} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }} />
                                        {parsed.topic && (
                                          <Chip
                                            size="small"
                                            icon={<Tag size={11} />}
                                            label={parsed.topic}
                                            sx={{ height: 20, fontSize: 10.5, fontWeight: 550 }}
                                          />
                                        )}
                                        {parsed.city && (
                                          <Chip
                                            size="small"
                                            icon={<MapPin size={11} />}
                                            label={parsed.city}
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: 10.5 }}
                                          />
                                        )}
                                        {suspicion?.suspicious && (
                                          <Chip
                                            size="small"
                                            color="warning"
                                            icon={<Bot size={11} />}
                                            label={suspicion.reasons[0]}
                                            sx={{ height: 20, fontSize: 10.5, fontWeight: 650 }}
                                          />
                                        )}
                                      </Box>
                                      {parsed.summary && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          sx={{
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          {parsed.summary}
                                        </Typography>
                                      )}
                                    </Box>
                                  )}
                                  {!(parsed.topic || parsed.city || parsed.summary || suspicion?.suspicious) && (
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                      <StatusChip label={lead.source.replace("_", " ")} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }} />
                                    </Box>
                                  )}

                                  {/* Row 4: Value, Follow-up, Owner */}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 0.75,
                                      pt: 0.5,
                                      borderTop: "1px dashed",
                                      borderColor: "divider",
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                      {lead.expected_value && Number(lead.expected_value) > 0
                                        ? `₹${Number(lead.expected_value).toLocaleString("en-IN")}`
                                        : "₹0 est."}
                                    </Typography>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                                      {followStatus !== "none" && lead.next_follow_up && (
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 0.35,
                                            fontSize: 10.5,
                                            fontWeight: 650,
                                            color:
                                              followStatus === "overdue"
                                                ? "error.main"
                                                : followStatus === "due_today"
                                                ? "warning.main"
                                                : "text.secondary",
                                          }}
                                        >
                                          <Clock size={11} />
                                          {followStatus === "overdue"
                                            ? "Overdue"
                                            : followStatus === "due_today"
                                            ? "Today"
                                            : format(new Date(lead.next_follow_up), "dd MMM")}
                                        </Typography>
                                      )}
                                      {lead.assigned_to && (
                                        <Chip
                                          size="small"
                                          icon={<UserCheck size={10.5} />}
                                          label={staffMap.get(lead.assigned_to) || "Staff"}
                                          variant="outlined"
                                          sx={{ height: 20, fontSize: 10 }}
                                        />
                                      )}
                                    </Box>
                                  </Box>

                                  {/* Row 5: Quick Stage Advance & Direct Quotation Handoff */}
                                  <Box
                                    sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75 }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {nextStageObj ? (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => void handleStageChange(lead, nextStageObj.id)}
                                        endIcon={<ArrowRight size={13} />}
                                        sx={{ fontSize: 11, py: 0.25, px: 1, minHeight: 28 }}
                                      >
                                        {nextStageObj.label}
                                      </Button>
                                    ) : (
                                      <Box />
                                    )}

                                    {stage.id === "converted" || lead.converted_customer_id ? (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        color="success"
                                        startIcon={<FileText size={13} />}
                                        onClick={() => void handleCreateQuotation(lead)}
                                        sx={{ fontSize: 11, py: 0.25, px: 1.1, minHeight: 28 }}
                                      >
                                        Create Quotation
                                      </Button>
                                    ) : (
                                      <Button
                                        size="small"
                                        variant="text"
                                        startIcon={<Quote size={13} />}
                                        onClick={() => void handleCreateQuotation(lead)}
                                        sx={{ fontSize: 11, py: 0.25, px: 0.9, minHeight: 28 }}
                                      >
                                        Convert & Quote
                                      </Button>
                                    )}
                                  </Box>
                                </CardContent>
                              </Card>
                            </Box>
                          );
                        })}

                        {stageLeads.length === 0 && (
                          <Box
                            sx={{
                              py: 3,
                              px: 1.5,
                              borderRadius: "12px",
                              border: "1px dashed",
                              borderColor: isDropTarget ? stageColor : "divider",
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="caption" color="text.secondary">
                              {isDropTarget ? `Drop here to move to ${stage.label}` : "No leads in this stage"}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ── VIEW 2: HIGH-DENSITY TRIAGE TABLE ─────────────────────────────── */}
        {viewMode === "table" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.5, minWidth: 0 }}>
            <Box sx={{ overflowX: "auto", minWidth: 0 }}>
              <TabView value={stageFilter} onChange={setStageFilter}>
                <TabBar>
                  <Tab value="all" label="All" />
                  {PIPELINE_STAGES.map((s) => (
                    <Tab key={s.id} value={s.id} label={`${s.label} (${allStageTotals[s.id]?.count || 0})`} />
                  ))}
                </TabBar>
              </TabView>
            </Box>

            <Box
              sx={{
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                minWidth: 0,
                width: "100%",
                overflow: "hidden",
              }}
            >
              <DataTable
                columnsCount={9}
                loading={loading}
                empty={filteredLeads.length === 0}
                emptyMessage="No leads match your current filter"
                sx={{ "& td, & th": { px: 1.25 } }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 42 }}>
                      <Checkbox
                        size="small"
                        checked={filteredLeads.length > 0 && filteredLeads.every((l) => selectedIds.includes(l.id))}
                        indeterminate={
                          selectedIds.length > 0 && !filteredLeads.every((l) => selectedIds.includes(l.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(filteredLeads.map((l) => l.id));
                          else setSelectedIds([]);
                        }}
                        slotProps={{ input: { "aria-label": "Select all visible leads" } }}
                      />
                    </TableCell>
                    <TableCell>Lead</TableCell>
                    <TableCell>Phone & Email</TableCell>
                    <TableCell>Enquiry / Notes</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Stage</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Score / Value</TableCell>
                    <TableCell>Follow-up & Owner</TableCell>
                    <TableCell sx={{ width: 220 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLeads.map((l) => {
                    const parsed = parseLeadNotes(l.notes);
                    const suspicion = suspiciousMap.get(l.id);
                    const dynScore = dynamicScoreFor(l);
                    const followStatus = getFollowUpStatus(l);
                    const waHref = buildWhatsAppLink(l.phone, l.name);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(l.id)}
                            onChange={() => toggleSelectId(l.id)}
                            slotProps={{ input: { "aria-label": `Select lead ${l.name}` } }}
                          />
                        </TableCell>
                        <TableCell onClick={() => openEdit(l)} sx={{ cursor: "pointer" }}>
                          <Box sx={{ display: "grid", gap: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: 650, "&:hover": { color: "primary.main" } }}>
                              {l.name}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
                              <Typography variant="caption" color="text.secondary">
                                {formatLeadAge(l.created_at)}
                              </Typography>
                              {suspicion?.suspicious && (
                                <Chip size="small" color="warning" label={suspicion.reasons[0]} sx={{ height: 18, fontSize: 10 }} />
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "grid", gap: 0.25, maxWidth: 210 }}>
                            <Typography variant="caption" noWrap>
                              {l.phone || "—"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {l.email || "—"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "grid", gap: 0.35, maxWidth: 230 }}>
                            {(parsed.topic || parsed.city) && (
                              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                                {parsed.topic && <Chip size="small" label={parsed.topic} sx={{ height: 18, fontSize: 10 }} />}
                                {parsed.city && <Chip size="small" variant="outlined" label={parsed.city} sx={{ height: 18, fontSize: 10 }} />}
                              </Box>
                            )}
                            <Typography variant="caption" color="text.secondary" noWrap title={parsed.summary || l.notes || ""}>
                              {parsed.summary || l.notes || "—"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <StatusChip label={l.source.replace("_", " ")} variant="outlined" sx={{ textTransform: "capitalize", fontSize: 11 }} />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={l.pipeline_stage || "new"}
                            select
                            size="small"
                            onChange={(e) => void handleStageChange(l, e.target.value)}
                            sx={{ width: 124 }}
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <MenuItem key={s.id} value={s.id}>
                                {s.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </TableCell>
                        <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <Box sx={{ display: "grid" }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: dynScore >= 70 ? "success.main" : "primary.main" }}>
                              {dynScore} pts
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {l.expected_value && Number(l.expected_value) > 0
                                ? `₹${Number(l.expected_value).toLocaleString("en-IN")}`
                                : "—"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "grid", gap: 0.25 }}>
                            {followStatus !== "none" && l.next_follow_up ? (
                              <Typography
                                variant="caption"
                                sx={{ color: followStatus === "overdue" ? "error.main" : "text.secondary", fontWeight: followStatus === "overdue" ? 700 : 400 }}
                              >
                                {format(new Date(l.next_follow_up), "dd MMM, HH:mm")}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {l.assigned_to ? staffMap.get(l.assigned_to) || "Staff" : "Unassigned"}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {waHref && (
                              <Tooltip title="WhatsApp">
                                <IconButton size="small" component="a" href={waHref} target="_blank" rel="noopener noreferrer" color="success">
                                  <MessageSquare size={15} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Button
                              size="small"
                              variant={l.converted_customer_id ? "contained" : "outlined"}
                              color={l.converted_customer_id ? "success" : "primary"}
                              onClick={() => void handleCreateQuotation(l)}
                              startIcon={<FileText size={13} />}
                            >
                              {l.converted_customer_id ? "Create Quotation" : "Convert & Quote"}
                            </Button>
                            <Tooltip title="Edit / Timeline">
                              <IconButton size="small" onClick={() => openEdit(l)} aria-label={`Edit lead ${l.name}`}>
                                <Pencil size={15} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Lead">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => void handleDeleteLeads([l])}
                                aria-label={`Delete lead ${l.name}`}
                              >
                                <Trash2 size={15} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </Box>
          </Box>
        )}

        {/* ── VIEW 3: SPLIT INBOX INSPECTOR ─────────────────────────────────── */}
        {viewMode === "split" && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "380px minmax(0, 1fr)" },
              gap: 2,
              minWidth: 0,
              alignItems: "start",
            }}
          >
            {/* Left Lead Queue */}
            <Card variant="outlined" sx={{ borderRadius: "16px", overflow: "hidden" }}>
              <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Lead Queue ({filteredLeads.length})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Select to inspect or purge
                </Typography>
              </Box>
              <Box sx={{ maxHeight: 620, overflowY: "auto", display: "grid" }}>
                {filteredLeads.length === 0 ? (
                  <EmptyState title="No matching leads" description="Try clearing search or quick filters." sx={{ py: 5 }} />
                ) : (
                  filteredLeads.map((l) => {
                    const active = splitSelectedId === l.id;
                    const parsed = parseLeadNotes(l.notes);
                    const suspicion = suspiciousMap.get(l.id);
                    const stageObj = PIPELINE_STAGES.find((s) => s.id === (l.pipeline_stage || "new")) || PIPELINE_STAGES[0];
                    return (
                      <Box
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSplitSelectedId(l.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSplitSelectedId(l.id);
                          }
                        }}
                        sx={{
                          p: 1.5,
                          cursor: "pointer",
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          borderLeft: "3px solid",
                          borderLeftColor: active ? "primary.main" : "transparent",
                          bgcolor: active ? alpha(theme.palette.primary.main, isDark ? 0.14 : 0.06) : "transparent",
                          "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                          display: "grid",
                          gap: 0.5,
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                            <Checkbox
                              size="small"
                              checked={selectedIds.includes(l.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelectId(l.id)}
                              sx={{ p: 0.25 }}
                            />
                            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                              {l.name}
                            </Typography>
                          </Box>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <StatusChip label={stageObj.label} variant="outlined" sx={{ fontSize: 10 }} />
                            <IconButton
                              size="small"
                              color="error"
                              aria-label={`Delete lead ${l.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeleteLeads([l]);
                              }}
                              sx={{ p: 0.35 }}
                            >
                              <Trash2 size={13.5} />
                            </IconButton>
                          </Box>
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {[l.phone, l.email].filter(Boolean).join(" · ") || "No contact details"}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {parsed.topic || l.source} {parsed.city ? `· ${parsed.city}` : ""}
                          </Typography>
                          {suspicion?.suspicious && (
                            <Chip size="small" color="warning" label="Flagged" sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Card>

            {/* Right Live Inspector */}
            <Card variant="outlined" sx={{ borderRadius: "16px", p: 2.5 }}>
              {detailLead && editId === detailLead.id ? (
                <Box sx={{ display: "grid", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.16), color: "primary.main", fontWeight: 700 }}>
                        {getLeadInitials(detailLead.name)}
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                          {detailLead.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Created {formatLeadAge(detailLead.created_at)} · Score {dynamicScoreFor(detailLead)} pts
                        </Typography>
                      </Box>
                    </Box>
                    <Chip icon={<Sparkles size={13} />} label={detailLead.source} variant="outlined" sx={{ textTransform: "capitalize" }} />
                  </Box>
                  {renderLeadFormAndTimeline(true)}
                </Box>
              ) : (
                <EmptyState
                  title="Select a lead to inspect"
                  description="Choose any lead from the queue on the left to view notes, log calls, convert, or delete."
                  sx={{ py: 8 }}
                />
              )}
            </Card>
          </Box>
        )}

        {/* ── LEAD INSPECTOR / CREATE DRAWER ─────────────────────────────────── */}
        <SideDrawer
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editId ? detailLead?.name || "Lead Details" : "New Lead"}
          description={editId ? "Full CRM details, stage stepper, activities & quotation handoff" : "Add a new prospect to the CRM pipeline"}
          width={560}
          footer={
            <Box sx={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
              {editId && detailLead ? (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<Trash2 size={15} />}
                  onClick={() => void handleDeleteLeads([detailLead])}
                >
                  Delete
                </Button>
              ) : (
                <Box />
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {editId && detailLead && (
                  <>
                    {!detailLead.converted_customer_id && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UserPlus size={15} />}
                        onClick={() => void convertLead(detailLead)}
                      >
                        Convert Customer
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="success"
                      startIcon={<FileText size={15} />}
                      onClick={() => void handleCreateQuotation(detailLead)}
                    >
                      {detailLead.converted_customer_id ? "Create Quotation" : "Convert & Quote"}
                    </Button>
                  </>
                )}
                <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 36 }}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
                  {saving ? "Saving..." : editId ? "Update Lead" : "Create Lead"}
                </Button>
              </Box>
            </Box>
          }
        >
          {renderLeadFormAndTimeline(false)}
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
