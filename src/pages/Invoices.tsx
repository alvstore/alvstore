import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Receipt, FileText, TrendingUp, AlertCircle, CheckCircle, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/StatusBadge";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  subtotal: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  discount_type: string | null;
  discount_value: number | null;
  gst_inclusive: boolean | null;
  public_token: string | null;
  signature_data: string | null;
  signature_name: string | null;
  quotation_id: string | null;
  customers?: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Payment sheet (kept for quick inline payments)
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase.from("invoices").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) query = query.ilike("invoice_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setInvoices((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [search, statusFilter]);

  const totalInvoices = invoices.length;
  const paidCount = invoices.filter(i => i.payment_status === "paid").length;
  const unpaidCount = invoices.filter(i => i.payment_status === "unpaid").length;
  const totalRevenue = invoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0);

  const openPayment = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(String((inv.total - inv.paid_amount).toFixed(2)));
    setPayMethod("cash");
    setPaySheetOpen(true);
  };

  const recordPayment = async () => {
    if (!payInvoice) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = payInvoice.paid_amount + amount;
    const paymentStatus = newPaid >= payInvoice.total ? "paid" : "partial";
    const status = paymentStatus === "paid" ? "paid" : payInvoice.status;
    const { error } = await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: paymentStatus, status }).eq("id", payInvoice.id);
    if (error) toast.error(error.message);
    else toast.success("Payment recorded");
    setPaySheetOpen(false);
    fetchInvoices();
  };

  const copyPublicLink = (token: string | null) => {
    if (!token) { toast.error("No public link available"); return; }
    navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${token}`);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Create and manage GST invoices</p>
        </div>
        <Button onClick={() => navigate("/invoices/new")}><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: totalInvoices, icon: FileText, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: "Paid", value: paidCount, icon: CheckCircle, bg: "bg-success/10", iconColor: "text-success" },
          { label: "Unpaid", value: unpaidCount, icon: AlertCircle, bg: "bg-destructive/10", iconColor: "text-destructive" },
          { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: "bg-accent/10", iconColor: "text-accent" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issued Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No invoices found</p>
              </TableCell></TableRow>
            ) : invoices.map(inv => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30 border-border/50 transition-colors" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <TableCell className="font-semibold text-sm text-primary">{inv.invoice_number}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-primary">
                        {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{inv.customers?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{inv.customers?.email || ""}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-sm text-foreground">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  {inv.payment_status === "paid" ? (
                    <StatusBadge status="paid" />
                  ) : (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-destructive">
                        ₹{((inv.total || 0) - (inv.paid_amount || 0)).toLocaleString("en-IN")}
                      </span>
                      {inv.paid_amount > 0 && (
                        <Progress value={(inv.paid_amount / (inv.total || 1)) * 100} className="h-1.5 w-20" />
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 items-center justify-end">
                    {inv.payment_status !== "paid" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs font-medium" onClick={() => openPayment(inv)}>Pay</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyPublicLink(inv.public_token)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/invoices/${inv.id}`)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Payment Sheet */}
      <Sheet open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
            <SheetDescription>
              {payInvoice?.invoice_number} — Balance: ₹{((payInvoice?.total || 0) - (payInvoice?.paid_amount || 0)).toFixed(2)}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "card", "upi", "online"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={recordPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
