import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-destructive/10 text-destructive",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
};

const emptyForm = { title: "", description: "", assigned_to: "", priority: "medium", due_date: "", related_entity_type: "", related_entity_id: "" };

export default function Tasks() {
  const { user, hasRole } = useAuth();
  const isAdminOrStaff = hasRole("admin") || hasRole("staff");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [staffList, setStaffList] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const fetchTasks = async () => {
    setLoading(true);
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [search, statusFilter]);
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
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: form.title, description: form.description || null,
      assigned_to: form.assigned_to || null, priority: form.priority,
      due_date: form.due_date || null,
      related_entity_type: form.related_entity_type || null,
      related_entity_id: form.related_entity_id || null,
    };
    if (editId) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert({ ...payload, assigned_by: user?.id });
      if (error) toast.error(error.message); else toast.success("Task created");
    }
    setSheetOpen(false);
    fetchTasks();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); fetchTasks(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
          <p className="text-muted-foreground">Create and track tasks across your team</p>
        </div>
        {isAdminOrStaff && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Task</Button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Assigned To</TableHead>
              <TableHead className="hidden md:table-cell">Due Date</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : tasks.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />No tasks yet
              </TableCell></TableRow>
            ) : tasks.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => openEdit(t)}>{t.title}</TableCell>
                <TableCell><Badge className={priorityColors[t.priority]}>{t.priority}</Badge></TableCell>
                <TableCell>
                  <Select value={t.status} onValueChange={v => updateStatus(t.id, v)}>
                    <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pending", "in_progress", "completed"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{getStaffName(t.assigned_to)}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN") : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(t)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Task" : "New Task"}</SheetTitle>
            <SheetDescription>Task details and assignment</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Related To</Label>
              <Select value={form.related_entity_type} onValueChange={v => setForm(p => ({ ...p, related_entity_type: v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="repair">Repair Job</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update Task" : "Create Task"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
