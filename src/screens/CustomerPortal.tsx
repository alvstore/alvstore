"use client";

import { Alert, Box, Button, Card, CardContent, Tab, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatCard, StatusChip, TabBar, TabPanel, TabView, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Wrench, CreditCard, Check, X, AlertCircle, CheckCircle2, Loader2, Eye, } from "lucide-react";
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
    const [jobSheets, setJobSheets] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [retry, setRetry] = useState(0);
    const userId = user?.id;
    useEffect(() => {
        if (!userId) return;
        let active = true;
        const load = async () => {
            setLoading(true); setLoadError("");
            try {
                const { data: cust, error } = await supabase.from("customers")
                    .select("id, name, email, phone").eq("user_id", userId).maybeSingle();
                if (error) throw new Error(error.message);
                if (!active) return;
                setCustomer(cust);
                // An unlinked staff/admin account is a valid empty state, not a 406.
                if (!cust) return;
                const results = await Promise.all([
                    supabase.from("quotations").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }),
                    supabase.from("job_sheets").select("id, job_number, device_brand, device_model, status, priority, estimated_cost, final_cost, total_amount, payment_status, problem_description, created_at, public_token").eq("customer_id", cust.id).order("created_at", { ascending: false }),
                    supabase.from("payments").select("*").eq("customer_id", cust.id).order("created_at", { ascending: false }),
                ]);
                for (const result of results) if (result.error) throw new Error(result.error.message);
                if (!active) return;
                setQuotations(results[0].data ?? []);
                setJobSheets(results[1].data ?? []);
                setPayments(results[2].data ?? []);
            } catch (error) {
                if (active) setLoadError(error instanceof Error ? error.message : "Your records could not be loaded.");
            } finally { if (active) setLoading(false); }
        };
        void load();
        return () => { active = false; };
    }, [userId, retry]);
    const respondQuotation = async (id: string, status: "accepted" | "rejected") => {
        const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success(`Quotation ${status}`);
            setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
        }
    };
    const statusColor = (s: string) => {
        const map = {
            draft: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
            sent: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
            accepted: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
            rejected: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
            pending: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
            created: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
            pending_approval: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
            approved: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
            assigned: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
            in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
            waiting_parts: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
            repair_completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
            quality_check: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
            invoice_generated: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
            completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
            delivered: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
        };
        return map[s] || { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
    };
    if (loading) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "5rem", paddingBottom: "5rem" }}>
        <Box component={Loader2} sx={{ height: "2rem", width: "2rem", animation: "spin 1s linear infinite", color: "hsl(var(--primary))" }}/>
      </Box></AnimatedPage>;
    }
    if (loadError) {
        return <AnimatedPage><Alert severity="error" action={<Button color="inherit" size="small" onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{loadError}</Alert></AnimatedPage>;
    }
    if (!customer) {
        return <AnimatedPage><Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "5rem", paddingBottom: "5rem", textAlign: "center", gap: "1rem" }}>
        <Box component={AlertCircle} sx={{ height: "3rem", width: "3rem", color: "hsl(var(--muted-foreground))" }}/>
        <Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600" }}>No Customer Profile Linked</Typography>
          <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.25rem" }}>
            Your account hasn't been linked to a customer profile yet. Please contact the admin.
          </Typography>
        </Box>
      </Box></AnimatedPage>;
    }
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={<>Welcome, {customer.name}</>} subtitle={"View your quotations, repairs, and payments"}/>

      {/* Quick Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Quotations"} value={quotations.length} icon={<Box component={FileText} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Active Repairs"} value={jobSheets.filter(r => !["delivered", "rejected"].includes(r.status)).length} icon={<Box component={Wrench} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Total Paid"} value={payments.filter(p => p.status === "completed").reduce((s: number, p: any) => s + p.amount, 0)} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={CreditCard} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
      </Box>

      <TabView defaultValue="quotations" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
        <TabBar>
          <Tab value="quotations" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={FileText} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Quotations</Box>}/>
          <Tab value="repairs" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Wrench} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Repairs</Box>}/>
          <Tab value="payments" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={CreditCard} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Payments</Box>}/>
        </TabBar>

        <TabPanel value="quotations">
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Your Quotations</Typography></Box>
            <CardContent>
              {quotations.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", paddingTop: "1.5rem", paddingBottom: "1.5rem", textAlign: "center" }}>No quotations found.</Typography>) : (<DataTable columnsCount={5}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Number</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {quotations.map(q => (<TableRow key={q.id}>
                        <TableCell sx={{ fontWeight: "500" }}>{q.quotation_number}</TableCell>
                        <TableCell>{new Date(q.created_at).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>₹{q.total?.toLocaleString()}</TableCell>
                        <TableCell><StatusChip label={q.status} sx={statusColor(q.status)}/></TableCell>
                        <TableCell>
                          {(q.status === "sent" || q.status === "draft") && (<Box sx={{ display: "flex", gap: "0.5rem" }}>
                              <Button onClick={() => respondQuotation(q.id, "accepted")} variant="outlined" size="small">
                                <Box component={Check} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Accept
                              </Button>
                              <Button onClick={() => respondQuotation(q.id, "rejected")} variant="text" size="small">
                                <Box component={X} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Reject
                              </Button>
                            </Box>)}
                          {q.status === "accepted" && <StatusChip label={<><Box component={CheckCircle2} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Accepted</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/>}
                        </TableCell>
                      </TableRow>))}
                  </TableBody>
                </DataTable>)}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="repairs">
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Your Repairs</Typography></Box>
            <CardContent>
              {jobSheets.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", paddingTop: "1.5rem", paddingBottom: "1.5rem", textAlign: "center" }}>No repairs found.</Typography>) : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  {jobSheets.map(r => (<Box key={r.id} sx={{ display: "flex", alignItems: "flex-start", gap: "1rem", padding: "1rem", borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
                      <Box sx={{ padding: "0.5rem", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--muted))" }}>
                        <Box component={Wrench} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--muted-foreground))" }}/>
                      </Box>
                      <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{r.job_number}</Typography>
                          <StatusChip label={r.status.replace(/_/g, " ")} sx={statusColor(r.status)}/>
                          <StatusChip label={r.priority} variant="outlined" sx={{ textTransform: "capitalize" }}/>
                          {r.payment_status && (<StatusChip label={r.payment_status} sx={statusColor(r.payment_status === "paid" ? "completed" : r.payment_status === "partial" ? "pending" : "rejected")}/>)}
                        </Box>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{r.device_brand} {r.device_model || ""}</Typography>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.25rem" }}>{r.problem_description}</Typography>
                        <Box sx={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", flexWrap: "wrap" }}>
                          <Box component="span">Created: {new Date(r.created_at).toLocaleDateString("en-IN")}</Box>
                          {r.total_amount ? (<Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>Total: ₹{Number(r.total_amount).toLocaleString()}</Box>) : r.estimated_cost ? (<Box component="span">Est. Cost: ₹{r.estimated_cost}</Box>) : null}
                        </Box>
                      </Box>
                      {r.public_token && (<Button onClick={() => window.open(`/job/public/${r.public_token}`, "_blank")} variant="outlined" size="small">
                          <Box component={Eye} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.25rem" }}/>View
                        </Button>)}
                    </Box>))}
                </Box>)}
            </CardContent>
          </Card>
        </TabPanel>

        <TabPanel value="payments">
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Your Payments</Typography></Box>
            <CardContent>
              {payments.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", paddingTop: "1.5rem", paddingBottom: "1.5rem", textAlign: "center" }}>No payments found.</Typography>) : (<DataTable columnsCount={5}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Payment #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map(p => (<TableRow key={p.id}>
                        <TableCell sx={{ fontWeight: "500" }}>{p.payment_number}</TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>₹{p.amount?.toLocaleString()}</TableCell>
                        <TableCell sx={{ textTransform: "capitalize" }}>{p.payment_method}</TableCell>
                        <TableCell><StatusChip label={p.status} sx={statusColor(p.status)}/></TableCell>
                      </TableRow>))}
                  </TableBody>
                </DataTable>)}
            </CardContent>
          </Card>
        </TabPanel>
      </TabView>
    </Box></AnimatedPage>;
}
