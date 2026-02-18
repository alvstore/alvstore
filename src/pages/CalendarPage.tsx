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
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isSameDay, isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  category: string;
  color: string | null;
  created_by: string;
}

const CATEGORIES = [
  { value: "personal", label: "Personal", color: "bg-red-500" },
  { value: "business", label: "Business", color: "bg-primary" },
  { value: "family", label: "Family", color: "bg-green-500" },
  { value: "holiday", label: "Holiday", color: "bg-amber-500" },
  { value: "etc", label: "ETC", color: "bg-cyan-500" },
];

const getCategoryColor = (category: string) => {
  return CATEGORIES.find(c => c.value === category)?.color || "bg-muted-foreground";
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({
    personal: true, business: true, family: true, holiday: true, etc: true,
  });

  // Form
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formCategory, setFormCategory] = useState("business");

  const fetchEvents = useCallback(async () => {
    const monthStart = startOfMonth(currentMonth).toISOString();
    const monthEnd = endOfMonth(currentMonth).toISOString();
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("start_date", monthStart)
      .lte("start_date", monthEnd)
      .order("start_date");
    if (!error && data) setEvents(data as CalendarEvent[]);
  }, [currentMonth]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const filteredEvents = events.filter(e => filters[e.category] !== false);

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(e => isSameDay(parseISO(e.start_date), day));
  };

  const openNewEvent = (date?: Date) => {
    setEditEvent(null);
    const d = date || new Date();
    setFormTitle("");
    setFormDescription("");
    setFormStartDate(format(d, "yyyy-MM-dd"));
    setFormStartTime("09:00");
    setFormEndDate(format(d, "yyyy-MM-dd"));
    setFormEndTime("10:00");
    setFormAllDay(false);
    setFormCategory("business");
    setDialogOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditEvent(event);
    const start = parseISO(event.start_date);
    setFormTitle(event.title);
    setFormDescription(event.description || "");
    setFormStartDate(format(start, "yyyy-MM-dd"));
    setFormStartTime(format(start, "HH:mm"));
    if (event.end_date) {
      const end = parseISO(event.end_date);
      setFormEndDate(format(end, "yyyy-MM-dd"));
      setFormEndTime(format(end, "HH:mm"));
    }
    setFormAllDay(event.all_day);
    setFormCategory(event.category);
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
      if (error) toast.error(error.message);
      else toast.success("Event updated");
    } else {
      const { error } = await supabase.from("calendar_events").insert({
        title: formTitle, description: formDescription || null,
        start_date: startDateTime, end_date: endDateTime,
        all_day: formAllDay, category: formCategory,
        created_by: user?.id,
      });
      if (error) toast.error(error.message);
      else toast.success("Event created");
    }
    setDialogOpen(false);
    fetchEvents();
  };

  const handleDelete = async () => {
    if (!editEvent) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", editEvent.id);
    if (error) toast.error(error.message);
    else toast.success("Event deleted");
    setDialogOpen(false);
    fetchEvents();
  };

  const toggleFilter = (category: string) => {
    setFilters(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleAllFilters = () => {
    const allOn = Object.values(filters).every(v => v);
    const next: Record<string, boolean> = {};
    CATEGORIES.forEach(c => { next[c.value] = !allOn; });
    setFilters(next);
  };

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
                selected={selectedDate || undefined}
                onSelect={(d) => { if (d) { setSelectedDate(d); setCurrentMonth(d); } }}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
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
            </CardContent>
          </Card>
        </div>

        {/* Main Calendar Grid */}
        <div className="lg:col-span-9">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold text-foreground ml-2">
                    {format(currentMonth, "MMMM yyyy")}
                  </h2>
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 border-t border-l border-border">
                {days.map((day, idx) => {
                  const dayEvents = getEventsForDay(day);
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-[100px] border-r border-b border-border p-1 cursor-pointer hover:bg-muted/30 transition-colors",
                        !inMonth && "bg-muted/10",
                      )}
                      onClick={() => openNewEvent(day)}
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
                        {dayEvents.slice(0, 3).map(event => (
                          <button
                            key={event.id}
                            onClick={e => { e.stopPropagation(); openEditEvent(event); }}
                            className={cn(
                              "w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate text-white",
                              getCategoryColor(event.category),
                            )}
                          >
                            {!event.all_day && format(parseISO(event.start_date), "HH:mm") + " "}
                            {event.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && (
                          <p className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editEvent ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Date</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              {!formAllDay && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Start Time</Label>
                  <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">End Date</Label>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              </div>
              {!formAllDay && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">End Time</Label>
                  <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={2} placeholder="Optional details..." />
            </div>
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
