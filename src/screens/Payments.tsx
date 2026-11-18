import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Clock, CheckCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Payment {
  id: string;
  payment_number: string;
  type: string;
  amount: number;
  payment_method: string;
  status: string;
  reference_id: string | null;
  notes: string | null;
  created_at: string;
  customer_id: string | null;
}

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", type: "pos", payment_method: "cash", status: "completed", reference_id: "", notes: "" });

  const fetchPayments = async () => {
    setLoading(true);
    let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.ilike("payment_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setPayments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, [search, statusFilter]);

  const todayTotal = payments.filter(p => p.status === "completed" && new Date(p.created_at).toDateString() === new Date().toDateString()).reduce((s, p) => s + p.amount, 0);
  const pendingTotal = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { toast.error("Enter valid amount"); return; }
    const { error } = await supabase.from("payments").insert({
      amount, type: form.type as any, payment_method: form.payment_method as any,
      status: form.status as any, reference_id: form.reference_id || null,
      notes: form.notes || null, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Payment recorded"); setSheetOpen(false); fetchPayments(); }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { completed: "bg-success/10 text-success", pending: "bg-warning/10 text-warning", failed: "bg-destructive/10 text-destructive", refunded: "bg-muted text-muted-foreground" };
    return <Badge className={map[s] || ""}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Track and manage payment records</p>
        </div>
        <Button onClick={() => { setForm({ amount: "", type: "pos", payment_method: "cash", status: "completed", reference_id: "", notes: "" }); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Record Payment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="p-2.5 rounded-xl bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div><div><p className="text-sm text-muted-foreground">Collected Today</p><p className="text-xl font-bold">₹{todayTotal.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="p-2.5 rounded-xl bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div><div><p className="text-sm text-muted-foreground">Pending</p><p className="text-xl font-bold">₹{pendingTotal.toLocaleString()}</p></div></CardContent></Card>
        <Card><CardContent className="p-5 flex items-center gap-4"><div className="p-2.5 rounded-xl bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Records</p><p className="text-xl font-bold">{payments.length}</p></div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search payment #..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : payments.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No payments found</TableCell></TableRow>
            ) : payments.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.payment_number}</TableCell>
                <TableCell className="capitalize">{p.type}</TableCell>
                <TableCell className="capitalize">{p.payment_method}</TableCell>
                <TableCell className="text-right font-medium">₹{p.amount.toLocaleString()}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Slide-over */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
            <SheetDescription>Enter payment details</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(p => ({ ...p, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reference ID</Label><Input value={form.reference_id} onChange={e => setForm(p => ({ ...p, reference_id: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave}>Save Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
