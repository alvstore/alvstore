"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, Chip, Divider, IconButton, MenuItem,
  Tab, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AnimatedPage, DataTable, EmptyState, MetricStrip, PageHeader, SearchToolbar,
  SegmentedControl, SideDrawer, StatusChip, TabBar, TabView, confirmAction, toast,
} from "@/components/mui";
import { useAuth } from "@/hooks/useAuth";
import { useTaskBoard, type TaskRecord as Task } from "@/hooks/useTaskBoard";
import { supabase } from "@/integrations/supabase/client";
import { taskSummary } from "@/lib/task-summary";
import { localDateKey } from "@/lib/widget-data";
import { pastelPillColors } from "@/lib/pill-style";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Calendar, CheckCircle2, ClipboardList,
  Clock, LayoutGrid, List, Plus, Trash2, Zap,
} from "lucide-react";

type TaskViewMode = "board" | "table";

const LANES = [
  { id: "pending", label: "Pending", accent: "warning" as const },
  { id: "in_progress", label: "In Progress", accent: "info" as const },
  { id: "completed", label: "Completed", accent: "success" as const },
];

const emptyForm = {
  title: "",
  description: "",
  assigned_to: "",
  priority: "medium",
  status: "pending",
  due_date: "",
  related_entity_type: "",
  related_entity_id: "",
};

