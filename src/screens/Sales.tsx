import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ShoppingCart, Copy, Eye, FileText, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/StatusBadge";

interface Quotation {
  id: string;
  quotation_number: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  public_token: string;
  customer_id: string | null;
  created_at: string;
  discount_type: string | null;
  discount_value: number | null;
  gst_inclusive: boolean | null;
  view_count: number | null;
  converted_invoice_id: string | null;
  signature_data: string | null;
  signature_name: string | null;
  customers?: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

export default function Sales() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchQuotations = async () => {
    setLoading(true);
    let query = supabase.from("quotations").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.ilike("quotation_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setQuotations((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuotations(); }, [search, statusFilter]);

  const totalQuotations = quotations.length;
  const acceptedCount = quotations.filter(q => q.status === "accepted").length;
  const pendingCount = quotations.filter(q => q.status === "sent" || q.status === "draft").length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.total || 0), 0);

  const copyPublicLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/sales/public/${token}`);
    toast.success("Link copied");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales & Quotations</h1>
          <p className="text-sm text-muted-foreground">Create, manage and convert quotations</p>
        </div>
        <Button onClick={() => navigate("/sales/new")}><Plus className="h-4 w-4 mr-2" /> New Quotation</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Quotations", value: totalQuotations, icon: FileText, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: "Accepted", value: acceptedCount, icon: CheckCircle, bg: "bg-success/10", iconColor: "text-success" },
          { label: "Pending", value: pendingCount, icon: Clock, bg: "bg-warning/10", iconColor: "text-warning" },
          { label: "Total Value", value: `₹${totalValue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: "bg-accent/10", iconColor: "text-accent" },
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
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quotations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issued Date</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Views</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : quotations.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No quotations found</p>
              </TableCell></TableRow>
            ) : quotations.map(q => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/30 border-border/50 transition-colors" onClick={() => navigate(`/sales/${q.id}`)}>
                <TableCell className="font-semibold text-sm text-primary">{q.quotation_number}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-primary">
                        {(q.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{q.customers?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{q.customers?.email || ""}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
                <TableCell className="text-right font-semibold text-sm text-foreground">₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{q.view_count || 0}</span>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 items-center justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyPublicLink(q.public_token)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild title="View">
                      <a href={`/sales/public/${q.public_token}`} target="_blank"><Eye className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
