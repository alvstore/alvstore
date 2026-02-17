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
import { Plus, Search, UserPlus, Target } from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  converted_customer_id: string | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  new: "bg-info/10 text-info",
  contacted: "bg-primary/10 text-primary",
  qualified: "bg-warning/10 text-warning",
  converted: "bg-success/10 text-success",
  lost: "bg-destructive/10 text-destructive",
};

const emptyForm = { name: "", phone: "", email: "", source: "walkin", notes: "", assigned_to: "" };

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [staffList, setStaffList] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [search, statusFilter]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => setStaffList(data || []));
  }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (l: Lead) => {
    setEditId(l.id);
    setForm({ name: l.name, phone: l.phone || "", email: l.email || "", source: l.source, notes: l.notes || "", assigned_to: l.assigned_to || "" });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name, phone: form.phone || null, email: form.email || null,
      source: form.source, notes: form.notes || null,
      assigned_to: form.assigned_to || null,
    };
    if (editId) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Lead updated");
    } else {
      const { error } = await supabase.from("leads").insert({ ...payload, created_by: user?.id });
      if (error) toast.error(error.message); else toast.success("Lead created");
    }
    setSheetOpen(false);
    fetchLeads();
  };

  const convertToCustomer = async (lead: Lead) => {
    if (lead.converted_customer_id) { toast.error("Already converted"); return; }
    const { data, error } = await supabase.from("customers").insert({
      name: lead.name, phone: lead.phone, email: lead.email, created_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("leads").update({ status: "converted", converted_customer_id: data.id }).eq("id", lead.id);
    toast.success("Lead converted to customer");
    fetchLeads();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Status updated"); fetchLeads(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-muted-foreground">Track and convert leads into customers</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Lead</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="contacted">Contacted</TabsTrigger>
            <TabsTrigger value="qualified">Qualified</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
            <TabsTrigger value="lost">Lost</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />No leads yet
              </TableCell></TableRow>
            ) : leads.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => openEdit(l)}>{l.name}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{l.phone || l.email || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{l.source}</Badge></TableCell>
                <TableCell>
                  <Select value={l.status} onValueChange={v => updateStatus(l.id, v)}>
                    <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["new", "contacted", "qualified", "converted", "lost"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  {l.status !== "converted" && (
                    <Button variant="outline" size="sm" onClick={() => convertToCustomer(l)}>
                      <UserPlus className="h-3.5 w-3.5 mr-1" />Convert
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Lead" : "New Lead"}</SheetTitle>
            <SheetDescription>Enter lead details</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["walkin", "website", "referral", "ads"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update Lead" : "Create Lead"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
