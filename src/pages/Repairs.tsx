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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Wrench, Eye } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["pending", "assigned", "in_progress", "waiting_parts", "completed", "delivered"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  waiting_parts: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

interface Ticket {
  id: string;
  ticket_number: string;
  device_type: string | null;
  device_brand: string | null;
  device_model: string | null;
  serial_number: string | null;
  issue_description: string | null;
  status: string;
  priority: string;
  estimated_cost: number | null;
  final_cost: number | null;
  diagnosis_notes: string | null;
  repair_notes: string | null;
  customer_id: string | null;
  assigned_technician_id: string | null;
  created_at: string;
  customers?: { name: string } | null;
}

interface StatusHistory {
  id: string;
  old_status: string | null;
  new_status: string;
  notes: string | null;
  created_at: string;
}

interface Customer { id: string; name: string; }

const emptyForm = {
  customer_id: "", device_type: "", device_brand: "", device_model: "",
  serial_number: "", issue_description: "", priority: "normal" as string,
  estimated_cost: "",
};

export default function Repairs() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);

  const fetchTickets = async () => {
    setLoading(true);
    let query = supabase.from("repair_tickets").select("*, customers(name)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.or(`ticket_number.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [search, statusFilter]);
  useEffect(() => {
    supabase.from("customers").select("id, name").order("name").then(({ data }) => setCustomers(data || []));
  }, []);

  const openNew = () => { setForm(emptyForm); setSheetOpen(true); };

  const handleSave = async () => {
    if (!form.customer_id) { toast.error("Select a customer"); return; }
    const { error } = await supabase.from("repair_tickets").insert({
      ticket_number: "",
      customer_id: form.customer_id,
      device_type: form.device_type || null, device_brand: form.device_brand || null,
      device_model: form.device_model || null, serial_number: form.serial_number || null,
      issue_description: form.issue_description || null,
      priority: form.priority as any,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Repair ticket created"); setSheetOpen(false); fetchTickets(); }
  };

  const openDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    const { data } = await supabase.from("repair_status_history")
      .select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
    setStatusHistory(data || []);
    setDetailSheet(true);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    const { error } = await supabase.from("repair_tickets")
      .update({ status: newStatus as any }).eq("id", selectedTicket.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
      fetchTickets();
      // Refresh history
      const { data } = await supabase.from("repair_status_history")
        .select("*").eq("ticket_id", selectedTicket.id).order("created_at", { ascending: true });
      setStatusHistory(data || []);
    }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Repair Management</h1>
          <p className="text-muted-foreground">Track and manage repair tickets</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Ticket</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {STATUSES.map(s => <TabsTrigger key={s} value={s} className="capitalize">{s.replace("_", " ")}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tickets..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Priority</TableHead>
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : tickets.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Wrench className="h-10 w-10 mx-auto mb-2 opacity-30" />No repair tickets
              </TableCell></TableRow>
            ) : tickets.map(t => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => openDetail(t)}>
                <TableCell className="font-medium">{t.ticket_number}</TableCell>
                <TableCell className="hidden sm:table-cell">{t.customers?.name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{[t.device_brand, t.device_model].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell><Badge className={statusColors[t.status] || ""} variant="secondary">{t.status.replace("_", " ")}</Badge></TableCell>
                <TableCell className="hidden sm:table-cell"><Badge className={priorityColors[t.priority] || ""} variant="secondary">{t.priority}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* New Ticket Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Repair Ticket</SheetTitle>
            <SheetDescription>Create a repair ticket for a customer device</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => updateField("customer_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {["device_type", "device_brand", "device_model", "serial_number"].map(f => (
              <div key={f} className="space-y-1.5">
                <Label className="capitalize">{f.replace("_", " ")}</Label>
                <Input value={(form as any)[f]} onChange={e => updateField(f, e.target.value)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Issue Description</Label>
              <Textarea value={form.issue_description} onChange={e => updateField("issue_description", e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => updateField("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Estimated Cost</Label>
                <Input type="number" value={form.estimated_cost} onChange={e => updateField("estimated_cost", e.target.value)} />
              </div>
            </div>
            <Button className="w-full" onClick={handleSave}>Create Ticket</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={detailSheet} onOpenChange={setDetailSheet}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedTicket && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedTicket.ticket_number}
                  <Badge className={statusColors[selectedTicket.status] || ""} variant="secondary">{selectedTicket.status.replace("_", " ")}</Badge>
                </SheetTitle>
                <SheetDescription>{selectedTicket.customers?.name}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                {/* Device info */}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Device Info</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {selectedTicket.device_brand && <p><span className="text-muted-foreground">Brand:</span> {selectedTicket.device_brand}</p>}
                    {selectedTicket.device_model && <p><span className="text-muted-foreground">Model:</span> {selectedTicket.device_model}</p>}
                    {selectedTicket.device_type && <p><span className="text-muted-foreground">Type:</span> {selectedTicket.device_type}</p>}
                    {selectedTicket.serial_number && <p><span className="text-muted-foreground">S/N:</span> {selectedTicket.serial_number}</p>}
                  </CardContent>
                </Card>

                {selectedTicket.issue_description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Issue</p>
                    <p className="text-sm text-muted-foreground">{selectedTicket.issue_description}</p>
                  </div>
                )}

                {/* Status update */}
                <div className="space-y-1.5">
                  <Label>Update Status</Label>
                  <Select value={selectedTicket.status} onValueChange={updateStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* Status timeline */}
                {statusHistory.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3">Status Timeline</p>
                    <div className="space-y-3">
                      {statusHistory.map(h => (
                        <div key={h.id} className="flex gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div>
                            <p className="font-medium capitalize">{h.new_status.replace("_", " ")}</p>
                            <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-muted-foreground space-y-1">
                  <Badge className={priorityColors[selectedTicket.priority] || ""} variant="secondary">Priority: {selectedTicket.priority}</Badge>
                  {selectedTicket.estimated_cost && <p>Estimated: ₹{selectedTicket.estimated_cost}</p>}
                  {selectedTicket.final_cost && <p>Final: ₹{selectedTicket.final_cost}</p>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
