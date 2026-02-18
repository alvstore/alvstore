import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, FileText, Receipt, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [cRes, qRes, iRes, pRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).single(),
        supabase.from("quotations").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
        supabase.from("payments").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
      ]);
      if (cRes.data) setCustomer(cRes.data);
      setQuotations(qRes.data || []);
      setInvoices(iRes.data || []);
      setPayments(pRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  if (!customer) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Customer not found</p></div>;
  }

  const initials = customer.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const totalPurchases = invoices.filter((i: any) => i.payment_status === "paid").reduce((s: number, i: any) => s + (i.total || 0), 0);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/customers")} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Customers
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contact Card - Left */}
        <div className="lg:col-span-4">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 text-center space-y-4">
              <Avatar className="h-20 w-20 mx-auto">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold text-foreground">{customer.name}</h2>
                <StatusBadge status="active" className="mt-1" />
              </div>

              <div className="space-y-3 text-left">
                {customer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</p>
                      <p className="text-sm text-foreground truncate">{customer.email}</p>
                    </div>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <Phone className="h-4 w-4 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone</p>
                      <p className="text-sm text-foreground">{customer.phone}</p>
                    </div>
                  </div>
                )}
                {(customer.address || customer.city) && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-warning" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Address</p>
                      <p className="text-sm text-foreground">{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                )}
                {customer.gst_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">GSTIN</p>
                      <p className="text-sm font-mono text-foreground">{customer.gst_number}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{quotations.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quotes</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{invoices.length}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">₹{totalPurchases.toLocaleString("en-IN")}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {customer.notes && (
            <Card className="shadow-sm border-border/50 mt-4">
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabbed Content - Right */}
        <div className="lg:col-span-8">
          <Tabs defaultValue="invoices">
            <TabsList>
              <TabsTrigger value="invoices" className="gap-1.5">
                <Receipt className="h-3.5 w-3.5" /> Invoices
              </TabsTrigger>
              <TabsTrigger value="quotations" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Quotations
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Payments
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="mt-4">
              <Card className="shadow-sm border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No invoices</TableCell></TableRow>
                    ) : invoices.map((inv: any) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30 border-border/50" onClick={() => navigate(`/invoices/${inv.id}`)}>
                        <TableCell className="font-semibold text-sm text-primary">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={inv.payment_status || "unpaid"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="quotations" className="mt-4">
              <Card className="shadow-sm border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">No quotations</TableCell></TableRow>
                    ) : quotations.map((q: any) => (
                      <TableRow key={q.id} className="cursor-pointer hover:bg-muted/30 border-border/50" onClick={() => navigate(`/sales/${q.id}`)}>
                        <TableCell className="font-semibold text-sm text-primary">{q.quotation_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={q.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Card className="shadow-sm border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Method</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No payments</TableCell></TableRow>
                    ) : payments.map((p: any) => (
                      <TableRow key={p.id} className="border-border/50">
                        <TableCell className="font-semibold text-sm text-primary">{p.payment_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell className="text-right font-semibold text-sm">₹{(p.amount || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{p.payment_method}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
