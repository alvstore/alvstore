import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  FileText, Plus, Search, Download, Filter,
  CreditCard, AlertTriangle, CheckCircle2, Clock, Banknote,
  Upload, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

type PaymentRegisterRow = {
  id: string;
  register_number: string;
  transaction_date: string;
  customer_name: string;
  customer_id: string | null;
  invoice_number: string | null;
  invoice_id: string | null;
  invoice_amount: number;
  payment_mode: string;
  bank_name: string | null;
  card_type: string | null;
  transaction_reference: string | null;
  cheque_number: string | null;
  cheque_deposit_date: string | null;
  cheque_clearance_date: string | null;
  received_amount: number;
  bank_charges: number;
  net_received_amount: number;
  difference_amount: number;
  difference_type: string;
  status: string;
  notes: string | null;
  document_url: string | null;
  created_by: string | null;
  created_at: string;
};

const emptyForm = {
  transaction_date: format(new Date(), "yyyy-MM-dd"),
  customer_name: "",
  customer_id: "",
  invoice_number: "",
  invoice_id: "",
  invoice_amount: 0,
  payment_mode: "card",
  bank_name: "",
  card_type: "debit",
  transaction_reference: "",
  cheque_number: "",
  cheque_deposit_date: "",
  cheque_clearance_date: "",
  received_amount: 0,
  bank_charges: 0,
  status: "pending",
  notes: "",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  deposited: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  cleared: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  reconciled: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
};

const diffColors: Record<string, string> = {
  none: "text-emerald-600 dark:text-emerald-400",
  short: "text-destructive",
  excess: "text-orange-600 dark:text-orange-400",
};

