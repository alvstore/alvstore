"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, ButtonBase, Card, CardContent, Checkbox, FormControlLabel,
  IconButton, MenuItem, Skeleton, Switch, TextField, Typography,
} from "@mui/material";
import {
  AgendaWidget, AnimatedPage, DateCalendar, EmptyState, FormDialog, MotionSection,
  PageHeader, SegmentedControl, StatusChip, WidgetCard, confirmAction, mergeSx, toast,
} from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTaskBoard } from "@/hooks/useTaskBoard";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { localDateKey } from "@/lib/widget-data";
import { ChevronLeft, ChevronRight, Plus, Trash2, ListTodo, CalendarDays, Clock } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths,
  addWeeks, subWeeks, addDays, subDays, eachDayOfInterval, isSameMonth, isSameDay,
  isToday, parseISO, getHours, getMinutes, startOfDay, endOfDay, eachHourOfInterval, setHours,
} from "date-fns";

interface CalendarEvent {
  id: string; title: string; description: string | null; start_date: string;
  end_date: string | null; all_day: boolean; category: string; color: string | null; created_by: string;
}
interface Task { id: string; title: string; due_date: string | null; status: string | null; priority: string | null; }
type ViewMode = "month" | "week" | "day" | "list";
const CATEGORIES = [
  { value: "personal", label: "Personal", color: { backgroundColor: "rgb(239 68 68 / 1)" } },
  { value: "business", label: "Business", color: { backgroundColor: "hsl(var(--primary))" } },
  { value: "family", label: "Family", color: { backgroundColor: "rgb(34 197 94 / 1)" } },
  { value: "holiday", label: "Holiday", color: { backgroundColor: "rgb(245 158 11 / 1)" } },
  { value: "etc", label: "Other", color: { backgroundColor: "rgb(6 182 212 / 1)" } },
];
const getCategoryColor = (category: string) => CATEGORIES.find(c => c.value === category)?.color || { backgroundColor: "hsl(var(--muted-foreground))" };

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const board = useTaskBoard();
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
  const [filters, setFilters] = useState<Record<string, boolean>>({ personal: true, business: true, family: true, holiday: true, etc: true });
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

  const visibleStart = viewMode === "month" ? startOfWeek(startOfMonth(currentDate)) : viewMode === "week" ? startOfWeek(currentDate) : startOfDay(currentDate);
  const visibleEnd = viewMode === "month" ? endOfWeek(endOfMonth(currentDate)) : viewMode === "week" ? endOfWeek(currentDate) : viewMode === "day" ? endOfDay(currentDate) : endOfDay(addDays(currentDate, 30));
  // Always include the agenda week, even when the main view shows a single day.
  const agendaStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const agendaEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const rangeStart = visibleStart < agendaStart ? visibleStart : agendaStart;
  const rangeEnd = visibleEnd > agendaEnd ? visibleEnd : agendaEnd;
  const eventsQuery = useQuery<CalendarEvent[]>({
    queryKey: ["calendar", user?.id, rangeStart.toISOString(), rangeEnd.toISOString()], staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("*")
        .gte("start_date", rangeStart.toISOString()).lte("start_date", rangeEnd.toISOString()).order("start_date");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const events = eventsQuery.data ?? [];
  const filteredEvents = events.filter(event => filters[event.category] !== false);
  const tasks = board.tasks.filter(task => task.due_date && task.due_date >= localDateKey(rangeStart) && task.due_date <= localDateKey(rangeEnd));
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["calendar"] }); void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); void board.refresh(); };
  const openNewEvent = (date = currentDate) => {
    setFormError(""); setEditEvent(null); setFormTitle(""); setFormDescription("");
    setFormStartDate(format(date, "yyyy-MM-dd")); setFormEndDate(format(date, "yyyy-MM-dd"));
    setFormStartTime(format(date.getHours() >= 6 ? date : setHours(date, 9), "HH:00"));
    setFormEndTime(format(setHours(date, date.getHours() >= 6 ? Math.min(date.getHours() + 1, 23) : 10), "HH:00"));
    setFormAllDay(false); setFormCategory("business"); setFormLinkTask(false); setDialogOpen(true);
  };
  const openEditEvent = (event: CalendarEvent) => {
    setFormError(""); setEditEvent(event);
    const start = parseISO(event.start_date), end = parseISO(event.end_date ?? event.start_date);
    setFormTitle(event.title); setFormDescription(event.description ?? "");
    setFormStartDate(format(start, "yyyy-MM-dd")); setFormStartTime(format(start, "HH:mm"));
    setFormEndDate(format(end, "yyyy-MM-dd")); setFormEndTime(format(end, "HH:mm"));
    setFormAllDay(event.all_day); setFormCategory(event.category); setFormLinkTask(false); setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!formTitle.trim() || !formStartDate) { setFormError("A title and start date are required"); return; }
    const start = new Date(`${formStartDate}T${formAllDay ? "00:00:00" : `${formStartTime}:00`}`);
    const end = new Date(`${formEndDate || formStartDate}T${formAllDay ? "23:59:59" : `${formEndTime}:00`}`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) { setFormError("End date and time must be after the start"); return; }
    setFormError(""); setSaving(true);
    try {
      const payload = { title: formTitle.trim(), description: formDescription || null, start_date: start.toISOString(), end_date: end.toISOString(), all_day: formAllDay, category: formCategory };
      const { data: saved, error } = editEvent
        ? await supabase.from("calendar_events").update(payload).eq("id", editEvent.id)
        : await supabase.from("calendar_events").insert({ ...payload, created_by: user?.id }).select("id").single();
      if (error) throw new Error(error.message);
      if (formLinkTask && !editEvent) {
        const linked = await supabase.from("tasks").insert({ title: formTitle.trim(), description: formDescription || null, due_date: formStartDate, status: "pending", priority: "medium", assigned_to: user?.id, assigned_by: user?.id, related_entity_type: "calendar_event", related_entity_id: saved.id });
        if (linked.error) toast.error(`Event saved, but its task could not be created: ${linked.error.message}`);
        else toast.success("Event and task created");
      } else toast.success(editEvent ? "Event updated" : "Event created");
      setDialogOpen(false); refresh();
    } catch (error) { setFormError(error instanceof Error ? error.message : "Could not save the event"); }
    finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (!editEvent || !await confirmAction("Delete this event? This cannot be undone.")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("calendar_events").delete().eq("id", editEvent.id);
      if (error) throw new Error(error.message);
      toast.success("Event deleted"); setDialogOpen(false); refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete event"); }
    finally { setSaving(false); }
  };
  const navigatePeriod = (direction: -1 | 1) => setCurrentDate(date => viewMode === "month" || viewMode === "list" ? addMonths(date, direction) : viewMode === "week" ? addWeeks(date, direction) : addDays(date, direction));
  const headerLabel = viewMode === "week" ? `${format(startOfWeek(currentDate), "MMM d")} – ${format(endOfWeek(currentDate), "MMM d, yyyy")}` : viewMode === "day" ? format(currentDate, "EEE, d MMM yyyy") : format(currentDate, "MMMM yyyy");
  const hours = Array.from({ length: 17 }, (_, index) => index + 6);
  const viewKey = `${viewMode}-${viewMode === "month" ? format(currentDate, "yyyy-MM") : viewMode === "week" ? localDateKey(visibleStart) : localDateKey(currentDate)}`;
  const agendaItems = [
    ...filteredEvents.map(event => ({ id: event.id, title: event.title, date: event.start_date, allDay: event.all_day, detail: CATEGORIES.find(cat => cat.value === event.category)?.label ?? event.category })),
    ...(showTasks ? tasks.map(task => ({ id: `task:${task.id}`, title: task.title, date: task.due_date!, allDay: true, kind: "task" as const, completed: task.status === "completed", detail: task.status.replace(/_/g, " ") })) : []),
  ];

  return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
    <PageHeader title="Calendar" subtitle="Make room for what’s next. Events and tasks, in one place." actions={<Button variant="contained" startIcon={<Plus size={16} />} onClick={() => openNewEvent()}>Add Event</Button>} />
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) 300px", xl: "minmax(0,1fr) 320px" }, gap: 2.5, alignItems: "start" }}>
      <MotionSection><Card sx={{ borderRadius: "20px" }}><CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2.5 }}>
          <Box sx={{ display: "flex", gap: .5, alignItems: "center", minWidth: 0 }}>
            <IconButton size="small" aria-label="Previous calendar period" onClick={() => navigatePeriod(-1)}><ChevronLeft size={16} /></IconButton>
            <IconButton size="small" aria-label="Next calendar period" onClick={() => navigatePeriod(1)}><ChevronRight size={16} /></IconButton>
            <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 650, fontSize: { xs: 13, sm: 16 }, ml: .5 }}>{headerLabel}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Button size="small" variant="outlined" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <SegmentedControl value={viewMode} onChange={setViewMode} label="Calendar view" options={(["month", "week", "day", "list"] as ViewMode[]).map(view => ({ value: view, label: view }))} sx={{ textTransform: "capitalize" }} />
          </Box>
        </Box>
        {eventsQuery.isError ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void eventsQuery.refetch()}>Retry</Button>}>Calendar events could not be loaded.</Alert> : eventsQuery.isPending ? <Skeleton variant="rounded" height={480} aria-label="Loading calendar" /> : <MotionSection key={viewKey}>
          {viewMode === "month" && <MonthView currentDate={currentDate} filteredEvents={filteredEvents} tasks={showTasks ? tasks : []} onDayClick={openNewEvent} onEventClick={openEditEvent} />}
          {viewMode === "week" && <WeekView currentDate={currentDate} hours={hours} filteredEvents={filteredEvents} tasks={showTasks ? tasks : []} onSlotClick={openNewEvent} onEventClick={openEditEvent} />}
          {viewMode === "day" && <DayView currentDate={currentDate} hours={hours} filteredEvents={filteredEvents} tasks={showTasks ? tasks : []} onSlotClick={openNewEvent} onEventClick={openEditEvent} />}
          {viewMode === "list" && <ListView currentDate={currentDate} filteredEvents={filteredEvents} tasks={showTasks ? tasks : []} onEventClick={openEditEvent} />}
        </MotionSection>}
        {showTasks && board.isError && <Alert severity="warning" sx={{ mt: 2 }}>Tasks could not be loaded. Calendar events are still available.</Alert>}
      </CardContent></Card></MotionSection>
      <Box sx={{ display: "grid", gap: 2.5, minWidth: 0 }}>
        <AgendaWidget items={agendaItems} date={currentDate} onDateChange={setCurrentDate} onOpen={item => { if (item.id.startsWith("task:")) navigate("/tasks"); else { const event = events.find(event => event.id === item.id); if (event) openEditEvent(event); } }} loading={eventsQuery.isPending} error={eventsQuery.error?.message} onRetry={() => void eventsQuery.refetch()} index={1} />
        <Box sx={{ display: { xs: "none", lg: "block" } }}><WidgetCard title="Jump to a date" index={2}><DateCalendar selected={currentDate} month={currentDate} onMonthChange={setCurrentDate} onSelect={date => { if (date) setCurrentDate(date); }} /></WidgetCard></Box>
        <WidgetCard title="Your calendars" subtitle="Choose what you want to see." index={3}>
          <FormControlLabel control={<Checkbox size="small" checked={Object.values(filters).every(Boolean)} indeterminate={Object.values(filters).some(Boolean) && !Object.values(filters).every(Boolean)} onChange={() => { const enabled = !Object.values(filters).every(Boolean); setFilters(Object.fromEntries(CATEGORIES.map(category => [category.value, enabled]))); }} />} label={<Typography variant="body2" sx={{ fontSize: 12 }}>View all events</Typography>} />
          {CATEGORIES.map(category => <Box key={category.value}><FormControlLabel sx={{ my: -.5 }} control={<Checkbox size="small" checked={filters[category.value] !== false} onChange={(_event, checked) => setFilters(current => ({ ...current, [category.value]: checked }))} />} label={<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ width: 6, height: 6, borderRadius: "50%", ...category.color }} /><Typography variant="body2" sx={{ fontSize: 12 }}>{category.label}</Typography></Box>} /></Box>)}
          <Box sx={{ borderTop: 1, borderColor: "divider", mt: 1, pt: 1 }}><FormControlLabel control={<Checkbox size="small" checked={showTasks} onChange={(_event, checked) => setShowTasks(checked)} />} label={<Typography variant="body2" sx={{ fontSize: 12 }}>Show tasks</Typography>} /></Box>
        </WidgetCard>
      </Box>
    </Box>

    <FormDialog open={dialogOpen} busy={saving} onClose={() => setDialogOpen(false)} title={editEvent ? "Edit Event" : "Add Event"} maxWidth="sm" actions={<>
      {editEvent && <Button variant="outlined" color="error" disabled={saving} onClick={handleDelete} startIcon={<Trash2 size={14} />}>Delete</Button>}
      <Button variant="text" disabled={saving} onClick={() => setDialogOpen(false)}>Cancel</Button>
      <Button variant="contained" disabled={saving} onClick={handleSave}>{saving ? "Saving…" : editEvent ? "Update" : "Add Event"}</Button>
    </>}>
      <Box sx={{ display: "grid", gap: 2, pt: 1 }}>
        {formError && <Alert severity="error">{formError}</Alert>}
        <TextField label="Title" required fullWidth value={formTitle} onChange={event => setFormTitle(event.target.value)} />
        <TextField label="Category" select value={formCategory} onChange={event => setFormCategory(event.target.value)}>{CATEGORIES.map(category => <MenuItem key={category.value} value={category.value}>{category.label}</MenuItem>)}</TextField>
        <FormControlLabel control={<Switch checked={formAllDay} onChange={(_event, checked) => setFormAllDay(checked)} />} label="All day" />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}><TextField type="date" label="Start Date" value={formStartDate} onChange={event => setFormStartDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />{!formAllDay && <TextField type="time" label="Start Time" value={formStartTime} onChange={event => setFormStartTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}</Box>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))" }, gap: 2 }}><TextField type="date" label="End Date" value={formEndDate} onChange={event => setFormEndDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />{!formAllDay && <TextField type="time" label="End Time" value={formEndTime} onChange={event => setFormEndTime(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />}</Box>
        <TextField label="Description" multiline minRows={2} value={formDescription} onChange={event => setFormDescription(event.target.value)} />
        {!editEvent && <FormControlLabel control={<Switch checked={formLinkTask} onChange={(_event, checked) => setFormLinkTask(checked)} />} label={<Box><Typography variant="body2">Also create a task</Typography><Typography variant="caption" color="text.secondary">Assigned to you, due on the event’s start date.</Typography></Box>} />}
      </Box>
    </FormDialog>
  </Box></AnimatedPage>;
}
// ═══════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════
function MonthView({ currentDate, filteredEvents, tasks, onDayClick, onEventClick }: {
    currentDate: Date;
    filteredEvents: CalendarEvent[];
    tasks: Task[];
    onDayClick: (d: Date) => void;
    onEventClick: (e: CalendarEvent) => void;
}) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const getEventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(parseISO(e.start_date), day));
    const getTasksForDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));
    return (<>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", marginBottom: "0.25rem" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (<Box key={day} sx={{ textAlign: "center", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>{day}</Box>))}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderTopWidth: "1px", borderLeftWidth: "1px", borderColor: "hsl(var(--border))" }}>
        {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const dayTasks = getTasksForDay(day);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            return (<Box key={idx} onClick={() => onDayClick(day)} sx={mergeSx({ minHeight: "110px", borderRightWidth: "1px", borderBottomWidth: "1px", borderColor: "hsl(var(--border))", padding: "0.25rem", cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, !inMonth && { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 10%, transparent)" })}>
              <Box sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", marginBottom: "0.25rem", height: "1.5rem", width: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "9999px" }, today && { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }, !inMonth && { color: "color-mix(in srgb, hsl(var(--muted-foreground)) 50%, transparent)" }, inMonth && !today && { color: "hsl(var(--foreground))" })}>
                {format(day, "d")}
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                {dayEvents.slice(0, 2).map(event => (<ButtonBase key={event.id} onClick={e => { e.stopPropagation(); onEventClick(event); }} title={event.title} type="button" sx={mergeSx({ width: "100%", textAlign: "left", fontSize: "11px", fontWeight: "500", paddingLeft: "0.375rem", paddingRight: "0.375rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgb(255 255 255 / 1)", minHeight: "22px", lineHeight: "1.25" }, getCategoryColor(event.category))}>
                    {!event.all_day && <Box component="span" sx={{ opacity: "0.8" }}>{format(parseISO(event.start_date), "HH:mm")} </Box>}
                    {event.title}
                  </ButtonBase>))}
                {dayTasks.slice(0, 2).map(task => (<Box key={task.id} title={`Task: ${task.title}`} sx={{ width: "100%", textAlign: "left", fontSize: "10px", fontWeight: "500", paddingLeft: "0.375rem", paddingRight: "0.375rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderWidth: "1px", borderStyle: "dashed", borderColor: "color-mix(in srgb, hsl(var(--primary)) 40%, transparent)", color: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" }}>
                    <Box component={ListTodo} sx={{ height: "0.625rem", width: "0.625rem", display: "inline", marginRight: "0.125rem" }}/>
                    {task.title}
                  </Box>))}
                {(dayEvents.length + dayTasks.length) > 4 && (<Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>+{dayEvents.length + dayTasks.length - 4} more</Typography>)}
              </Box>
            </Box>);
        })}
      </Box>
    </>);
}
// ═══════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════
function WeekView({ currentDate, hours, filteredEvents, tasks, onSlotClick, onEventClick }: {
    currentDate: Date;
    hours: number[];
    filteredEvents: CalendarEvent[];
    tasks: Task[];
    onSlotClick: (d: Date) => void;
    onEventClick: (e: CalendarEvent) => void;
}) {
    const weekStart = startOfWeek(currentDate);
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });
    const getEventsForDayHour = (day: Date, hour: number) => filteredEvents.filter(e => {
        const s = parseISO(e.start_date);
        return isSameDay(s, day) && getHours(s) === hour && !e.all_day;
    });
    const getAllDayEvents = (day: Date) => filteredEvents.filter(e => e.all_day && isSameDay(parseISO(e.start_date), day));
    const getTasksForDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));
    return (<Box sx={{ overflow: "auto" }}>
      {/* All-day row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", borderBottomWidth: "1px", borderColor: "hsl(var(--border))" }}>
        <Box sx={{ padding: "0.25rem", fontSize: "10px", color: "hsl(var(--muted-foreground))", borderRightWidth: "1px", borderColor: "hsl(var(--border))" }}>All Day</Box>
        {weekDays.map((day, i) => {
            const allDay = getAllDayEvents(day);
            const dayTasks = getTasksForDay(day);
            return (<Box key={i} sx={{ padding: "0.25rem", borderRightWidth: "1px", borderColor: "hsl(var(--border))", minHeight: "28px" }}>
              {allDay.map(e => (<ButtonBase key={e.id} onClick={() => onEventClick(e)} type="button" sx={mergeSx({ width: "100%", fontSize: "10px", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem", color: "rgb(255 255 255 / 1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.125rem" }, getCategoryColor(e.category))}>
                  {e.title}
                </ButtonBase>))}
              {dayTasks.map(t => (<Box key={t.id} sx={{ fontSize: "10px", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderWidth: "1px", borderStyle: "dashed", borderColor: "color-mix(in srgb, hsl(var(--primary)) 40%, transparent)", color: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)", marginBottom: "0.125rem" }}>
                  {t.title}
                </Box>))}
            </Box>);
        })}
      </Box>

      {/* Header */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", borderBottomWidth: "1px", borderColor: "hsl(var(--border))", position: "sticky", top: "0px", backgroundColor: "hsl(var(--card))", zIndex: "10" }}>
        <Box sx={{ padding: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", borderRightWidth: "1px", borderColor: "hsl(var(--border))" }}/>
        {weekDays.map((day, i) => (<Box key={i} sx={mergeSx({ padding: "0.5rem", textAlign: "center", borderRightWidth: "1px", borderColor: "hsl(var(--border))" }, isToday(day) && { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" })}>
            <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{format(day, "EEE")}</Typography>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }, isToday(day) ? { color: "hsl(var(--primary))" } : { color: "hsl(var(--foreground))" })}>{format(day, "d")}</Typography>
          </Box>))}
      </Box>

      {/* Time grid */}
      {hours.map(hour => (<Box key={hour} sx={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
          <Box sx={{ padding: "0.25rem", fontSize: "10px", color: "hsl(var(--muted-foreground))", textAlign: "right", paddingRight: "0.5rem", borderRightWidth: "1px", borderColor: "hsl(var(--border))", width: "4rem" }}>
            {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
          </Box>
          {weekDays.map((day, i) => {
                const slotEvents = getEventsForDayHour(day, hour);
                return (<Box key={i} onClick={() => { const d = new Date(day); d.setHours(hour); onSlotClick(d); }} sx={mergeSx({ minHeight: "48px", borderRightWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", padding: "0.125rem", cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)" } }, isToday(day) && { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 2%, transparent)" })}>
                {slotEvents.map(e => (<ButtonBase key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} type="button" sx={mergeSx({ width: "100%", textAlign: "left", fontSize: "10px", fontWeight: "500", paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", color: "rgb(255 255 255 / 1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "0.125rem" }, getCategoryColor(e.category))}>
                    {format(parseISO(e.start_date), "HH:mm")} {e.title}
                  </ButtonBase>))}
              </Box>);
            })}
        </Box>))}
    </Box>);
}
// ═══════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════
function DayView({ currentDate, hours, filteredEvents, tasks, onSlotClick, onEventClick }: {
    currentDate: Date;
    hours: number[];
    filteredEvents: CalendarEvent[];
    tasks: Task[];
    onSlotClick: (d: Date) => void;
    onEventClick: (e: CalendarEvent) => void;
}) {
    const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.start_date), currentDate));
    const allDayEvents = dayEvents.filter(e => e.all_day);
    const timedEvents = dayEvents.filter(e => !e.all_day);
    const dayTasks = tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), currentDate));
    return (<Box sx={{ overflow: "auto" }}>
      {/* All-day section */}
      {(allDayEvents.length > 0 || dayTasks.length > 0) && (<Box sx={{ borderBottomWidth: "1px", borderColor: "hsl(var(--border))", padding: "0.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
          <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>All Day</Typography>
          {allDayEvents.map(e => (<ButtonBase key={e.id} onClick={() => onEventClick(e)} type="button" sx={mergeSx({ fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", color: "rgb(255 255 255 / 1)", marginRight: "0.5rem" }, getCategoryColor(e.category))}>
              {e.title}
            </ButtonBase>))}
          {dayTasks.map(t => (<Box key={t.id} component="span" sx={{ fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", borderWidth: "1px", borderStyle: "dashed", borderColor: "color-mix(in srgb, hsl(var(--primary)) 40%, transparent)", color: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)", marginRight: "0.5rem", display: "inline-block" }}>
              <Box component={ListTodo} sx={{ height: "0.75rem", width: "0.75rem", display: "inline", marginRight: "0.125rem" }}/>{t.title}
            </Box>))}
        </Box>)}

      {/* Hourly grid */}
      {hours.map(hour => {
            const slotEvents = timedEvents.filter(e => getHours(parseISO(e.start_date)) === hour);
            return (<Box key={hour} sx={{ display: "flex", borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", minHeight: "56px" }}>
            <Box sx={{ width: "5rem", flexShrink: "0", padding: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "right", borderRightWidth: "1px", borderColor: "hsl(var(--border))" }}>
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </Box>
            <Box onClick={() => { const d = new Date(currentDate); d.setHours(hour); onSlotClick(d); }} sx={{ flex: "1 1 0%", padding: "0.25rem", cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)" } }}>
              {slotEvents.map(e => (<ButtonBase key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} type="button" sx={mergeSx({ textAlign: "left", fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", color: "rgb(255 255 255 / 1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", width: "100%", marginBottom: "0.125rem" }, getCategoryColor(e.category))}>
                  {format(parseISO(e.start_date), "HH:mm")} – {e.end_date ? format(parseISO(e.end_date), "HH:mm") : ""} {e.title}
                </ButtonBase>))}
            </Box>
          </Box>);
        })}
    </Box>);
}
// ═══════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════
function ListView({ currentDate, filteredEvents, tasks, onEventClick }: {
    currentDate: Date;
    filteredEvents: CalendarEvent[];
    tasks: Task[];
    onEventClick: (e: CalendarEvent) => void;
}) {
    // Group events by date
    const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    const grouped: Record<string, {
        events: CalendarEvent[];
        tasks: Task[];
    }> = {};
    sortedEvents.forEach(e => {
        const key = format(parseISO(e.start_date), "yyyy-MM-dd");
        if (!grouped[key])
            grouped[key] = { events: [], tasks: [] };
        grouped[key].events.push(e);
    });
    tasks.forEach(t => {
        if (!t.due_date)
            return;
        const key = t.due_date;
        if (!grouped[key])
            grouped[key] = { events: [], tasks: [] };
        grouped[key].tasks.push(t);
    });
    const sortedKeys = Object.keys(grouped).sort();
    if (sortedKeys.length === 0) {
        return (<Box sx={{ textAlign: "center", paddingTop: "4rem", paddingBottom: "4rem", color: "hsl(var(--muted-foreground))" }}>
        <Box component={CalendarDays} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.3" }}/>
        <Typography component="p" variant="body1">No events in this period</Typography>
      </Box>);
    }
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      {sortedKeys.map(dateKey => {
            const d = parseISO(dateKey);
            const group = grouped[dateKey];
            return (<Box key={dateKey}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Box sx={mergeSx({ height: "2rem", width: "2rem", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "700" }, isToday(d) ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}>
                {format(d, "d")}
              </Box>
              <Box>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{format(d, "EEEE")}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{format(d, "MMMM yyyy")}</Typography>
              </Box>
            </Box>
            <Box sx={{ marginLeft: "2.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              {group.events.map(e => (<ButtonBase key={e.id} onClick={() => onEventClick(e)} type="button" sx={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", textAlign: "left", padding: "0.5rem", borderRadius: "var(--radius)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                  <Box sx={mergeSx({ height: "0.75rem", width: "0.75rem", borderRadius: "9999px", flexShrink: "0" }, getCategoryColor(e.category))}/>
                  <Box sx={{ minWidth: "0px", flex: "1 1 0%" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>
                      {e.all_day ? "All Day" : `${format(parseISO(e.start_date), "HH:mm")}${e.end_date ? ` – ${format(parseISO(e.end_date), "HH:mm")}` : ""}`}
                      {e.description && ` · ${e.description}`}
                    </Typography>
                  </Box>
                  <StatusChip label={e.category} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize", flexShrink: "0" }}/>
                </ButtonBase>))}
              {group.tasks.map(t => (<Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem", borderRadius: "var(--radius)", borderWidth: "1px", borderStyle: "dashed", borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" }}>
                  <Box component={ListTodo} sx={{ height: "0.875rem", width: "0.875rem", color: "hsl(var(--primary))", flexShrink: "0" }}/>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--primary))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</Typography>
                  <StatusChip label={t.status || "pending"} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize", flexShrink: "0" }}/>
                </Box>))}
            </Box>
          </Box>);
        })}
    </Box>);
}
