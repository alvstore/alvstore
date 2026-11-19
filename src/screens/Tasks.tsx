"use client";

import { Alert, Box, Button, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, EmptyState, FormDialog, PageHeader, ProgressRing, SearchToolbar, StatCard, StatusChip, TabBar, TabView, WidgetCard, toast } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ClipboardList } from "lucide-react";
import { PendingActions, Schedule } from "@mui/icons-material";
import { useTaskBoard, type TaskRecord as Task } from "@/hooks/useTaskBoard";
import { taskSummary } from "@/lib/task-summary";
const priorityColors = {
    low: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    medium: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    high: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
};
const statusColors = {
    pending: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
};
const emptyForm = { title: "", description: "", assigned_to: "", priority: "medium", due_date: "", related_entity_type: "", related_entity_id: "" };
export default function Tasks() {
    const { user, hasRole } = useAuth();
    const isAdminOrStaff = hasRole("admin") || hasRole("staff");
    const board = useTaskBoard();
    const summary = taskSummary(board.tasks);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const loading = board.isPending;
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [staffList, setStaffList] = useState<{
        user_id: string;
        full_name: string | null;
    }[]>([]);
    // Filter locally so summary widgets always describe the whole task board.
    const tasks = useMemo(() => board.tasks.filter(task =>
        (statusFilter === "all" || task.status === statusFilter) && task.title.toLowerCase().includes(search.trim().toLowerCase())
    ), [board.tasks, statusFilter, search]);
    useEffect(() => {
        supabase.from("profiles").select("user_id, full_name").then(({ data }) => setStaffList(data || []));
    }, []);
    const getStaffName = (id: string | null) => staffList.find(s => s.user_id === id)?.full_name || "—";
    const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
    const openEdit = (t: Task) => {
        setEditId(t.id);
        setForm({
            title: t.title, description: t.description || "", assigned_to: t.assigned_to || "",
            priority: t.priority, due_date: t.due_date || "",
            related_entity_type: t.related_entity_type || "", related_entity_id: t.related_entity_id || "",
        });
        setSheetOpen(true);
    };
    const handleSave = async () => {
        if (!form.title.trim()) {
            toast.error("Title is required");
            return;
        }
        const payload = {
            title: form.title, description: form.description || null,
            assigned_to: form.assigned_to || null, priority: form.priority,
            due_date: form.due_date || null,
            related_entity_type: form.related_entity_type || null,
            related_entity_id: form.related_entity_id || null,
        };
        setSaving(true);
        try {
            const { error } = editId
                ? await supabase.from("tasks").update(payload).eq("id", editId)
                : await supabase.from("tasks").insert({ ...payload, assigned_by: user?.id });
            if (error) throw new Error(error.message);
            toast.success(editId ? "Task updated" : "Task created");
            setSheetOpen(false);
            await board.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save task");
        } finally { setSaving(false); }
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Task Management"} subtitle={"Create and track tasks across your team"} actions={<>{isAdminOrStaff && <Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Task</Button>}</>}/>

      {board.isError && <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => void board.refetch()}>Retry</Button>}>Tasks could not be loaded. Please retry.</Alert>}
      {!board.isError && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "minmax(0,1.8fr) repeat(2,minmax(0,1fr))" }, gap: 2 }}>
        <WidgetCard title="Team progress" subtitle="One task at a time." featured>
          {board.isPending ? <Typography color="text.secondary" variant="body2">Loading progress…</Typography> : summary.total ? <Box sx={{ display: "flex", alignItems: "center", gap: 2.5 }}>
            <ProgressRing size={98} value={summary.percent} label="Task board completion" />
            <Box><Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.04em" }}>{summary.completed} / {summary.total}</Typography><Typography variant="caption" color="text.secondary">tasks completed across your team</Typography></Box>
          </Box> : <EmptyState title="A fresh start" description="Create your first task to begin tracking progress." sx={{ py: 1 }} />}
        </WidgetCard>
        <StatCard label="Due today" value={summary.dueToday.filter(task => task.status !== "completed").length} icon={<Schedule fontSize="small" />} accent="info" caption="Open tasks scheduled for today" loading={loading} index={1} />
        <StatCard label="Overdue" value={summary.overdue.length} icon={<PendingActions fontSize="small" />} accent="warning" caption="Past the due date, still open" loading={loading} index={2} />
      </Box>}

      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", alignItems: "flex-start" }}>
        <TabView value={statusFilter} onChange={setStatusFilter}>
          <TabBar>
            <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
            <Tab value="pending" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Pending</Box>}/>
            <Tab value="in_progress" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>In Progress</Box>}/>
            <Tab value="completed" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Completed</Box>}/>
          </TabBar>
        </TabView>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search tasks..." sx={{ maxWidth: "24rem" }}/>
      </Box>

      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", overflow: "hidden" }}>
        <DataTable columnsCount={6} loading={loading} empty={tasks.length === 0} emptyMessage="No matching tasks">
          <TableHead>
            <TableRow>
              <TableCell>Task</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Assigned To</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Due Date</TableCell>
              <TableCell sx={{ width: "8rem" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{tasks.map(t => (<TableRow key={t.id}>
                <TableCell sx={{ fontWeight: 500 }}><Button variant="text" onClick={() => openEdit(t)} sx={{ textAlign: "left", justifyContent: "flex-start", color: "text.primary", fontSize: 12 }}>{t.title}</Button></TableCell>
                <TableCell><StatusChip label={t.priority} sx={priorityColors[t.priority]}/></TableCell>
                <TableCell>
                  <TextField value={t.status} select size="small" fullWidth disabled={board.pendingIds.includes(t.id)} aria-label={`Status for ${t.title}`} onChange={event => void board.updateStatus(t.id, event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", width: "110px", fontSize: "0.75rem", lineHeight: "1rem" }}>
                      {["pending", "in_progress", "completed"].map(s => (<MenuItem key={s} value={s} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{s.replace(/_/g, " ")}</MenuItem>))}
                    </TextField>
                </TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>{getStaffName(t.assigned_to)}</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                  {t.due_date ? new Date(`${t.due_date}T00:00:00`).toLocaleDateString("en-IN") : "—"}
                </TableCell>
                <TableCell>
                  <Button onClick={() => openEdit(t)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>Edit</Button>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>

      <FormDialog busy={saving} open={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? "Edit Task" : "New Task"} description={"Task details and assignment"} paperSx={{ overflowY: "auto", "@media (min-width: 640px)": { maxWidth: "32rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} label={"Title *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} label={"Description"} size="small" fullWidth multiline/></Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.priority} label={"Priority"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, priority: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    {["low", "medium", "high"].map(p => <MenuItem key={p} value={p} sx={{ textTransform: "capitalize" }}>{p}</MenuItem>)}
                  </TextField>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} label={"Due Date"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.assigned_to} label={"Assign To"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, assigned_to: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="">Unassigned</MenuItem>
                  {staffList.map(s => <MenuItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.related_entity_type} label={"Related To"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, related_entity_type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="">None</MenuItem>
                  <MenuItem value="customer">Customer</MenuItem>
                  <MenuItem value="repair">Repair Job</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="lead">Lead</MenuItem>
                  <MenuItem value="calendar_event">Calendar Event</MenuItem>
                </TextField>
            </Box>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ width: "100%" }}>{saving ? "Saving…" : editId ? "Update Task" : "Create Task"}</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
