import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Wrench, CreditCard, Check, X, Clock, Package,
  AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface CustomerRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function CustomerPortal() {
  const { user } = useAuth();
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Find customer record linked to this user
      const { data: cust } = await supabase
        .from("customers")
        .select("id, name, email, phone")
        .eq("user_id", user.id)
        .single();

      if (!cust) { setLoading(false); return; }
      setCustomer(cust);

      // Fetch all related data in parallel
      const [qRes, rRes, pRes] = await Promise.all([
        supabase.from("quotations").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }),
        supabase.from("repair_tickets").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }),
      ]);

      setQuotations(qRes.data || []);
      setRepairs(rRes.data || []);
      setPayments(pRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const respondQuotation = async (id: string, status: "accepted" | "rejected") => {
    const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Quotation ${status}`);
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      sent: "bg-info/10 text-info",
      accepted: "bg-success/10 text-success",
      rejected: "bg-destructive/10 text-destructive",
      pending: "bg-warning/10 text-warning",
      assigned: "bg-info/10 text-info",
      in_progress: "bg-primary/10 text-primary",
      waiting_parts: "bg-warning/10 text-warning",
      completed: "bg-success/10 text-success",
      delivered: "bg-success/10 text-success",
    };
    return map[s] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">No Customer Profile Linked</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your account hasn't been linked to a customer profile yet. Please contact the admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {customer.name}</h1>
        <p className="text-muted-foreground">View your quotations, repairs, and payments</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quotations.length}</p>
              <p className="text-xs text-muted-foreground">Quotations</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-warning/10">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{repairs.filter(r => r.status !== "delivered").length}</p>
              <p className="text-xs text-muted-foreground">Active Repairs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-success/10">
              <CreditCard className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">₹{payments.filter(p => p.status === "completed").reduce((s: number, p: any) => s + p.amount, 0).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Paid</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="quotations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quotations"><FileText className="h-4 w-4 mr-1.5" />Quotations</TabsTrigger>
          <TabsTrigger value="repairs"><Wrench className="h-4 w-4 mr-1.5" />Repairs</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations">
          <Card>
            <CardHeader>
              <CardTitle>Your Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No quotations found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.quotation_number}</TableCell>
                        <TableCell>{new Date(q.created_at).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>₹{q.total?.toLocaleString()}</TableCell>
                        <TableCell><Badge className={statusColor(q.status)}>{q.status}</Badge></TableCell>
                        <TableCell>
                          {(q.status === "sent" || q.status === "draft") && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => respondQuotation(q.id, "accepted")}>
                                <Check className="h-3 w-3 mr-1" />Accept
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => respondQuotation(q.id, "rejected")}>
                                <X className="h-3 w-3 mr-1" />Reject
                              </Button>
                            </div>
                          )}
                          {q.status === "accepted" && <Badge className="bg-success/10 text-success"><CheckCircle2 className="h-3 w-3 mr-1" />Accepted</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repairs">
          <Card>
            <CardHeader>
              <CardTitle>Your Repair Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {repairs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No repair tickets found.</p>
              ) : (
                <div className="space-y-4">
                  {repairs.map(r => (
                    <div key={r.id} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                      <div className="p-2 rounded-lg bg-muted">
                        <Wrench className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{r.ticket_number}</p>
                          <Badge className={statusColor(r.status)}>{r.status.replace("_", " ")}</Badge>
                          <Badge variant="outline" className="capitalize">{r.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{r.device_type} {r.device_brand} {r.device_model}</p>
                        {r.issue_description && <p className="text-sm mt-1">{r.issue_description}</p>}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Created: {new Date(r.created_at).toLocaleDateString("en-IN")}</span>
                          {r.estimated_cost && <span>Est. Cost: ₹{r.estimated_cost}</span>}
                          {r.final_cost && <span>Final Cost: ₹{r.final_cost}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Your Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No payments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.payment_number}</TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>₹{p.amount?.toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{p.payment_method}</TableCell>
                        <TableCell><Badge className={statusColor(p.status)}>{p.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
