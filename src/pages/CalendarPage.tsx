import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Trash2, ListTodo, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  parseISO, getHours, getMinutes, startOfDay, endOfDay,
  eachHourOfInterval, setHours,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string; title: string; description: string | null; start_date: string;
  end_date: string | null; all_day: boolean; category: string; color: string | null;
  created_by: string;
}

interface Task {
  id: string; title: string; due_date: string | null; status: string | null;
  priority: string | null;
}

type ViewMode = "month" | "week" | "day" | "list";

const CATEGORIES = [
  { value: "personal", label: "Personal", color: "bg-red-500" },
  { value: "business", label: "Business", color: "bg-primary" },
  { value: "family", label: "Family", color: "bg-green-500" },
  { value: "holiday", label: "Holiday", color: "bg-amber-500" },
  { value: "etc", label: "ETC", color: "bg-cyan-500" },
];

const getCategoryColor = (category: string) => CATEGORIES.find(c => c.value === category)?.color || "bg-muted-foreground";

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({
    personal: true, business: true, family: true, holiday: true, etc: true,
  });
  const [showTasks, setShowTasks] = useState(true);

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formCategory, setFormCategory] = useState("business");
  const [formLinkTask, setFormLinkTask] = useState(false);

  // Calculate date range based on view
  const getDateRange = useCallback(() => {
    if (viewMode === "month") {
      return { start: startOfWeek(startOfMonth(currentDate)), end: endOfWeek(endOfMonth(currentDate)) };
    } else if (viewMode === "week") {
      return { start: startOfWeek(currentDate), end: endOfWeek(currentDate) };
    } else if (viewMode === "day") {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    }
    // list: show next 30 days
    return { start: startOfDay(currentDate), end: addDays(currentDate, 30) };
  }, [currentDate, viewMode]);

  const fetchEvents = useCallback(async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from("calendar_events").select("*")
      .gte("start_date", start.toISOString()).lte("start_date", end.toISOString())
      .order("start_date");
    if (data) setEvents(data as CalendarEvent[]);
  }, [getDateRange]);

  const fetchTasks = useCallback(async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from("tasks").select("id, title, due_date, status, priority")
      .not("due_date", "is", null)
      .gte("due_date", format(start, "yyyy-MM-dd")).lte("due_date", format(end, "yyyy-MM-dd"));
    if (data) setTasks(data);
  }, [getDateRange]);

  useEffect(() => { fetchEvents(); fetchTasks(); }, [fetchEvents, fetchTasks]);

  const filteredEvents = events.filter(e => filters[e.category] !== false);
  const getEventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(parseISO(e.start_date), day));
  const getTasksForDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));

  const openNewEvent = (date?: Date) => {
    setEditEvent(null);
    const d = date || new Date();
    setFormTitle(""); setFormDescription("");
    setFormStartDate(format(d, "yyyy-MM-dd"));
    setFormStartTime("09:00");
    setFormEndDate(format(d, "yyyy-MM-dd"));
    setFormEndTime("10:00");
    setFormAllDay(false); setFormCategory("business"); setFormLinkTask(false);
    setDialogOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditEvent(event);
    const start = parseISO(event.start_date);
    setFormTitle(event.title); setFormDescription(event.description || "");
    setFormStartDate(format(start, "yyyy-MM-dd"));
    setFormStartTime(format(start, "HH:mm"));
    if (event.end_date) {
      const end = parseISO(event.end_date);
      setFormEndDate(format(end, "yyyy-MM-dd"));
      setFormEndTime(format(end, "HH:mm"));
    }
    setFormAllDay(event.all_day); setFormCategory(event.category); setFormLinkTask(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    const startDateTime = formAllDay ? `${formStartDate}T00:00:00` : `${formStartDate}T${formStartTime}:00`;
    const endDateTime = formAllDay ? `${formEndDate || formStartDate}T23:59:59` : `${formEndDate || formStartDate}T${formEndTime}:00`;

    if (editEvent) {
      const { error } = await supabase.from("calendar_events").update({
        title: formTitle, description: formDescription || null,
        start_date: startDateTime, end_date: endDateTime,
        all_day: formAllDay, category: formCategory,
      }).eq("id", editEvent.id);
      if (error) toast.error(error.message); else toast.success("Event updated");
    } else {
      const { error } = await supabase.from("calendar_events").insert({
        title: formTitle, description: formDescription || null,
        start_date: startDateTime, end_date: endDateTime,
        all_day: formAllDay, category: formCategory, created_by: user?.id,
      });
      if (error) toast.error(error.message); else toast.success("Event created");
    }

    if (formLinkTask && !editEvent) {
      await supabase.from("tasks").insert({
        title: formTitle, description: formDescription || null,
        due_date: formStartDate, status: "pending", priority: "normal",
        assigned_to: user?.id, assigned_by: user?.id,
        related_entity_type: "calendar_event",
      });
    }

    setDialogOpen(false);
    fetchEvents(); fetchTasks();
  };

  const handleDelete = async () => {
    if (!editEvent) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", editEvent.id);
    if (error) toast.error(error.message); else toast.success("Event deleted");
    setDialogOpen(false);
    fetchEvents();
  };

  const toggleFilter = (category: string) => setFilters(prev => ({ ...prev, [category]: !prev[category] }));
  const toggleAllFilters = () => {
    const allOn = Object.values(filters).every(v => v);
    const next: Record<string, boolean> = {};
    CATEGORIES.forEach(c => { next[c.value] = !allOn; });
    setFilters(next);
  };

  // Navigation
  const goBack = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else if (viewMode === "day") setCurrentDate(subDays(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const goForward = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else if (viewMode === "day") setCurrentDate(addDays(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const headerLabel = () => {
    if (viewMode === "month") return format(currentDate, "MMMM yyyy");
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = endOfWeek(currentDate);
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    if (viewMode === "day") return format(currentDate, "EEEE, MMM d, yyyy");
    return format(currentDate, "MMMM yyyy");
  };

  // HOURS for week/day view
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6AM to 10PM

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Manage events & schedules</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <Button className="w-full" onClick={() => openNewEvent()}>
            <Plus className="h-4 w-4 mr-2" />Add Event
          </Button>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(d) => { if (d) setCurrentDate(d); }}
                month={currentDate}
                onMonthChange={setCurrentDate}
                className="p-0 pointer-events-auto"
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event Filters</p>
              <div className="flex items-center gap-2">
                <Checkbox checked={Object.values(filters).every(v => v)} onCheckedChange={toggleAllFilters} />
                <Label className="text-sm">View All</Label>
              </div>
              {CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-2">
                  <Checkbox checked={filters[cat.value] !== false} onCheckedChange={() => toggleFilter(cat.value)} />
                  <div className={cn("h-2.5 w-2.5 rounded-full", cat.color)} />
                  <Label className="text-sm">{cat.label}</Label>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Checkbox checked={showTasks} onCheckedChange={(v) => setShowTasks(!!v)} />
                <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm">Show Tasks</Label>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Calendar Area */}
        <div className="lg:col-span-9">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              {/* Header with navigation + view toggle */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goBack}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goForward}><ChevronRight className="h-4 w-4" /></Button>
                  <h2 className="text-lg font-semibold text-foreground ml-2">{headerLabel()}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {(["month", "week", "day", "list"] as ViewMode[]).map(v => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                          viewMode === v
                            ? "bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* MONTH VIEW */}
              {viewMode === "month" && (
                <MonthView
                  currentDate={currentDate}
                  filteredEvents={filteredEvents}
                  tasks={showTasks ? tasks : []}
                  onDayClick={openNewEvent}
                  onEventClick={openEditEvent}
                />
              )}

              {/* WEEK VIEW */}
              {viewMode === "week" && (
                <WeekView
                  currentDate={currentDate}
                  hours={hours}
                  filteredEvents={filteredEvents}
                  tasks={showTasks ? tasks : []}
                  onSlotClick={(d) => openNewEvent(d)}
                  onEventClick={openEditEvent}
                />
              )}

              {/* DAY VIEW */}
              {viewMode === "day" && (
                <DayView
                  currentDate={currentDate}
                  hours={hours}
                  filteredEvents={filteredEvents}
                  tasks={showTasks ? tasks : []}
                  onSlotClick={(d) => openNewEvent(d)}
                  onEventClick={openEditEvent}
                />
              )}

              {/* LIST VIEW */}
              {viewMode === "list" && (
                <ListView
                  currentDate={currentDate}
                  filteredEvents={filteredEvents}
                  tasks={showTasks ? tasks : []}
                  onEventClick={openEditEvent}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editEvent ? "Edit Event" : "Add Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full", c.color)} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formAllDay} onCheckedChange={setFormAllDay} />
              <Label className="text-xs">All Day</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium">Start Date</Label><Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} /></div>
              {!formAllDay && <div className="space-y-1.5"><Label className="text-xs font-medium">Start Time</Label><Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs font-medium">End Date</Label><Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} /></div>
              {!formAllDay && <div className="space-y-1.5"><Label className="text-xs font-medium">End Time</Label><Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} /></div>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} placeholder="Optional details..." />
            </div>
            {!editEvent && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border">
                <Switch checked={formLinkTask} onCheckedChange={setFormLinkTask} className="h-4 w-7" />
                <div>
                  <Label className="text-xs font-medium">Also create a Task</Label>
                  <p className="text-[10px] text-muted-foreground">Syncs this event with the Task Manager</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editEvent && (
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            )}
            <Button onClick={handleSave}>{editEvent ? "Update" : "Add Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MONTH VIEW
// ═══════════════════════════════════════════════
function MonthView({ currentDate, filteredEvents, tasks, onDayClick, onEventClick }: {
  currentDate: Date; filteredEvents: CalendarEvent[]; tasks: Task[];
  onDayClick: (d: Date) => void; onEventClick: (e: CalendarEvent) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) => filteredEvents.filter(e => isSameDay(parseISO(e.start_date), day));
  const getTasksForDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));

  return (
    <>
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-t border-l border-border">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const dayTasks = getTasksForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[110px] border-r border-b border-border p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                !inMonth && "bg-muted/10",
              )}
              onClick={() => onDayClick(day)}
            >
              <div className={cn(
                "text-xs font-medium mb-1 h-6 w-6 flex items-center justify-center rounded-full",
                today && "bg-primary text-primary-foreground",
                !inMonth && "text-muted-foreground/50",
                inMonth && !today && "text-foreground",
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map(event => (
                  <button
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event); }}
                    className={cn(
                      "w-full text-left text-[11px] font-medium px-1.5 py-1 rounded truncate text-white min-h-[22px] leading-tight",
                      getCategoryColor(event.category),
                    )}
                    title={event.title}
                  >
                    {!event.all_day && <span className="opacity-80">{format(parseISO(event.start_date), "HH:mm")} </span>}
                    {event.title}
                  </button>
                ))}
                {dayTasks.slice(0, 2).map(task => (
                  <div
                    key={task.id}
                    className="w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate border border-dashed border-primary/40 text-primary bg-primary/5"
                    title={`Task: ${task.title}`}
                  >
                    <ListTodo className="h-2.5 w-2.5 inline mr-0.5" />
                    {task.title}
                  </div>
                ))}
                {(dayEvents.length + dayTasks.length) > 4 && (
                  <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length + dayTasks.length - 4} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// WEEK VIEW
// ═══════════════════════════════════════════════
function WeekView({ currentDate, hours, filteredEvents, tasks, onSlotClick, onEventClick }: {
  currentDate: Date; hours: number[]; filteredEvents: CalendarEvent[]; tasks: Task[];
  onSlotClick: (d: Date) => void; onEventClick: (e: CalendarEvent) => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(currentDate) });

  const getEventsForDayHour = (day: Date, hour: number) =>
    filteredEvents.filter(e => {
      const s = parseISO(e.start_date);
      return isSameDay(s, day) && getHours(s) === hour && !e.all_day;
    });

  const getAllDayEvents = (day: Date) =>
    filteredEvents.filter(e => e.all_day && isSameDay(parseISO(e.start_date), day));

  const getTasksForDay = (day: Date) => tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), day));

  return (
    <div className="overflow-auto">
      {/* All-day row */}
      <div className="grid grid-cols-8 border-b border-border">
        <div className="p-1 text-[10px] text-muted-foreground border-r border-border">All Day</div>
        {weekDays.map((day, i) => {
          const allDay = getAllDayEvents(day);
          const dayTasks = getTasksForDay(day);
          return (
            <div key={i} className="p-1 border-r border-border min-h-[28px]">
              {allDay.map(e => (
                <button key={e.id} onClick={() => onEventClick(e)} className={cn("w-full text-[10px] px-1 rounded text-white truncate mb-0.5", getCategoryColor(e.category))}>
                  {e.title}
                </button>
              ))}
              {dayTasks.map(t => (
                <div key={t.id} className="text-[10px] px-1 rounded truncate border border-dashed border-primary/40 text-primary bg-primary/5 mb-0.5">
                  {t.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="grid grid-cols-8 border-b border-border sticky top-0 bg-card z-10">
        <div className="p-2 text-xs text-muted-foreground border-r border-border"></div>
        {weekDays.map((day, i) => (
          <div key={i} className={cn("p-2 text-center border-r border-border", isToday(day) && "bg-primary/5")}>
            <p className="text-[10px] text-muted-foreground">{format(day, "EEE")}</p>
            <p className={cn("text-sm font-semibold", isToday(day) ? "text-primary" : "text-foreground")}>{format(day, "d")}</p>
          </div>
        ))}
      </div>

      {/* Time grid */}
      {hours.map(hour => (
        <div key={hour} className="grid grid-cols-8 border-b border-border/50">
          <div className="p-1 text-[10px] text-muted-foreground text-right pr-2 border-r border-border w-16">
            {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
          </div>
          {weekDays.map((day, i) => {
            const slotEvents = getEventsForDayHour(day, hour);
            return (
              <div
                key={i}
                className={cn("min-h-[48px] border-r border-border/50 p-0.5 cursor-pointer hover:bg-muted/20", isToday(day) && "bg-primary/[0.02]")}
                onClick={() => { const d = new Date(day); d.setHours(hour); onSlotClick(d); }}
              >
                {slotEvents.map(e => (
                  <button key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} className={cn("w-full text-left text-[10px] font-medium px-1 py-0.5 rounded text-white truncate mb-0.5", getCategoryColor(e.category))}>
                    {format(parseISO(e.start_date), "HH:mm")} {e.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// DAY VIEW
// ═══════════════════════════════════════════════
function DayView({ currentDate, hours, filteredEvents, tasks, onSlotClick, onEventClick }: {
  currentDate: Date; hours: number[]; filteredEvents: CalendarEvent[]; tasks: Task[];
  onSlotClick: (d: Date) => void; onEventClick: (e: CalendarEvent) => void;
}) {
  const dayEvents = filteredEvents.filter(e => isSameDay(parseISO(e.start_date), currentDate));
  const allDayEvents = dayEvents.filter(e => e.all_day);
  const timedEvents = dayEvents.filter(e => !e.all_day);
  const dayTasks = tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), currentDate));

  return (
    <div className="overflow-auto">
      {/* All-day section */}
      {(allDayEvents.length > 0 || dayTasks.length > 0) && (
        <div className="border-b border-border p-2 space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium">All Day</p>
          {allDayEvents.map(e => (
            <button key={e.id} onClick={() => onEventClick(e)} className={cn("text-[11px] font-medium px-2 py-1 rounded text-white mr-2", getCategoryColor(e.category))}>
              {e.title}
            </button>
          ))}
          {dayTasks.map(t => (
            <span key={t.id} className="text-[11px] font-medium px-2 py-1 rounded border border-dashed border-primary/40 text-primary bg-primary/5 mr-2 inline-block">
              <ListTodo className="h-3 w-3 inline mr-0.5" />{t.title}
            </span>
          ))}
        </div>
      )}

      {/* Hourly grid */}
      {hours.map(hour => {
        const slotEvents = timedEvents.filter(e => getHours(parseISO(e.start_date)) === hour);
        return (
          <div key={hour} className="flex border-b border-border/50 min-h-[56px]">
            <div className="w-20 shrink-0 p-2 text-xs text-muted-foreground text-right border-r border-border">
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            <div
              className="flex-1 p-1 cursor-pointer hover:bg-muted/20"
              onClick={() => { const d = new Date(currentDate); d.setHours(hour); onSlotClick(d); }}
            >
              {slotEvents.map(e => (
                <button key={e.id} onClick={ev => { ev.stopPropagation(); onEventClick(e); }} className={cn("text-left text-[11px] font-medium px-2 py-1 rounded text-white truncate block w-full mb-0.5", getCategoryColor(e.category))}>
                  {format(parseISO(e.start_date), "HH:mm")} – {e.end_date ? format(parseISO(e.end_date), "HH:mm") : ""} {e.title}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════
function ListView({ currentDate, filteredEvents, tasks, onEventClick }: {
  currentDate: Date; filteredEvents: CalendarEvent[]; tasks: Task[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  // Group events by date
  const sortedEvents = [...filteredEvents].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const grouped: Record<string, { events: CalendarEvent[]; tasks: Task[] }> = {};
  sortedEvents.forEach(e => {
    const key = format(parseISO(e.start_date), "yyyy-MM-dd");
    if (!grouped[key]) grouped[key] = { events: [], tasks: [] };
    grouped[key].events.push(e);
  });
  tasks.forEach(t => {
    if (!t.due_date) return;
    const key = t.due_date;
    if (!grouped[key]) grouped[key] = { events: [], tasks: [] };
    grouped[key].tasks.push(t);
  });

  const sortedKeys = Object.keys(grouped).sort();

  if (sortedKeys.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>No events in this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedKeys.map(dateKey => {
        const d = parseISO(dateKey);
        const group = grouped[dateKey];
        return (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold",
                isToday(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {format(d, "d")}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{format(d, "EEEE")}</p>
                <p className="text-[10px] text-muted-foreground">{format(d, "MMMM yyyy")}</p>
              </div>
            </div>
            <div className="ml-10 space-y-1.5">
              {group.events.map(e => (
                <button
                  key={e.id}
                  onClick={() => onEventClick(e)}
                  className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("h-3 w-3 rounded-full shrink-0", getCategoryColor(e.category))} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{e.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.all_day ? "All Day" : `${format(parseISO(e.start_date), "HH:mm")}${e.end_date ? ` – ${format(parseISO(e.end_date), "HH:mm")}` : ""}`}
                      {e.description && ` · ${e.description}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{e.category}</Badge>
                </button>
              ))}
              {group.tasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                  <ListTodo className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-sm font-medium text-primary truncate">{t.title}</p>
                  <Badge variant="outline" className="text-[10px] capitalize shrink-0">{t.status || "pending"}</Badge>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
