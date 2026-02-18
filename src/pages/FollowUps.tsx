import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, Eye, CalendarPlus, Clock, FileText, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

interface PendingQuotation {
  id: string; quotation_number: string; total: number; status: string;
  created_at: string; customers: { name: string; phone: string | null } | null;
}

interface PendingRepair {
  id: string; job_number: string; status: string; problem_description: string;
  created_at: string; estimated_cost: number | null;
  customers: { name: string; phone: string | null } | null;
}

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<PendingQuotation[]>([]);
  const [repairs, setRepairs] = useState<PendingRepair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [qRes, rRes] = await Promise.all([
        supabase.from("quotations").select("id, quotation_number, total, status, created_at, customers(name, phone)")
          .in("status", ["draft", "sent"]).order("created_at", { ascending: false }).limit(50),
        supabase.from("job_sheets").select("id, job_number, status, problem_description, created_at, estimated_cost, customers(name, phone)")
          .not("status", "in", '("delivered","invoice_generated")').order("created_at", { ascending: false }).limit(50),
      ]);
      setQuotations((qRes.data as any[]) || []);
      setRepairs((rRes.data as any[]) || []);
      setLoading(false);
    };
    load();
  }, []);

  const scheduleCall = async (title: string, entityType: string, entityId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    await Promise.all([
      supabase.from("tasks").insert({
        title: `Follow-up: ${title}`, description: `Follow-up call for ${entityType}`,
        status: "todo", priority: "high", assigned_to: user?.id, assigned_by: user?.id,
        due_date: tomorrow.toISOString().split("T")[0],
        related_entity_type: entityType, related_entity_id: entityId,
      }),
      supabase.from("calendar_events").insert({
        title: `📞 Follow-up: ${title}`, category: "business",
        start_date: tomorrow.toISOString(), end_date: new Date(tomorrow.getTime() + 30 * 60000).toISOString(),
        created_by: user?.id,
      }),
    ]);
    toast.success("Follow-up scheduled — task + calendar event created");
  };

  const daysSince = (date: string) => differenceInDays(new Date(), new Date(date));

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground", sent: "bg-info/10 text-info",
      created: "bg-muted text-muted-foreground", pending_approval: "bg-warning/10 text-warning",
      approved: "bg-info/10 text-info", assigned: "bg-primary/10 text-primary",
      in_progress: "bg-primary/10 text-primary", waiting_parts: "bg-warning/10 text-warning",
      repair_completed: "bg-success/10 text-success", quality_check: "bg-accent/10 text-accent",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Follow-Ups</h1>
        <p className="text-muted-foreground">Track pending quotations and repairs that need attention</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><FileText className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{quotations.length}</p><p className="text-xs text-muted-foreground">Pending Quotations</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Wrench className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{repairs.length}</p><p className="text-xs text-muted-foreground">Active Repairs</p></div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="quotations">
        <TabsList>
          <TabsTrigger value="quotations"><FileText className="h-4 w-4 mr-1.5" />Quotations ({quotations.length})</TabsTrigger>
          <TabsTrigger value="repairs"><Wrench className="h-4 w-4 mr-1.5" />Repairs ({repairs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="mt-4">
          {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation</TableHead><TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
                    <TableHead>Age</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No pending quotations 🎉</TableCell></TableRow>
                  ) : quotations.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium">{q.quotation_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{q.customers?.name || "—"}</p>
                          {q.customers?.phone && <p className="text-xs text-muted-foreground">{q.customers.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge className={statusColor(q.status)}>{q.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={daysSince(q.created_at) > 7 ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {daysSince(q.created_at)}d ago
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/sales/${q.id}`)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => scheduleCall(q.quotation_number, "quotation", q.id)} title="Schedule Call">
                            <CalendarPlus className="h-3.5 w-3.5" />
                          </Button>
                          {q.customers?.phone && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => window.open(`tel:${q.customers!.phone}`)} title="Call">
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="repairs" className="mt-4">
          {loading ? <p className="text-center text-muted-foreground py-8">Loading...</p> : (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead><TableHead>Customer</TableHead>
                    <TableHead>Problem</TableHead><TableHead>Status</TableHead>
                    <TableHead>Age</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repairs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No active repairs 🎉</TableCell></TableRow>
                  ) : repairs.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.job_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{r.customers?.name || "—"}</p>
                          {r.customers?.phone && <p className="text-xs text-muted-foreground">{r.customers.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{r.problem_description}</TableCell>
                      <TableCell><Badge className={statusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={daysSince(r.created_at) > 7 ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {daysSince(r.created_at)}d ago
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/repairs/${r.id}`)} title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => scheduleCall(r.job_number, "job_sheet", r.id)} title="Schedule Call">
                            <CalendarPlus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
