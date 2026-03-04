import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, FileText, Truck, CheckCircle2, Receipt, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Challan {
  id: string; challan_number: string; status: string; notes: string | null;
  invoice_id: string | null; created_at: string; customer_id: string | null;
  customers?: { name: string } | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success",
  invoiced: "bg-primary/10 text-primary",
};

export default function DeliveryChallans() {
  const navigate = useNavigate();
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchChallans = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("delivery_challans").select("*, customers(name)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setChallans((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchChallans(); }, []);

  const filtered = challans.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.challan_number.toLowerCase().includes(q) ||
      (c.customers as any)?.name?.toLowerCase().includes(q);
  });

  const stats = {
    total: challans.length,
    sent: challans.filter(c => c.status === "sent").length,
    delivered: challans.filter(c => c.status === "delivered").length,
    invoiced: challans.filter(c => c.status === "invoiced").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Challans</h1>
          <p className="text-muted-foreground">Track items sent before invoicing</p>
        </div>
        <Button onClick={() => navigate("/challans/new")}><Plus className="h-4 w-4 mr-2" />New Challan</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><Truck className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{stats.sent}</p><p className="text-xs text-muted-foreground">Sent</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{stats.delivered}</p><p className="text-xs text-muted-foreground">Delivered</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Receipt className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{stats.invoiced}</p><p className="text-xs text-muted-foreground">Invoiced</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search challans..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Challan #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-20">View</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No challans found</TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/challans/${c.id}`)}>
                  <TableCell className="font-medium font-mono">{c.challan_number}</TableCell>
                  <TableCell>{(c.customers as any)?.name || "—"}</TableCell>
                  <TableCell><Badge className={statusColors[c.status] || "bg-muted"}>{c.status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon"><ArrowUpRight className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
