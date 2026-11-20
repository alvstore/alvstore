"use client";

import { Avatar, Box, Button, Card, CardContent, Chip, Tab, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, DataTable, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ArrowLeft, Mail, Phone, MapPin, Building2, User, FileText, Receipt, CreditCard, Wrench, Plus, Star } from "lucide-react";
import { parseCustomerMetadata } from "@/components/customers/CustomerQuickDialog";
export default function CustomerProfile() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState<any>(null);
    const [quotations, setQuotations] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [jobSheets, setJobSheets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!id)
            return;
        const load = async () => {
            setLoading(true);
            const [cRes, qRes, iRes, pRes, jRes] = await Promise.all([
                supabase.from("customers").select("*").eq("id", id).single(),
                supabase.from("quotations").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
                supabase.from("invoices").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
                supabase.from("payments").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
                supabase.from("job_sheets").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
            ]);
            if (cRes.data)
                setCustomer(cRes.data);
            setQuotations(qRes.data || []);
            setInvoices(iRes.data || []);
            setPayments(pRes.data || []);
            setJobSheets(jRes.data || []);
            setLoading(false);
        };
        load();
    }, [id]);
    if (loading) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Loading...</Typography></Box></AnimatedPage>;
    }
    if (!customer) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Customer not found</Typography></Box></AnimatedPage>;
    }
    const initials = customer.name?.split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "CU";
    const totalPurchases = invoices.filter((i: any) => i.payment_status === "paid").reduce((s: number, i: any) => s + (i.total || 0), 0);
    const meta = parseCustomerMetadata(customer.notes, customer.gst_number);

    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
        <Button onClick={() => navigate("/customers")} variant="text" size="small" sx={{ color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
          <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Back to Customers
        </Button>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            size="small"
            variant="contained"
            onClick={() => navigate(`/sales/new?customerId=${id}`)}
            startIcon={<Box component={FileText} sx={{ width: 14, height: 14 }} />}
          >
            + New Quotation
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/invoices/new?customerId=${id}`)}
            startIcon={<Box component={Receipt} sx={{ width: 14, height: 14 }} />}
          >
            + New Invoice
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(`/repairs/new?customerId=${id}`)}
            startIcon={<Box component={Wrench} sx={{ width: 14, height: 14 }} />}
          >
            + New Job Sheet
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Contact Card - Left */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" } }}>
          <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            <CardContent sx={{ padding: "1.5rem", textAlign: "center", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Avatar sx={mergeSx({ height: "5rem", width: "5rem", marginLeft: "auto", marginRight: "auto" }, { backgroundColor: meta.isVIP ? "color-mix(in srgb, hsl(var(--warning)) 15%, transparent)" : "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: meta.isVIP ? "hsl(var(--warning))" : "hsl(var(--primary))", fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700" })}>{initials}</Avatar>
              <Box>
                <Typography component="h2" variant="h2" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{customer.name}</Typography>
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                  <StatusBadge status="active" />
                  <Chip size="small" label={meta.customerType} color={meta.customerType === "B2B" ? "primary" : "default"} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                  {meta.isVIP && (
                    <Chip size="small" label="VIP" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                  )}
                </Box>
              </Box>

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" }, textAlign: "left" }}>
                {customer.email && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={Mail} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--primary))" }}/>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Email</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.email}</Typography>
                    </Box>
                  </Box>)}
                {customer.phone && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={Phone} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--success))" }}/>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Phone</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>{customer.phone}</Typography>
                    </Box>
                  </Box>)}
                {(customer.address || customer.city) && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={MapPin} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--warning))" }}/>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Address</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>{[customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(", ")}</Typography>
                    </Box>
                  </Box>)}
                {customer.gst_number && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={Building2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--accent))" }}/>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>GSTIN</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontFamily: "JetBrains Mono, monospace", color: "hsl(var(--foreground))" }}>{customer.gst_number}</Typography>
                    </Box>
                  </Box>)}
                {meta.creditLimit && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={CreditCard} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--info))" }}/>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Credit Limit</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{meta.creditLimit}</Typography>
                    </Box>
                  </Box>)}
              </Box>

              {/* Quick Stats */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem", paddingTop: "0.75rem", borderTopWidth: "1px", borderColor: "hsl(var(--border))" }}>
                <Box sx={{ textAlign: "center" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{quotations.length}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quotes</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{invoices.length}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Invoices</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{jobSheets.length}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Repairs</Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700", color: "hsl(var(--primary))" }}>₹{totalPurchases.toLocaleString("en-IN")}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Paid</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {meta.cleanNotes && (<Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", marginTop: "1rem" }}>
              <CardContent sx={{ padding: "1.25rem" }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Notes</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap" }}>{meta.cleanNotes}</Typography>
              </CardContent>
            </Card>)}
        </Box>

        {/* Tabbed Content - Right */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" } }}>
          <TabView defaultValue="invoices">
            <TabBar>
              <Tab value="invoices" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Box component={Receipt} sx={{ height: "0.875rem", width: "0.875rem" }}/> Invoices ({invoices.length})
              </Box>} sx={{ gap: "0.375rem" }}/>
              <Tab value="quotations" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Box component={FileText} sx={{ height: "0.875rem", width: "0.875rem" }}/> Quotations ({quotations.length})
              </Box>} sx={{ gap: "0.375rem" }}/>
              <Tab value="repairs" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Box component={Wrench} sx={{ height: "0.875rem", width: "0.875rem" }}/> Repairs ({jobSheets.length})
              </Box>} sx={{ gap: "0.375rem" }}/>
              <Tab value="payments" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <Box component={CreditCard} sx={{ height: "0.875rem", width: "0.875rem" }}/> Payments ({payments.length})
              </Box>} sx={{ gap: "0.375rem" }}/>
            </TabBar>

            <TabPanel value="invoices" sx={{ marginTop: "1rem" }}>
              <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", overflow: "hidden" }}>
                <DataTable columnsCount={4} empty={invoices.length === 0} emptyMessage={"No invoices"}>
                  <TableHead>
                    <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>#</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Date</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Total</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>{invoices.map((inv: any) => (<TableRow key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                        <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>{inv.invoice_number}</TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell sx={{ textAlign: "right", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={inv.payment_status || "unpaid"}/></TableCell>
                      </TableRow>))}</TableBody>
                </DataTable>
              </Card>
            </TabPanel>

            <TabPanel value="quotations" sx={{ marginTop: "1rem" }}>
              <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", overflow: "hidden" }}>
                <DataTable columnsCount={4} empty={quotations.length === 0} emptyMessage={"No quotations"}>
                  <TableHead>
                    <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>#</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Date</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Total</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>{quotations.map((q: any) => (<TableRow key={q.id} onClick={() => navigate(`/sales/${q.id}`)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                        <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>{q.quotation_number}</TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell sx={{ textAlign: "right", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={q.status}/></TableCell>
                      </TableRow>))}</TableBody>
                </DataTable>
              </Card>
            </TabPanel>

            <TabPanel value="repairs" sx={{ marginTop: "1rem" }}>
              <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-ring-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", overflow: "hidden" }}>
                <DataTable columnsCount={5} empty={jobSheets.length === 0} emptyMessage={"No repair tickets or job sheets"}>
                  <TableHead>
                    <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Job #</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Date</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Device</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Problem</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobSheets.map((job: any) => (
                      <TableRow
                        key={job.id}
                        onClick={() => navigate(`/repairs/${job.id}`)}
                        sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}
                      >
                        <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>
                          {job.job_number || `#${job.id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                          {new Date(job.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>
                          {[job.device_brand, job.device_model].filter(Boolean).join(" ")}
                        </TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {job.problem_description || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </DataTable>
              </Card>
            </TabPanel>

            <TabPanel value="payments" sx={{ marginTop: "1rem" }}>
              <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", overflow: "hidden" }}>
                <DataTable columnsCount={5} empty={payments.length === 0} emptyMessage={"No payments"}>
                  <TableHead>
                    <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>#</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Date</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Amount</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Method</TableCell>
                      <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>{payments.map((p: any) => (<TableRow key={p.id} sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                        <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>{p.payment_number}</TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                        <TableCell sx={{ textAlign: "right", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{(p.amount || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", textTransform: "capitalize" }}>{p.payment_method}</TableCell>
                        <TableCell><StatusBadge status={p.status}/></TableCell>
                      </TableRow>))}</TableBody>
                </DataTable>
              </Card>
            </TabPanel>
          </TabView>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