export default function Tasks() {
  const { hasRole } = useAuth();
  const isAdminOrStaff = hasRole("admin") || hasRole("staff");
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const paperBg = muiTheme.palette.background.paper;

  const board = useTaskBoard();
  const summary = useMemo(() => taskSummary(board.tasks), [board.tasks]);
  const today = localDateKey(new Date());

  const [viewMode, setViewMode] = useState<TaskViewMode>("board");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("edit");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [staffList, setStaffList] = useState<{ user_id: string; full_name: string | null }[]>([]);

  useEffect(() => {
    void supabase.from("profiles").select("user_id, full_name").then(({ data }) => setStaffList(data || []));
  }, []);

  const tasks = useMemo(
    () =>
      board.tasks.filter(
        (task) =>
          (statusFilter === "all" || task.status === statusFilter) &&
          task.title.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [board.tasks, statusFilter, search]
  );

  const activeTask = useMemo(
    () => (editId ? board.tasks.find((t) => t.id === editId) ?? null : null),
    [board.tasks, editId]
  );

  const getStaffName = (id: string | null) => staffList.find((s) => s.user_id === id)?.full_name || "Unassigned";

  const openNew = (defaultStatus = "pending") => {
    setEditId(null);
    setDrawerTab("edit");
    setForm({ ...emptyForm, status: defaultStatus });
    setDrawerOpen(true);
  };

  const openEdit = (t: Task, initialTab = "edit") => {
    setEditId(t.id);
    setDrawerTab(initialTab);
    setForm({
      title: t.title,
      description: t.description || "",
      assigned_to: t.assigned_to || "",
      priority: t.priority || "medium",
      status: t.status || "pending",
      due_date: t.due_date || "",
      related_entity_type: t.related_entity_type || "",
      related_entity_id: t.related_entity_id || "",
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      await board.saveTask(editId, {
        title: form.title.trim(),
        description: form.description || null,
        assigned_to: form.assigned_to || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        related_entity_type: form.related_entity_type || null,
        related_entity_id: form.related_entity_id || null,
      });
      toast.success(editId ? "Task updated" : "Task created");
      setDrawerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save task");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId || !(await confirmAction("Delete this task? This cannot be undone."))) return;
    setSaving(true);
    try {
      await board.deleteTask(editId);
      toast.success("Task deleted");
      setDrawerOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete task");
    } finally {
      setSaving(false);
    }
  };

  const priorityPillStyle = (priority: string) => {
    if (priority === "high") return pastelPillColors(muiTheme.palette.error.main, paperBg, isDark);
    if (priority === "medium") return pastelPillColors(muiTheme.palette.info.main, paperBg, isDark);
    return pastelPillColors(muiTheme.palette.text.secondary, paperBg, isDark);
  };

  const statusPillStyle = (status: string) => {
    if (status === "completed") return pastelPillColors(muiTheme.palette.success.main, paperBg, isDark);
    if (status === "in_progress") return pastelPillColors(muiTheme.palette.info.main, paperBg, isDark);
    return pastelPillColors(muiTheme.palette.warning.main, paperBg, isDark);
  };

  const pendingCount = board.tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = board.tasks.filter((t) => t.status === "in_progress").length;

  const visibleLanes = statusFilter === "all" ? LANES : LANES.filter((l) => l.id === statusFilter);

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gap: 3 }}>
        <PageHeader
          title="Task Management"
          subtitle="Create and track tasks across your team"
          actions={
            <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
              <SegmentedControl<TaskViewMode>
                value={viewMode}
                onChange={setViewMode}
                label="Task view"
                options={[
                  {
                    value: "board",
                    label: (
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                        <LayoutGrid size={13} />
                        Board
                      </Box>
                    ),
                  },
                  {
                    value: "table",
                    label: (
                      <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
                        <List size={13} />
                        Table
                      </Box>
                    ),
                  },
                ]}
              />
              {isAdminOrStaff && (
                <Button onClick={() => openNew()} variant="contained" startIcon={<Plus size={16} />}>
                  New Task
                </Button>
              )}
            </Box>
          }
        />

        {board.isError ? (
          <Alert
            severity="error"
            action={
              <Button size="small" color="inherit" onClick={() => void board.refetch()}>
                Retry
              </Button>
            }
          >
            Tasks could not be loaded. Please retry.
          </Alert>
        ) : (
          <MetricStrip
            loading={board.isPending}
            items={[
              {
                id: "progress",
                label: "Team Completion",
                value: `${summary.percent}%`,
                caption: `${summary.completed} / ${summary.total} done`,
                icon: <CheckCircle2 size={20} />,
                accent: "success",
              },
              {
                id: "pending",
                label: "Pending",
                value: pendingCount,
                icon: <Clock size={20} />,
                accent: "warning",
                onClick: () => setStatusFilter("pending"),
              },
              {
                id: "in_progress",
                label: "In Progress",
                value: inProgressCount,
                icon: <Zap size={20} />,
                accent: "info",
                onClick: () => setStatusFilter("in_progress"),
              },
              {
                id: "overdue",
                label: "Overdue",
                value: summary.overdue.length,
                icon: <AlertTriangle size={20} />,
                accent: "error",
              },
            ]}
          />
        )}

        {/* Filter Bar */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 1.5,
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <TabView value={statusFilter} onChange={setStatusFilter}>
            <TabBar>
              <Tab value="all" label="All" />
              <Tab value="pending" label="Pending" />
              <Tab value="in_progress" label="In Progress" />
              <Tab value="completed" label="Completed" />
            </TabBar>
          </TabView>
          <SearchToolbar
            onSearch={setSearch}
            value={search}
            placeholder="Search tasks..."
            sx={{ maxWidth: { md: "22rem" }, width: "100%" }}
          />
        </Box>

        {/* Kanban Board View */}
        {viewMode === "board" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: `repeat(${visibleLanes.length}, minmax(268px, 1fr))`,
                lg: `repeat(${visibleLanes.length}, minmax(0, 1fr))`,
              },
              gap: 2.25,
              overflowX: "auto",
              pb: 1,
              alignItems: "start",
            }}
          >
            {visibleLanes.map((lane, laneIdx) => {
              const laneTasks = tasks.filter((t) => t.status === lane.id);
              const laneColor = muiTheme.palette[lane.accent].main;
              const laneBadgeStyle = pastelPillColors(laneColor, muiTheme.palette.background.default, isDark);

              return (
                <Box key={lane.id} sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
                  {/* Column Header */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: laneColor }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {lane.label}
                      </Typography>
                      <Chip
                        size="small"
                        label={laneTasks.length}
                        sx={{ height: 20, minWidth: 24, fontSize: 11, fontWeight: 700, borderRadius: "6px", ...laneBadgeStyle }}
                      />
                    </Box>
                    {isAdminOrStaff && (
                      <Tooltip title={`Add to ${lane.label}`}>
                        <IconButton size="small" aria-label={`Add task to ${lane.label}`} onClick={() => openNew(lane.id)}>
                          <Plus size={16} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {/* Task Cards */}
                  {laneTasks.length === 0 ? (
                    <Card sx={{ p: 2.5, textAlign: "center", borderStyle: "dashed", boxShadow: "none" }}>
                      <EmptyState
                        title={`No ${lane.label.toLowerCase()} tasks`}
                        description={search ? "Try clearing search" : "Tasks appear here"}
                        sx={{ py: 1.5 }}
                      />
                    </Card>
                  ) : (
                    laneTasks.map((t) => {
                      const overdue = Boolean(t.due_date && t.due_date < today && t.status !== "completed");
                      const staffName = getStaffName(t.assigned_to);
                      const initials = staffName === "Unassigned" ? "—" : staffName.slice(0, 2).toUpperCase();
                      const busyMove = board.pendingIds.includes(t.id);
                      const prevLane = laneIdx > 0 ? LANES[laneIdx - 1] : null;
                      const nextLane = laneIdx < LANES.length - 1 ? LANES[laneIdx + 1] : null;

                      return (
                        <Card
                          key={t.id}
                          onClick={() => openEdit(t)}
                          sx={{
                            p: 2,
                            cursor: "pointer",
                            transition: "transform 160ms ease, border-color 160ms ease",
                            "&:hover": {
                              transform: "translateY(-2px)",
                              borderColor: alpha(laneColor, 0.4),
                            },
                          }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25 }}>
                            <Chip
                              size="small"
                              label={t.priority}
                              sx={{
                                height: 22,
                                fontSize: 11,
                                fontWeight: 650,
                                textTransform: "capitalize",
                                borderRadius: "6px",
                                ...priorityPillStyle(t.priority),
                              }}
                            />
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                              {prevLane && (
                                <Tooltip title={`Move to ${prevLane.label}`}>
                                  <IconButton
                                    size="small"
                                    disabled={busyMove}
                                    aria-label={`Move ${t.title} to ${prevLane.label}`}
                                    onClick={() => void board.updateStatus(t.id, prevLane.id)}
                                  >
                                    <ArrowLeft size={14} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {nextLane && (
                                <Tooltip title={`Move to ${nextLane.label}`}>
                                  <IconButton
                                    size="small"
                                    disabled={busyMove}
                                    aria-label={`Move ${t.title} to ${nextLane.label}`}
                                    onClick={() => void board.updateStatus(t.id, nextLane.id)}
                                  >
                                    <ArrowRight size={14} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>

                          <Typography variant="body2" sx={{ fontWeight: 650, lineHeight: 1.4, mb: t.description ? 0.5 : 0 }}>
                            {t.title}
                          </Typography>
                          {t.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                lineHeight: 1.45,
                              }}
                            >
                              {t.description}
                            </Typography>
                          )}

                          <Box
                            sx={{
                              mt: 1.75,
                              pt: 1.25,
                              borderTop: 1,
                              borderColor: "divider",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, flexWrap: "wrap" }}>
                              {t.due_date && (
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    color: overdue ? "error.main" : "text.secondary",
                                    fontSize: 11,
                                    fontWeight: overdue ? 650 : 500,
                                  }}
                                >
                                  <Calendar size={12} />
                                  {new Date(`${t.due_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </Box>
                              )}
                              {t.related_entity_type && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={t.related_entity_type.replace(/_/g, " ")}
                                  sx={{ height: 20, fontSize: 10, textTransform: "capitalize" }}
                                />
                              )}
                            </Box>
                            <Tooltip title={staffName}>
                              <Avatar
                                sx={{
                                  width: 26,
                                  height: 26,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  ...pastelPillColors(muiTheme.palette.primary.main, paperBg, isDark),
                                }}
                              >
                                {initials}
                              </Avatar>
                            </Tooltip>
                          </Box>
                        </Card>
                      );
                    })
                  )}

                  {isAdminOrStaff && (
                    <Button
                      variant="text"
                      size="small"
                      startIcon={<Plus size={14} />}
                      onClick={() => openNew(lane.id)}
                      sx={{ justifyContent: "flex-start", color: "text.secondary", fontWeight: 600 }}
                    >
                      Add New Item
                    </Button>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          /* Table View */
          <Card sx={{ borderRadius: "16px", overflow: "hidden" }}>
            <DataTable
              columnsCount={6}
              loading={board.isPending}
              empty={tasks.length === 0}
              emptyMessage={
                <>
                  <Box component={ClipboardList} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.25 }} />
                  <Typography variant="body2" color="text.secondary">No matching tasks</Typography>
                </>
              }
              sx={{
                "& thead th": {
                  bgcolor: isDark ? alpha(muiTheme.palette.common.white, 0.04) : "#F5F5F7",
                  fontSize: "11px",
                  fontWeight: 650,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "text.secondary",
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>Assigned To</TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Due Date</TableCell>
                  <TableCell sx={{ width: "7rem", textAlign: "right" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell sx={{ fontWeight: 500 }}>
                      <Button
                        variant="text"
                        onClick={() => openEdit(t)}
                        sx={{ textAlign: "left", justifyContent: "flex-start", color: "text.primary", fontSize: 12.5, fontWeight: 600 }}
                      >
                        {t.title}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={t.priority}
                        sx={{ fontWeight: 650, textTransform: "capitalize", ...priorityPillStyle(t.priority) }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={t.status}
                        select
                        size="small"
                        fullWidth
                        disabled={board.pendingIds.includes(t.id)}
                        aria-label={`Status for ${t.title}`}
                        onChange={(event) => void board.updateStatus(t.id, event.target.value)}
                        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                        sx={{ width: "126px", fontSize: "0.75rem" }}
                      >
                        {["pending", "in_progress", "completed"].map((s) => (
                          <MenuItem key={s} value={s} sx={{ fontSize: "0.78rem", textTransform: "capitalize" }}>
                            {s.replace(/_/g, " ")}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "0.85rem" }}>
                      {getStaffName(t.assigned_to)}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" }, fontSize: "0.85rem", color: "text.secondary" }}>
                      {t.due_date ? new Date(`${t.due_date}T00:00:00`).toLocaleDateString("en-IN") : "—"}
                    </TableCell>
                    <TableCell sx={{ textAlign: "right" }}>
                      <Button onClick={() => openEdit(t)} variant="outlined" size="small" sx={{ minHeight: 32, fontSize: "0.75rem" }}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          </Card>
        )}

        {/* Right Slide-Over Kanban Task Drawer with Edit | Activity Underline Tabs */}
        <SideDrawer
          open={drawerOpen}
          busy={saving}
          onClose={() => setDrawerOpen(false)}
          title={editId ? "Edit Task" : "New Task"}
          description={editId ? "Update task details or review progress" : "Create and assign a team task"}
          tabs={
            editId
              ? [
                  { value: "edit", label: "Edit" },
                  { value: "activity", label: "Activity" },
                ]
              : undefined
          }
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          width={430}
          footer={
            <>
              <Box>
                {editId && isAdminOrStaff && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={saving}
                    startIcon={<Trash2 size={14} />}
                    onClick={() => void handleDelete()}
                  >
                    Delete
                  </Button>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" disabled={saving} onClick={() => setDrawerOpen(false)}>
                  {drawerTab === "activity" ? "Close" : "Cancel"}
                </Button>
                {drawerTab === "edit" && (
                  <Button onClick={() => void handleSave()} disabled={saving} variant="contained">
                    {saving ? "Saving…" : editId ? "Update Task" : "Create Task"}
                  </Button>
                )}
              </Box>
            </>
          }
        >
          {drawerTab === "edit" ? (
            <Box sx={{ display: "grid", gap: 2 }}>
              <TextField
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                label="Title *"
                size="small"
                fullWidth
              />
              <TextField
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                label="Description"
                size="small"
                fullWidth
                multiline
              />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                <TextField
                  value={form.priority}
                  label="Priority"
                  select
                  size="small"
                  fullWidth
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                >
                  {["low", "medium", "high"].map((p) => (
                    <MenuItem key={p} value={p} sx={{ textTransform: "capitalize" }}>
                      {p}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  value={form.status}
                  label="Status"
                  select
                  size="small"
                  fullWidth
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                >
                  {LANES.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <TextField
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                label="Due Date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                value={form.assigned_to}
                label="Assign To"
                select
                size="small"
                fullWidth
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {staffList.map((s) => (
                  <MenuItem key={s.user_id} value={s.user_id}>
                    {s.full_name || "Unnamed"}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                value={form.related_entity_type}
                label="Related To"
                select
                size="small"
                fullWidth
                onChange={(e) => setForm((p) => ({ ...p, related_entity_type: e.target.value }))}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="repair">Repair Job</MenuItem>
                <MenuItem value="invoice">Invoice</MenuItem>
                <MenuItem value="lead">Lead</MenuItem>
                <MenuItem value="calendar_event">Calendar Event</MenuItem>
              </TextField>
            </Box>
          ) : (
            activeTask && (
              <Box sx={{ display: "grid", gap: 2.25 }}>
                <Card sx={{ p: 2, boxShadow: "none" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Current Status & Ownership
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                    <Chip
                      size="small"
                      label={activeTask.status.replace(/_/g, " ")}
                      sx={{ fontWeight: 650, textTransform: "capitalize", ...statusPillStyle(activeTask.status) }}
                    />
                    <Chip
                      size="small"
                      label={`${activeTask.priority} priority`}
                      sx={{ fontWeight: 650, textTransform: "capitalize", ...priorityPillStyle(activeTask.priority) }}
                    />
                  </Box>
                  <Divider sx={{ my: 1.5 }} />
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Assignee: <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{getStaffName(activeTask.assigned_to)}</Box>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created: <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{new Date(activeTask.created_at).toLocaleString("en-IN")}</Box>
                    </Typography>
                    {activeTask.due_date && (
                      <Typography variant="caption" color="text.secondary">
                        Due date: <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{new Date(`${activeTask.due_date}T00:00:00`).toLocaleDateString("en-IN")}</Box>
                      </Typography>
                    )}
                    {activeTask.related_entity_type && (
                      <Typography variant="caption" color="text.secondary">
                        Linked record: <Box component="span" sx={{ color: "text.primary", fontWeight: 600, textTransform: "capitalize" }}>{activeTask.related_entity_type.replace(/_/g, " ")}</Box>
                      </Typography>
                    )}
                  </Box>
                </Card>

                <Box sx={{ display: "grid", gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Quick Move Stage
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {LANES.map((l) => (
                      <Button
                        key={l.id}
                        size="small"
                        variant={activeTask.status === l.id ? "contained" : "outlined"}
                        disabled={board.pendingIds.includes(activeTask.id) || activeTask.status === l.id}
                        onClick={() => void board.updateStatus(activeTask.id, l.id)}
                      >
                        {l.label}
                      </Button>
                    ))}
                  </Box>
                </Box>
              </Box>
            )
          )}
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
