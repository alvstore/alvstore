"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, ButtonBase, Card, Checkbox, Divider, FormControlLabel,
  IconButton, MenuItem, Skeleton, Switch, TextField, Typography, useTheme, type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AgendaWidget, AnimatedPage, DateCalendar, MotionSection,
  PageHeader, SegmentedControl, SideDrawer, StatusChip, confirmAction, mergeSx, toast,
} from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTaskBoard } from "@/hooks/useTaskBoard";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { localDateKey } from "@/lib/widget-data";
import { pastelPillColors } from "@/lib/pill-style";
import { ChevronLeft, ChevronRight, Plus, Trash2, ListTodo, CalendarDays } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths,
  addWeeks, addDays, eachDayOfInterval, isSameMonth, isSameDay,
  isToday, parseISO, getHours, startOfDay, endOfDay, setHours,
} from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean | null;
  category: string | null;
  color: string | null;
  created_by: string | null;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string | null;
  priority: string | null;
}

type ViewMode = "month" | "week" | "day" | "list";

const CATEGORIES = [
  { value: "personal", label: "Personal", paletteKey: "error" as const },
  { value: "business", label: "Business", paletteKey: "primary" as const },
  { value: "family", label: "Family", paletteKey: "warning" as const },
  { value: "holiday", label: "Holiday", paletteKey: "success" as const },
  { value: "etc", label: "Other", paletteKey: "info" as const },
];

