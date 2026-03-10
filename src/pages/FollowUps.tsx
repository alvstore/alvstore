import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone, Eye, CalendarPlus, Clock, FileText, Wrench,
  MessageSquarePlus, CheckCircle2, XCircle, PhoneCall,
  ArrowUpRight, TrendingUp, AlertTriangle, CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface PendingQuotation {
  id: string; quotation_number: string; total: number; status: string;
  created_at: string; customers: { name: string; phone: string | null } | null;
}

interface PendingRepair {
  id: string; job_number: string; status: string; problem_description: string;
  created_at: string; estimated_cost: number | null;
  customers: { name: string; phone: string | null } | null;
}

interface FollowUpNote {
  id: string; entity_type: string; entity_id: string; note: string;
  outcome: string | null; next_follow_up_date: string | null; created_at: string;
}

const OUTCOMES = [
  { value: "interested", label: "Interested", icon: TrendingUp, color: "text-success" },
  { value: "callback", label: "Callback Later", icon: PhoneCall, color: "text-info" },
  { value: "no_answer", label: "No Answer", icon: Phone, color: "text-warning" },
  { value: "not_interested", label: "Not Interested", icon: XCircle, color: "text-destructive" },
  { value: "converted", label: "Converted", icon: CheckCircle2, color: "text-success" },
];

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<PendingQuotation[]>([]);
  const [repairs, setRepairs] = useState<PendingRepair[]>([]);
  const [loading, setLoading] = useState(true);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string; label: string; customer: string; phone: string | null } | null>(null);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<FollowUpNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // KPI state
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [totalConverted, setTotalConverted] = useState(0);

  useEffect(() => { load(); }, []);

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

    // KPI counts
    const today = new Date().toISOString().split("T")[0];
    const [completedRes, convertedRes] = await Promise.all([
      supabase.from("follow_up_notes").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("follow_up_notes").select("id", { count: "exact", head: true }).eq("outcome", "converted"),
    ]);
    setTodayCompleted(completedRes.count ?? 0);
    setTotalConverted(convertedRes.count ?? 0);
    setLoading(false);
  };

  const openRecordSheet = async (type: string, id: string, label: string, customer: string, phone: string | null) => {
    setSelectedEntity({ type, id, label, customer, phone });
    setOutcome("");
    setNote("");
    setNextDate(undefined);
    setSheetOpen(true);
    setHistoryLoading(true);
    const { data } = await supabase.from("follow_up_notes")
      .select("*").eq("entity_type", type).eq("entity_id", id)
      .order("created_at", { ascending: false });
    setHistory((data as FollowUpNote[]) || []);
    setHistoryLoading(false);
  };

  const saveFollowUp = async () => {
    if (!selectedEntity || !note.trim()) { toast.error("Please add a note"); return; }
    setSaving(true);
    const { error } = await supabase.from("follow_up_notes").insert({
      entity_type: selectedEntity.type,
      entity_id: selectedEntity.id,
      note: note.trim(),
      outcome: outcome || null,
      next_follow_up_date: nextDate ? format(nextDate, "yyyy-MM-dd") : null,
      created_by: user?.id,
    });
    if (error) { toast.error("Failed to save"); setSaving(false); return; }

    // Create calendar event if next date set
    if (nextDate && user?.id) {
      const startDate = new Date(nextDate);
      startDate.setHours(10, 0, 0, 0);
      await supabase.from("calendar_events").insert({
        title: `📞 Follow-up: ${selectedEntity.label}`,
        category: "business",
        start_date: startDate.toISOString(),
        end_date: new Date(startDate.getTime() + 30 * 60000).toISOString(),
        created_by: user.id,
      });
    }

    toast.success("Follow-up recorded");
    setSaving(false);
    setSheetOpen(false);
    load();
  };

  const daysSince = (date: string) => differenceInDays(new Date(), new Date(date));

  const urgencyBadge = (days: number) => {
    if (days <= 3) return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">{days}d</span>;
    if (days <= 7) return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning/10 text-warning">{days}d</span>;
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{days}d</span>;
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground", sent: "bg-info/10 text-info",
      created: "bg-muted text-muted-foreground", pending_approval: "bg-warning/10 text-warning",
      approved: "bg-info/10 text-info", assigned: "bg-primary/10 text-primary",
      in_progress: "bg-primary/10 text-primary", waiting_parts: "bg-warning/10 text-warning",
      repair_completed: "bg-success/10 text-success", quality_check: "bg-accent/10 text-accent-foreground",
    };
    return map[status] || "bg-muted text-muted-foreground";
  };

  const overdueCount = [...quotations, ...repairs].filter(
    (item: any) => daysSince(item.created_at) > 7
  ).length;

  const totalDue = quotations.length + repairs.length;
  const conversionRate = totalDue > 0 ? Math.round((totalConverted / Math.max(totalDue, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Follow-Ups</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and record follow-up interactions</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-info/10 flex items-center justify-center"><FileText className="h-5 w-5 text-info" /></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">Total Due</p>
            <p className="text-2xl font-bold text-foreground mt-1">{loading ? "—" : totalDue}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-destructive/5 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">Overdue (&gt;7d)</p>
            <p className="text-2xl font-bold text-foreground mt-1">{loading ? "—" : overdueCount}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-success/5 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-success/10 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">Completed Today</p>
            <p className="text-2xl font-bold text-foreground mt-1">{loading ? "—" : todayCompleted}</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3">Conversion Rate</p>
            <p className="text-2xl font-bold text-foreground mt-1">{loading ? "—" : `${conversionRate}%`}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="quotations">
        <TabsList>
          <TabsTrigger value="quotations"><FileText className="h-4 w-4 mr-1.5" />Quotations ({quotations.length})</TabsTrigger>
          <TabsTrigger value="repairs"><Wrench className="h-4 w-4 mr-1.5" />Repairs ({repairs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="mt-4">
          {loading ? <Skeleton className="h-[300px] w-full rounded-xl" /> : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
                    <TableRow key={q.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{q.quotation_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{q.customers?.name || "—"}</p>
                          {q.customers?.phone && <p className="text-xs text-muted-foreground">{q.customers.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge className={statusColor(q.status)}>{q.status}</Badge></TableCell>
                      <TableCell>{urgencyBadge(daysSince(q.created_at))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/sales/${q.id}`)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => openRecordSheet("quotation", q.id, q.quotation_number, q.customers?.name || "Unknown", q.customers?.phone || null)} title="Record Follow-Up">
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                          </Button>
                          {q.customers?.phone && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => window.open(`tel:${q.customers!.phone}`)} title="Call"><Phone className="h-3.5 w-3.5" /></Button>
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
          {loading ? <Skeleton className="h-[300px] w-full rounded-xl" /> : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
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
                    <TableRow key={r.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{r.job_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{r.customers?.name || "—"}</p>
                          {r.customers?.phone && <p className="text-xs text-muted-foreground">{r.customers.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{r.problem_description}</TableCell>
                      <TableCell><Badge className={statusColor(r.status)}>{r.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{urgencyBadge(daysSince(r.created_at))}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/repairs/${r.id}`)} title="View"><Eye className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => openRecordSheet("job_sheet", r.id, r.job_number, r.customers?.name || "Unknown", r.customers?.phone || null)} title="Record Follow-Up">
                            <MessageSquarePlus className="h-3.5 w-3.5" />
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

      {/* Follow-Up Recording Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">Record Follow-Up</SheetTitle>
          </SheetHeader>

          {selectedEntity && (
            <div className="mt-6 space-y-6">
              {/* Entity info header */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <p className="text-sm font-semibold text-foreground">{selectedEntity.customer}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedEntity.type === "quotation" ? "Quotation" : "Job Sheet"}: {selectedEntity.label}</p>
                {selectedEntity.phone && (
                  <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs text-success" onClick={() => window.open(`tel:${selectedEntity.phone}`)}>
                    <Phone className="h-3 w-3 mr-1" />Call {selectedEntity.phone}
                  </Button>
                )}
              </div>

              {/* Outcome selector */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Outcome</Label>
                <RadioGroup value={outcome} onValueChange={setOutcome} className="grid grid-cols-1 gap-2">
                  {OUTCOMES.map(o => (
                    <Label
                      key={o.value}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer transition-all hover:bg-muted/50",
                        outcome === o.value && "border-primary bg-primary/5"
                      )}
                    >
                      <RadioGroupItem value={o.value} />
                      <o.icon className={cn("h-4 w-4", o.color)} />
                      <span className="text-sm font-medium">{o.label}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Notes</Label>
                <Textarea
                  placeholder="What was discussed? Any key takeaways..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="min-h-[100px] rounded-xl"
                />
              </div>

              {/* Next follow-up date */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Next Follow-Up Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-xl", !nextDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nextDate ? format(nextDate, "PPP") : "Pick a date (optional)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={nextDate}
                      onSelect={setNextDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Save */}
              <Button onClick={saveFollowUp} disabled={saving} className="w-full rounded-xl">
                {saving ? "Saving..." : "Save Follow-Up"}
              </Button>

              {/* History Timeline */}
              {historyLoading ? (
                <div className="space-y-3"><Skeleton className="h-16 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" /></div>
              ) : history.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Previous Follow-Ups</p>
                  <div className="relative pl-6 space-y-4">
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                    {history.map(h => {
                      const outcomeData = OUTCOMES.find(o => o.value === h.outcome);
                      return (
                        <div key={h.id} className="relative">
                          <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full bg-muted border-2 border-border" />
                          <div className="p-3 rounded-xl bg-muted/30 border border-border">
                            <div className="flex items-center justify-between mb-1">
                              {outcomeData && (
                                <span className={cn("text-[11px] font-medium flex items-center gap-1", outcomeData.color)}>
                                  <outcomeData.icon className="h-3 w-3" />{outcomeData.label}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground">{format(new Date(h.created_at), "dd MMM yyyy, HH:mm")}</span>
                            </div>
                            <p className="text-sm text-foreground">{h.note}</p>
                            {h.next_follow_up_date && (
                              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                <CalendarIcon className="h-3 w-3" />Next: {format(new Date(h.next_follow_up_date), "dd MMM yyyy")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