const paymentModes = [
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

const statusOptions = ["pending", "deposited", "cleared", "reconciled", "failed"];

export default function PaymentRegister() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PaymentRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; total: number }[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from("payment_register")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setEntries(data as unknown as PaymentRegisterRow[]);
    setLoading(false);
  };

  const fetchLookups = async () => {
    const [cRes, iRes] = await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("invoices").select("id, invoice_number, total").order("created_at", { ascending: false }).limit(200),
    ]);
    if (cRes.data) setCustomers(cRes.data);
    if (iRes.data) setInvoices(iRes.data as { id: string; invoice_number: string; total: number }[]);
  };

  useEffect(() => {
    fetchEntries();
    fetchLookups();
  }, []);

  // KPIs
  const kpis = useMemo(() => {
    const total = entries.length;
    const pending = entries.filter((e) => e.status === "pending" || e.status === "deposited").length;
    const charges = entries.reduce((s, e) => s + (e.bank_charges || 0), 0);
    const mismatch = entries.filter((e) => e.difference_type !== "none").reduce((s, e) => s + Math.abs(e.difference_amount || 0), 0);
    const reconciled = entries.filter((e) => e.status === "reconciled").length;
    return { total, pending, charges, mismatch, reconciled };
  }, [entries]);

  // Filter
  const filtered = useMemo(() => {
    let list = entries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.customer_name?.toLowerCase().includes(q) ||
          e.invoice_number?.toLowerCase().includes(q) ||
          e.transaction_reference?.toLowerCase().includes(q) ||
          e.register_number?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") list = list.filter((e) => e.status === filterStatus);
    if (filterMode !== "all") list = list.filter((e) => e.payment_mode === filterMode);
    return list;
  }, [entries, search, filterStatus, filterMode]);

  // Live calc
  const netReceived = (form.received_amount || 0) - (form.bank_charges || 0);
  const diffAmount = (form.invoice_amount || 0) - netReceived;
  const diffType = diffAmount > 0.01 ? "short" : diffAmount < -0.01 ? "excess" : "none";

  const handleSave = async () => {
    if (!form.customer_name.trim()) return toast.error("Customer name is required");
    setSaving(true);

    let documentUrl: string | null = null;
    if (docFile) {
      const ext = docFile.name.split(".").pop();
      const path = `payment-register/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, docFile);
      if (upErr) {
        toast.error("Upload failed");
        setSaving(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
      documentUrl = urlData.publicUrl;
    }

    const payload: Record<string, unknown> = {
      transaction_date: form.transaction_date,
      customer_name: form.customer_name,
      customer_id: form.customer_id || null,
      invoice_number: form.invoice_number || null,
      invoice_id: form.invoice_id || null,
      invoice_amount: form.invoice_amount,
      payment_mode: form.payment_mode,
      bank_name: form.bank_name || null,
      card_type: form.payment_mode === "card" ? form.card_type : null,
      transaction_reference: form.transaction_reference || null,
      cheque_number: form.payment_mode === "cheque" ? form.cheque_number : null,
      cheque_deposit_date: form.payment_mode === "cheque" && form.cheque_deposit_date ? form.cheque_deposit_date : null,
      cheque_clearance_date: form.payment_mode === "cheque" && form.cheque_clearance_date ? form.cheque_clearance_date : null,
      received_amount: form.received_amount,
      bank_charges: form.bank_charges,
      status: form.status,
      notes: form.notes || null,
      ...(documentUrl && { document_url: documentUrl }),
      ...(!editId && { created_by: user?.id }),
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("payment_register").update(payload as any).eq("id", editId));
    } else {
      ({ error } = await supabase.from("payment_register").insert(payload as any));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editId ? "Entry updated" : "Entry created");
      setSheetOpen(false);
      setForm(emptyForm);
      setDocFile(null);
      setEditId(null);
      fetchEntries();
    }
    setSaving(false);
  };

  const openEdit = (row: PaymentRegisterRow) => {
    setEditId(row.id);
    setForm({
      transaction_date: row.transaction_date,
      customer_name: row.customer_name,
      customer_id: row.customer_id || "",
      invoice_number: row.invoice_number || "",
      invoice_id: row.invoice_id || "",
      invoice_amount: row.invoice_amount,
      payment_mode: row.payment_mode,
      bank_name: row.bank_name || "",
      card_type: row.card_type || "debit",
      transaction_reference: row.transaction_reference || "",
      cheque_number: row.cheque_number || "",
      cheque_deposit_date: row.cheque_deposit_date || "",
      cheque_clearance_date: row.cheque_clearance_date || "",
      received_amount: row.received_amount,
      bank_charges: row.bank_charges,
      status: row.status,
      notes: row.notes || "",
    });
    setDocFile(null);
    setSheetOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setDocFile(null);
    setSheetOpen(true);
  };

  const exportCSV = () => {
    const headers = ["Date", "Register#", "Customer", "Invoice", "Mode", "Bank", "Reference", "Invoice Amt", "Received", "Charges", "Net Received", "Difference", "Type", "Status"];
    const rows = filtered.map((e) => [
      e.transaction_date, e.register_number, e.customer_name, e.invoice_number || "",
      e.payment_mode, e.bank_name || "", e.transaction_reference || "",
      e.invoice_amount, e.received_amount, e.bank_charges, e.net_received_amount,
      e.difference_amount, e.difference_type, e.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-register-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (inv) {
      setForm((f) => ({ ...f, invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_amount: inv.total || 0 }));
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (cust) {
      setForm((f) => ({ ...f, customer_id: cust.id, customer_name: cust.name }));
    }
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment Register</h1>
          <p className="text-muted-foreground text-sm">Reconciliation & audit register for card, cheque, and bank payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Entry</Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editId ? "Edit Entry" : "New Register Entry"}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 mt-6">
                {/* Basic */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Customer</Label>
                    <Select value={form.customer_id} onValueChange={handleCustomerSelect}>
                      <SelectTrigger><SelectValue placeholder="Select or type below" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="mt-1" placeholder="Or type customer name" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Invoice</Label>
                    <Select value={form.invoice_id} onValueChange={handleInvoiceSelect}>
                      <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                      <SelectContent>
                        {invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {fmt(i.total || 0)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="mt-1" placeholder="Or type invoice number" value={form.invoice_number} onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Payment Details</h3>
                  <div>
                    <Label>Payment Mode</Label>
                    <Select value={form.payment_mode} onValueChange={(v) => setForm((f) => ({ ...f, payment_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentModes.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Invoice Amount</Label>
                      <Input type="number" value={form.invoice_amount} onChange={(e) => setForm((f) => ({ ...f, invoice_amount: +e.target.value }))} />
                    </div>
                    <div>
                      <Label>Received Amount</Label>
                      <Input type="number" value={form.received_amount} onChange={(e) => setForm((f) => ({ ...f, received_amount: +e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Bank Charges</Label>
                    <Input type="number" value={form.bank_charges} onChange={(e) => setForm((f) => ({ ...f, bank_charges: +e.target.value }))} />
                  </div>
                  {/* Live calc */}
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Net Received</span><span className="font-semibold">{fmt(netReceived)}</span></div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Difference</span>
                      <span className={`font-semibold ${diffColors[diffType]}`}>
                        {fmt(Math.abs(diffAmount))} {diffType !== "none" && `(${diffType})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bank / Card */}
                {(form.payment_mode === "card" || form.payment_mode === "bank_transfer" || form.payment_mode === "upi") && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Bank Details</h3>
                    <div>
                      <Label>Bank Name</Label>
                      <Input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
                    </div>
                    {form.payment_mode === "card" && (
                      <div>
                        <Label>Card Type</Label>
                        <Select value={form.card_type} onValueChange={(v) => setForm((f) => ({ ...f, card_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debit">Debit</SelectItem>
                            <SelectItem value="credit">Credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Transaction Reference</Label>
                      <Input value={form.transaction_reference} onChange={(e) => setForm((f) => ({ ...f, transaction_reference: e.target.value }))} />
                    </div>
                  </div>
                )}

                {/* Cheque */}
                {form.payment_mode === "cheque" && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cheque Details</h3>
                    <div>
                      <Label>Bank Name</Label>
                      <Input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Cheque Number</Label>
                      <Input value={form.cheque_number} onChange={(e) => setForm((f) => ({ ...f, cheque_number: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Transaction Reference</Label>
                      <Input value={form.transaction_reference} onChange={(e) => setForm((f) => ({ ...f, transaction_reference: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Deposit Date</Label>
                        <Input type="date" value={form.cheque_deposit_date} onChange={(e) => setForm((f) => ({ ...f, cheque_deposit_date: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Clearance Date</Label>
                        <Input type="date" value={form.cheque_clearance_date} onChange={(e) => setForm((f) => ({ ...f, cheque_clearance_date: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Reconciliation */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Reconciliation</h3>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
                  </div>
                </div>

                {/* Document */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Document Upload</h3>
                  <div className="border-2 border-dashed rounded-xl p-4 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      id="doc-upload"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      <Upload className="h-8 w-8" />
                      <span className="text-sm">{docFile ? docFile.name : "Upload slip, photo or PDF"}</span>
                    </label>
                  </div>
                </div>

                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : editId ? "Update Entry" : "Create Entry"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Entries", value: kpis.total, icon: FileText, color: "text-primary" },
          { label: "Pending Clearance", value: kpis.pending, icon: Clock, color: "text-yellow-600" },
          { label: "Total Charges", value: fmt(kpis.charges), icon: Banknote, color: "text-orange-600" },
          { label: "Mismatch Amount", value: fmt(kpis.mismatch), icon: AlertTriangle, color: "text-destructive" },
          { label: "Reconciled", value: kpis.reconciled, icon: CheckCircle2, color: "text-emerald-600" },
        ].map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl shadow-sm border-0 bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`rounded-xl bg-muted/50 p-2 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search customer, invoice, reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMode} onValueChange={setFilterMode}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            {paymentModes.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="rounded-2xl shadow-sm border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Reg #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Invoice Amt</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Charges</TableHead>
                <TableHead className="text-right">Net Received</TableHead>
                <TableHead className="text-right">Difference</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={13} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center py-12 text-muted-foreground">No entries found</TableCell></TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow
                    key={e.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openEdit(e)}
                  >
                    <TableCell className="whitespace-nowrap text-sm">{e.transaction_date}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{e.register_number}</TableCell>
                    <TableCell className="font-medium text-sm">{e.customer_name}</TableCell>
                    <TableCell className="text-sm">{e.invoice_number || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{e.payment_mode.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{e.bank_name || "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{e.transaction_reference || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(e.invoice_amount)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(e.received_amount)}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(e.bank_charges)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(e.net_received_amount)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${diffColors[e.difference_type] || ""}`}>
                      {fmt(Math.abs(e.difference_amount))}
                      {e.difference_type !== "none" && (
                        <span className="text-[10px] ml-1 uppercase">({e.difference_type})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] capitalize ${statusColors[e.status] || ""}`} variant="secondary">
                        {e.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