function categoryBaseColor(theme: Theme, category: string | null | undefined): string {
  const found = CATEGORIES.find((c) => c.value === (category || "business"));
  return theme.palette[found?.paletteKey ?? "primary"].main;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const board = useTaskBoard();
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const paperBg = muiTheme.palette.background.paper;

  const [searchParams] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(() => {
    const key = searchParams.get("date");
    const date = key && /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T12:00:00`) : new Date();
    return Number.isFinite(date.getTime()) ? date : new Date();
  });
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({
    personal: true,
    business: true,
    family: true,
    holiday: true,
    etc: true,
  });
  const [showTasks, setShowTasks] = useState(true);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formCategory, setFormCategory] = useState("business");
  const [formLinkTask, setFormLinkTask] = useState(false);

  const visibleStart =
    viewMode === "month"
      ? startOfWeek(startOfMonth(currentDate))
      : viewMode === "week"
      ? startOfWeek(currentDate)
      : startOfDay(currentDate);
  const visibleEnd =
    viewMode === "month"
      ? endOfWeek(endOfMonth(currentDate))
      : viewMode === "week"
      ? endOfWeek(currentDate)
      : viewMode === "day"
      ? endOfDay(currentDate)
      : endOfDay(addDays(currentDate, 30));

  const agendaStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const agendaEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const rangeStart = visibleStart < agendaStart ? visibleStart : agendaStart;
  const rangeEnd = visibleEnd > agendaEnd ? visibleEnd : agendaEnd;

  const eventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ["calendar", user?.id, rangeStart.toISOString(), rangeEnd.toISOString()],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", rangeStart.toISOString())
        .lte("start_date", rangeEnd.toISOString())
        .order("start_date");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const events = eventsQuery.data ?? [];
  const filteredEvents = events.filter((event) => filters[event.category || "business"] !== false);
  const tasks = board.tasks.filter(
    (task) => task.due_date && task.due_date >= localDateKey(rangeStart) && task.due_date <= localDateKey(rangeEnd)
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void board.refresh();
  };

  const openNewEvent = (date = currentDate) => {
    setFormError("");
    setEditEvent(null);
    setFormTitle("");
    setFormDescription("");
    setFormStartDate(format(date, "yyyy-MM-dd"));
    setFormEndDate(format(date, "yyyy-MM-dd"));
    setFormStartTime(format(date.getHours() >= 6 ? date : setHours(date, 9), "HH:00"));
    setFormEndTime(format(setHours(date, date.getHours() >= 6 ? Math.min(date.getHours() + 1, 23) : 10), "HH:00"));
    setFormAllDay(false);
    setFormCategory("business");
    setFormLinkTask(false);
    setDialogOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setFormError("");
    setEditEvent(event);
    const start = parseISO(event.start_date);
    const end = parseISO(event.end_date ?? event.start_date);
    setFormTitle(event.title);
    setFormDescription(event.description ?? "");
    setFormStartDate(format(start, "yyyy-MM-dd"));
    setFormStartTime(format(start, "HH:mm"));
    setFormEndDate(format(end, "yyyy-MM-dd"));
    setFormEndTime(format(end, "HH:mm"));
    setFormAllDay(Boolean(event.all_day));
    setFormCategory(event.category ?? "business");
    setFormLinkTask(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formStartDate) {
      setFormError("A title and start date are required");
      return;
    }
    const start = new Date(`${formStartDate}T${formAllDay ? "00:00:00" : `${formStartTime}:00`}`);
    const end = new Date(`${formEndDate || formStartDate}T${formAllDay ? "23:59:59" : `${formEndTime}:00`}`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
      setFormError("End date and time must be after the start");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription || null,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        all_day: formAllDay,
        category: formCategory,
      };
      const { data: saved, error } = editEvent
        ? await supabase.from("calendar_events").update(payload).eq("id", editEvent.id)
        : await supabase.from("calendar_events").insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) throw new Error(error.message);
      if (formLinkTask && !editEvent) {
        const linked = await supabase.from("tasks").insert({
          title: formTitle.trim(),
          description: formDescription || null,
          due_date: formStartDate,
          status: "pending",
          priority: "medium",
          assigned_to: user?.id,
          assigned_by: user?.id,
          related_entity_type: "calendar_event",
          related_entity_id: saved.id,
        });
        if (linked.error) toast.error(`Event saved, but its task could not be created: ${linked.error.message}`);
        else toast.success("Event and task created");
      } else {
        toast.success(editEvent ? "Event updated" : "Event created");
      }
      setDialogOpen(false);
      refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editEvent || !(await confirmAction("Delete this event? This cannot be undone."))) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("calendar_events").delete().eq("id", editEvent.id);
      if (error) throw new Error(error.message);
      toast.success("Event deleted");
      setDialogOpen(false);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete event");
    } finally {
      setSaving(false);
    }
  };

  const navigatePeriod = (direction: -1 | 1) =>
    setCurrentDate((date) =>
      viewMode === "month" || viewMode === "list"
        ? addMonths(date, direction)
        : viewMode === "week"
        ? addWeeks(date, direction)
        : addDays(date, direction)
    );

  const headerLabel =
    viewMode === "week"
      ? `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}`
      : viewMode === "day"
      ? format(currentDate, "EEE, d MMM yyyy")
      : format(currentDate, "MMMM yyyy");

  const hours = Array.from({ length: 17 }, (_, index) => index + 6);
  const viewKey = `${viewMode}-${
    viewMode === "month" ? format(currentDate, "yyyy-MM") : viewMode === "week" ? localDateKey(visibleStart) : localDateKey(currentDate)
  }`;

  const agendaItems = [
    ...filteredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.start_date,
      allDay: Boolean(event.all_day),
      detail: CATEGORIES.find((cat) => cat.value === (event.category || "business"))?.label ?? (event.category || "Business"),
    })),
    ...(showTasks
      ? tasks.map((task) => ({
          id: `task:${task.id}`,
          title: task.title,
          date: task.due_date!,
          allDay: true,
          kind: "task" as const,
          completed: task.status === "completed",
          detail: task.status.replace(/_/g, " "),
        }))
      : []),
  ];

  const pillForCategory = (cat: string | null | undefined) =>
    pastelPillColors(categoryBaseColor(muiTheme, cat), paperBg, isDark);

  const allChecked = Object.values(filters).every(Boolean);
  const someChecked = Object.values(filters).some(Boolean) && !allChecked;

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gap: 3 }}>
        <PageHeader
          title="Calendar"
          subtitle="Make room for what's next. Events and tasks, in one place."
          actions={
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => openNewEvent()}>
              Add Event
            </Button>
          }
        />

        {/* Unified Materialize Split Calendar Card: 300px Left Rail + Main Calendar Grid */}
        <Card sx={{ borderRadius: "16px", overflow: "hidden" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "300px minmax(0, 1fr)" },
              alignItems: "stretch",
            }}
          >
            {/* Left Sidebar Rail */}
            <Box
              sx={{
                borderRight: { xs: 0, lg: 1 },
                borderBottom: { xs: 1, lg: 0 },
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <Box sx={{ p: 2.5, borderBottom: 1, borderColor: "divider" }}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Plus size={16} />}
                  onClick={() => openNewEvent()}
                  sx={{ py: 1.15 }}
                >
                  Add Event
                </Button>
              </Box>

              <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <DateCalendar
                  selected={currentDate}
                  month={currentDate}
                  onMonthChange={setCurrentDate}
                  onSelect={(date) => {
                    if (date) setCurrentDate(date);
                  }}
                />
              </Box>

              <Box sx={{ p: 2.5, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
                  Event Filters
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={someChecked}
                      onChange={() => {
                        const enabled = !allChecked;
                        setFilters(Object.fromEntries(CATEGORIES.map((category) => [category.value, enabled])));
                      }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontSize: 12.5, fontWeight: 550 }}>View All</Typography>}
                />
                {CATEGORIES.map((category) => (
                  <Box key={category.value}>
                    <FormControlLabel
                      sx={{ my: -0.25 }}
                      control={
                        <Checkbox
                          size="small"
                          checked={filters[category.value] !== false}
                          onChange={(_event, checked) =>
                            setFilters((current) => ({ ...current, [category.value]: checked }))
                          }
                          sx={{
                            color: muiTheme.palette[category.paletteKey].main,
                            "&.Mui-checked": { color: muiTheme.palette[category.paletteKey].main },
                          }}
                        />
                      }
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              bgcolor: muiTheme.palette[category.paletteKey].main,
                            }}
                          />
                          <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                            {category.label}
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                ))}
                <Divider sx={{ my: 1.25 }} />
                <FormControlLabel
                  control={<Switch size="small" checked={showTasks} onChange={(_event, checked) => setShowTasks(checked)} />}
                  label={<Typography variant="body2" sx={{ fontSize: 12.5 }}>Show tasks</Typography>}
                />
              </Box>

              {/* Embedded Day Agenda preserving quick access & E2E region */}
              <Box sx={{ p: 2 }}>
                <AgendaWidget
                  items={agendaItems}
                  date={currentDate}
                  onDateChange={setCurrentDate}
                  onOpen={(item) => {
                    if (item.id.startsWith("task:")) navigate("/tasks");
                    else {
                      const event = events.find((ev) => ev.id === item.id);
                      if (event) openEditEvent(event);
                    }
                  }}
                  loading={eventsQuery.isPending}
                  error={eventsQuery.error?.message}
                  onRetry={() => void eventsQuery.refetch()}
                  index={1}
                />
              </Box>
            </Box>

            {/* Main Calendar Grid Canvas */}
            <Box sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1.5,
                  alignItems: "center",
                  mb: 2.5,
                }}
              >
                <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", minWidth: 0 }}>
                  <IconButton
                    size="small"
                    aria-label="Previous calendar period"
                    onClick={() => navigatePeriod(-1)}
                    sx={{ border: 1, borderColor: "divider", borderRadius: "8px" }}
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Next calendar period"
                    onClick={() => navigatePeriod(1)}
                    sx={{ border: 1, borderColor: "divider", borderRadius: "8px" }}
                  >
                    <ChevronRight size={16} />
                  </IconButton>
                  <Typography component="h2" variant="h6" sx={{ fontWeight: 700, fontSize: { xs: 15, sm: 18 }, ml: 1 }}>
                    {headerLabel}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <Button size="small" variant="outlined" onClick={() => setCurrentDate(new Date())}>
                    Today
                  </Button>
                  <SegmentedControl
                    value={viewMode}
                    onChange={setViewMode}
                    label="Calendar view"
                    options={(["month", "week", "day", "list"] as ViewMode[]).map((view) => ({ value: view, label: view }))}
                    sx={{ textTransform: "capitalize" }}
                  />
                </Box>
              </Box>

              {eventsQuery.isError ? (
                <Alert
                  severity="error"
                  action={
                    <Button color="inherit" size="small" onClick={() => void eventsQuery.refetch()}>
                      Retry
                    </Button>
                  }
                >
                  Calendar events could not be loaded.
                </Alert>
              ) : eventsQuery.isPending ? (
                <Skeleton variant="rounded" height={500} aria-label="Loading calendar" />
              ) : (
                <MotionSection key={viewKey}>
                  {viewMode === "month" && (
                    <MonthView
                      currentDate={currentDate}
                      filteredEvents={filteredEvents}
                      tasks={showTasks ? tasks : []}
                      pillForCategory={pillForCategory}
                      onDayClick={openNewEvent}
                      onEventClick={openEditEvent}
                    />
                  )}
                  {viewMode === "week" && (
                    <WeekView
                      currentDate={currentDate}
                      hours={hours}
                      filteredEvents={filteredEvents}
                      tasks={showTasks ? tasks : []}
                      pillForCategory={pillForCategory}
                      onSlotClick={openNewEvent}
                      onEventClick={openEditEvent}
                    />
                  )}
                  {viewMode === "day" && (
                    <DayView
                      currentDate={currentDate}
                      hours={hours}
                      filteredEvents={filteredEvents}
                      tasks={showTasks ? tasks : []}
                      pillForCategory={pillForCategory}
                      onSlotClick={openNewEvent}
                      onEventClick={openEditEvent}
                    />
                  )}
                  {viewMode === "list" && (
                    <ListView
                      filteredEvents={filteredEvents}
                      tasks={showTasks ? tasks : []}
                      pillForCategory={pillForCategory}
                      onEventClick={openEditEvent}
                    />
                  )}
                </MotionSection>
              )}

              {showTasks && board.isError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Tasks could not be loaded. Calendar events are still available.
                </Alert>
              )}
            </Box>
          </Box>
        </Card>

        {/* Right Slide-Over Add / Edit Event SideDrawer */}
        <SideDrawer
          open={dialogOpen}
          busy={saving}
          onClose={() => setDialogOpen(false)}
          title={editEvent ? "Edit Event" : "Add Event"}
          description={editEvent ? "Update schedule details or remove this event" : "Schedule a meeting, task, or reminder"}
          width={420}
          footer={
            <>
              <Box>
                {editEvent && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={saving}
                    onClick={() => void handleDelete()}
                    startIcon={<Trash2 size={14} />}
                  >
                    Delete
                  </Button>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" disabled={saving} onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
                  {saving ? "Saving…" : editEvent ? "Update" : "Add Event"}
                </Button>
              </Box>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Title"
              required
              size="small"
              fullWidth
              value={formTitle}
              onChange={(event) => setFormTitle(event.target.value)}
            />
            <TextField
              label="Category"
              select
              size="small"
              fullWidth
              value={formCategory}
              onChange={(event) => setFormCategory(event.target.value)}
            >
              {CATEGORIES.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        bgcolor: muiTheme.palette[category.paletteKey].main,
                      }}
                    />
                    {category.label}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Switch checked={formAllDay} onChange={(_event, checked) => setFormAllDay(checked)} />}
              label="All day"
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 1.5 }}>
              <TextField
                type="date"
                label="Start Date"
                size="small"
                value={formStartDate}
                onChange={(event) => setFormStartDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {!formAllDay && (
                <TextField
                  type="time"
                  label="Start Time"
                  size="small"
                  value={formStartTime}
                  onChange={(event) => setFormStartTime(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 1.5 }}>
              <TextField
                type="date"
                label="End Date"
                size="small"
                value={formEndDate}
                onChange={(event) => setFormEndDate(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {!formAllDay && (
                <TextField
                  type="time"
                  label="End Time"
                  size="small"
                  value={formEndTime}
                  onChange={(event) => setFormEndTime(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            </Box>
            <TextField
              label="Description"
              multiline
              minRows={3}
              size="small"
              value={formDescription}
              onChange={(event) => setFormDescription(event.target.value)}
            />
            {!editEvent && (
              <FormControlLabel
                control={<Switch checked={formLinkTask} onChange={(_event, checked) => setFormLinkTask(checked)} />}
                label={
                  <Box>
                    <Typography variant="body2">Also create a task</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Assigned to you, due on the event’s start date.
                    </Typography>
                  </Box>
                }
              />
            )}
          </Box>
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}

// ═══════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════
function MonthView({
  currentDate,
  filteredEvents,
  tasks,
  pillForCategory,
  onDayClick,
  onEventClick,
}: {
  currentDate: Date;
  filteredEvents: CalendarEvent[];
  tasks: Task[];
  pillForCategory: (cat: string | null | undefined) => { backgroundColor: string; color: string };
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const muiTheme = useTheme();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const getEventsForDay = (day: Date) => filteredEvents.filter((e) => isSameDay(parseISO(e.start_date), day));
  const getTasksForDay = (day: Date) => tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), day));

  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", mb: 0.5 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Box
            key={day}
            sx={{
              textAlign: "center",
              fontSize: "0.75rem",
              fontWeight: 650,
              color: "text.secondary",
              py: 1,
            }}
          >
            {day}
          </Box>
        ))}
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          borderTop: 1,
          borderLeft: 1,
          borderColor: "divider",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const dayTasks = getTasksForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <Box
              key={idx}
              onClick={() => onDayClick(day)}
              sx={mergeSx(
                {
                  minHeight: "112px",
                  borderRight: 1,
                  borderBottom: 1,
                  borderColor: "divider",
                  p: 0.75,
                  cursor: "pointer",
                  transition: "background-color 150ms ease",
                  "&:hover": { bgcolor: "action.hover" },
                },
                !inMonth && { bgcolor: alpha(muiTheme.palette.text.primary, 0.025) }
              )}
            >
              <Box
                sx={mergeSx(
                  {
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    mb: 0.5,
                    height: 24,
                    width: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "9999px",
                  },
                  today
                    ? { bgcolor: "primary.main", color: "primary.contrastText" }
                    : !inMonth
                    ? { color: "text.disabled" }
                    : { color: "text.primary" }
                )}
              >
                {format(day, "d")}
              </Box>
              <Box sx={{ display: "grid", gap: 0.35 }}>
                {dayEvents.slice(0, 2).map((event) => (
                  <ButtonBase
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    title={event.title}
                    type="button"
                    sx={{
                      width: "100%",
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      px: 0.75,
                      py: 0.35,
                      borderRadius: "6px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minHeight: 22,
                      ...pillForCategory(event.category),
                    }}
                  >
                    {!event.all_day && (
                      <Box component="span" sx={{ opacity: 0.85, mr: 0.4 }}>
                        {format(parseISO(event.start_date), "HH:mm")}
                      </Box>
                    )}
                    {event.title}
                  </ButtonBase>
                ))}
                {dayTasks.slice(0, 2).map((task) => (
                  <Box
                    key={task.id}
                    title={`Task: ${task.title}`}
                    sx={{
                      width: "100%",
                      textAlign: "left",
                      fontSize: "10.5px",
                      fontWeight: 550,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: "6px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      border: 1,
                      borderStyle: "dashed",
                      borderColor: alpha(muiTheme.palette.primary.main, 0.35),
                      color: "primary.main",
                      bgcolor: alpha(muiTheme.palette.primary.main, 0.06),
                    }}
                  >
                    <Box component={ListTodo} sx={{ height: "0.65rem", width: "0.65rem", display: "inline", mr: 0.4 }} />
                    {task.title}
                  </Box>
                ))}
                {dayEvents.length + dayTasks.length > 4 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, px: 0.5 }}>
                    +{dayEvents.length + dayTasks.length - 4} more
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </>
  );
}

// ═══════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════
function WeekView({
  currentDate,
  hours,
  filteredEvents,
  tasks,
  pillForCategory,
  onSlotClick,
  onEventClick,
}: {
  currentDate: Date;
  hours: number[];
  filteredEvents: CalendarEvent[];
  tasks: Task[];
  pillForCategory: (cat: string | null | undefined) => { backgroundColor: string; color: string };
  onSlotClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const muiTheme = useTheme();
  const weekStart = startOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });
  const getEventsForDayHour = (day: Date, hour: number) =>
    filteredEvents.filter((e) => {
      const s = parseISO(e.start_date);
      return isSameDay(s, day) && getHours(s) === hour && !e.all_day;
    });
  const getAllDayEvents = (day: Date) =>
    filteredEvents.filter((e) => Boolean(e.all_day) && isSameDay(parseISO(e.start_date), day));
  const getTasksForDay = (day: Date) => tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), day));

  return (
    <Box sx={{ overflow: "auto" }}>
      {/* All-day row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", borderBottom: 1, borderColor: "divider" }}>
        <Box sx={{ p: 0.5, fontSize: 10, color: "text.secondary", borderRight: 1, borderColor: "divider" }}>All Day</Box>
        {weekDays.map((day, i) => {
          const allDay = getAllDayEvents(day);
          const dayTasks = getTasksForDay(day);
          return (
            <Box key={i} sx={{ p: 0.5, borderRight: 1, borderColor: "divider", minHeight: 28 }}>
              {allDay.map((e) => (
                <ButtonBase
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  type="button"
                  sx={{
                    width: "100%",
                    fontSize: 10,
                    fontWeight: 600,
                    px: 0.5,
                    py: 0.25,
                    borderRadius: "4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    mb: 0.25,
                    ...pillForCategory(e.category),
                  }}
                >
                  {e.title}
                </ButtonBase>
              ))}
              {dayTasks.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    fontSize: 10,
                    px: 0.5,
                    borderRadius: "4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    border: 1,
                    borderStyle: "dashed",
                    borderColor: alpha(muiTheme.palette.primary.main, 0.35),
                    color: "primary.main",
                    bgcolor: alpha(muiTheme.palette.primary.main, 0.06),
                    mb: 0.25,
                  }}
                >
                  {t.title}
                </Box>
              ))}
            </Box>
          );
        })}
      </Box>

      {/* Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          borderBottom: 1,
          borderColor: "divider",
          position: "sticky",
          top: 0,
          bgcolor: "background.paper",
          zIndex: 10,
        }}
      >
        <Box sx={{ p: 1, fontSize: 12, color: "text.secondary", borderRight: 1, borderColor: "divider" }} />
        {weekDays.map((day, i) => (
          <Box
            key={i}
            sx={mergeSx(
              { p: 1, textAlign: "center", borderRight: 1, borderColor: "divider" },
              isToday(day) && { bgcolor: alpha(muiTheme.palette.primary.main, 0.06) }
            )}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: "block" }}>
              {format(day, "EEE")}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: isToday(day) ? "primary.main" : "text.primary" }}>
              {format(day, "d")}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Time grid */}
      {hours.map((hour) => (
        <Box key={hour} sx={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ p: 0.5, fontSize: 10, color: "text.secondary", textAlign: "right", pr: 1, borderRight: 1, borderColor: "divider" }}>
            {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
          </Box>
          {weekDays.map((day, i) => {
            const slotEvents = getEventsForDayHour(day, hour);
            return (
              <Box
                key={i}
                onClick={() => {
                  const d = new Date(day);
                  d.setHours(hour);
                  onSlotClick(d);
                }}
                sx={mergeSx(
                  { minHeight: 48, borderRight: 1, borderColor: "divider", p: 0.35, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } },
                  isToday(day) && { bgcolor: alpha(muiTheme.palette.primary.main, 0.025) }
                )}
              >
                {slotEvents.map((e) => (
                  <ButtonBase
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onEventClick(e);
                    }}
                    type="button"
                    sx={{
                      width: "100%",
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      px: 0.5,
                      py: 0.25,
                      borderRadius: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      mb: 0.25,
                      ...pillForCategory(e.category),
                    }}
                  >
                    {format(parseISO(e.start_date), "HH:mm")} {e.title}
                  </ButtonBase>
                ))}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ═══════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════
function DayView({
  currentDate,
  hours,
  filteredEvents,
  tasks,
  pillForCategory,
  onSlotClick,
  onEventClick,
}: {
  currentDate: Date;
  hours: number[];
  filteredEvents: CalendarEvent[];
  tasks: Task[];
  pillForCategory: (cat: string | null | undefined) => { backgroundColor: string; color: string };
  onSlotClick: (d: Date) => void;
  onEventClick: (e: CalendarEvent) => void;
}) {
  const muiTheme = useTheme();
  const dayEvents = filteredEvents.filter((e) => isSameDay(parseISO(e.start_date), currentDate));
  const allDayEvents = dayEvents.filter((e) => Boolean(e.all_day));
  const timedEvents = dayEvents.filter((e) => !e.all_day);
  const dayTasks = tasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), currentDate));

  return (
    <Box sx={{ overflow: "auto" }}>
      {(allDayEvents.length > 0 || dayTasks.length > 0) && (
        <Box sx={{ borderBottom: 1, borderColor: "divider", p: 1, display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 600 }}>
            All Day:
          </Typography>
          {allDayEvents.map((e) => (
            <ButtonBase
              key={e.id}
              onClick={() => onEventClick(e)}
              type="button"
              sx={{
                fontSize: 11,
                fontWeight: 600,
                px: 1,
                py: 0.35,
                borderRadius: "6px",
                ...pillForCategory(e.category),
              }}
            >
              {e.title}
            </ButtonBase>
          ))}
          {dayTasks.map((t) => (
            <Box
              key={t.id}
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 550,
                px: 1,
                py: 0.25,
                borderRadius: "6px",
                border: 1,
                borderStyle: "dashed",
                borderColor: alpha(muiTheme.palette.primary.main, 0.35),
                color: "primary.main",
                bgcolor: alpha(muiTheme.palette.primary.main, 0.06),
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <ListTodo size={12} />
              {t.title}
            </Box>
          ))}
        </Box>
      )}

      {hours.map((hour) => {
        const slotEvents = timedEvents.filter((e) => getHours(parseISO(e.start_date)) === hour);
        return (
          <Box key={hour} sx={{ display: "flex", borderBottom: 1, borderColor: "divider", minHeight: 56 }}>
            <Box sx={{ width: 80, flexShrink: 0, p: 1, fontSize: 12, color: "text.secondary", textAlign: "right", borderRight: 1, borderColor: "divider" }}>
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </Box>
            <Box
              onClick={() => {
                const d = new Date(currentDate);
                d.setHours(hour);
                onSlotClick(d);
              }}
              sx={{ flex: 1, p: 0.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
            >
              {slotEvents.map((e) => (
                <ButtonBase
                  key={e.id}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventClick(e);
                  }}
                  type="button"
                  sx={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    fontSize: 11.5,
                    fontWeight: 600,
                    px: 1,
                    py: 0.5,
                    borderRadius: "6px",
                    display: "flex",
                    width: "100%",
                    mb: 0.35,
                    ...pillForCategory(e.category),
                  }}
                >
                  {format(parseISO(e.start_date), "HH:mm")}
                  {e.end_date ? ` – ${format(parseISO(e.end_date), "HH:mm")}` : ""} · {e.title}
                </ButtonBase>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ═══════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════
function ListView({
  filteredEvents,
  tasks,
  pillForCategory,
  onEventClick,
}: {
  filteredEvents: CalendarEvent[];
  tasks: Task[];
  pillForCategory: (cat: string | null | undefined) => { backgroundColor: string; color: string };
  onEventClick: (e: CalendarEvent) => void;
}) {
  const muiTheme = useTheme();
  const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const grouped: Record<string, { events: CalendarEvent[]; tasks: Task[] }> = {};
  sortedEvents.forEach((e) => {
    const key = format(parseISO(e.start_date), "yyyy-MM-dd");
    if (!grouped[key]) grouped[key] = { events: [], tasks: [] };
    grouped[key].events.push(e);
  });
  tasks.forEach((t) => {
    if (!t.due_date) return;
    const key = t.due_date;
    if (!grouped[key]) grouped[key] = { events: [], tasks: [] };
    grouped[key].tasks.push(t);
  });
  const sortedKeys = Object.keys(grouped).sort();

  if (sortedKeys.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
        <Box component={CalendarDays} sx={{ height: 40, width: 40, mx: "auto", mb: 1.5, opacity: 0.3 }} />
        <Typography variant="body2">No events in this period</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      {sortedKeys.map((dateKey) => {
        const d = parseISO(dateKey);
        const group = grouped[dateKey];
        return (
          <Box key={dateKey}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box
                sx={{
                  height: 32,
                  width: 32,
                  borderRadius: "9999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  bgcolor: isToday(d) ? "primary.main" : "action.selected",
                  color: isToday(d) ? "primary.contrastText" : "text.primary",
                }}
              >
                {format(d, "d")}
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 650 }}>
                  {format(d, "EEEE")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                  {format(d, "MMMM yyyy")}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ ml: 5, display: "grid", gap: 0.75 }}>
              {group.events.map((e) => (
                <ButtonBase
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  type="button"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    width: "100%",
                    textAlign: "left",
                    p: 1,
                    borderRadius: "10px",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      height: 10,
                      width: 10,
                      borderRadius: "9999px",
                      flexShrink: 0,
                      bgcolor: categoryBaseColor(muiTheme, e.category),
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {e.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      {e.all_day
                        ? "All Day"
                        : `${format(parseISO(e.start_date), "HH:mm")}${e.end_date ? ` – ${format(parseISO(e.end_date), "HH:mm")}` : ""}`}
                      {e.description ? ` · ${e.description}` : ""}
                    </Typography>
                  </Box>
                  <StatusChip
                    label={e.category || "business"}
                    sx={{ fontSize: 10.5, fontWeight: 650, textTransform: "capitalize", flexShrink: 0, ...pillForCategory(e.category) }}
                  />
                </ButtonBase>
              ))}
              {group.tasks.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                    p: 1,
                    borderRadius: "10px",
                    border: 1,
                    borderStyle: "dashed",
                    borderColor: alpha(muiTheme.palette.primary.main, 0.3),
                    bgcolor: alpha(muiTheme.palette.primary.main, 0.05),
                  }}
                >
                  <ListTodo size={14} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 550, color: "primary.main", flex: 1 }}>
                    {t.title}
                  </Typography>
                  <StatusChip label={t.status || "pending"} variant="outlined" sx={{ fontSize: 10, textTransform: "capitalize", flexShrink: 0 }} />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
