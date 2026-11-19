"use client";

import { Box, Button, Card, IconButton, LinearProgress, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, SearchToolbar, StatCard, TabBar, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Receipt, FileText, TrendingUp, AlertCircle, CheckCircle, Copy, Eye } from "lucide-react";
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
    customers?: {
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        gst_number: string | null;
    } | null;
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
        if (statusFilter !== "all")
            query = query.eq("status", statusFilter);
        if (search)
            query = query.ilike("invoice_number", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setInvoices((data as any) || []);
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
        if (!payInvoice)
            return;
        const amount = parseFloat(payAmount) || 0;
        if (amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        const newPaid = payInvoice.paid_amount + amount;
        const paymentStatus = newPaid >= payInvoice.total ? "paid" : "partial";
        const status = paymentStatus === "paid" ? "paid" : payInvoice.status;
        const { error } = await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: paymentStatus, status }).eq("id", payInvoice.id);
        if (error)
            toast.error(error.message);
        else
            toast.success("Payment recorded");
        setPaySheetOpen(false);
        fetchInvoices();
    };
    const copyPublicLink = (token: string | null) => {
        if (!token) {
            toast.error("No public link available");
            return;
        }
        navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${token}`);
        toast.success("Link copied");
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Invoices"} subtitle={"Create and manage GST invoices"} actions={<><Button onClick={() => navigate("/invoices/new")} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Invoice</Button></>}/>

      {/* KPIs */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        {[
            { label: "Total Invoices", value: totalInvoices, icon: FileText, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" }, iconColor: { color: "hsl(var(--primary))" } },
            { label: "Paid", value: paidCount, icon: CheckCircle, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" }, iconColor: { color: "hsl(var(--success))" } },
            { label: "Unpaid", value: unpaidCount, icon: AlertCircle, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)" }, iconColor: { color: "hsl(var(--destructive))" } },
            { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }, iconColor: { color: "hsl(var(--accent))" } },
        ].map(kpi => (<StatCard label={kpi.label} value={kpi.value} icon={<Box component={kpi.icon} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, kpi.iconColor)}/>} key={kpi.label} sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}/>))}
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", alignItems: "flex-start" }}>
        <TabView value={statusFilter} onChange={setStatusFilter}>
          <TabBar>
            <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
            <Tab value="draft" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Draft</Box>}/>
            <Tab value="sent" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Sent</Box>}/>
            <Tab value="paid" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Paid</Box>}/>
            <Tab value="cancelled" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Cancelled</Box>}/>
          </TabBar>
        </TabView>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search invoices..." sx={{ maxWidth: "24rem" }}/>
      </Box>

      {/* Table */}
      <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", overflow: "hidden" }}>
        <DataTable columnsCount={6} loading={loading} empty={invoices.length === 0} emptyMessage={<>
                <Box component={Receipt} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.2" }}/>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>No invoices found</Typography>
              </>}>
          <TableHead>
            <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>#ID</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Client</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Total</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Issued Date</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Balance</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{invoices.map(inv => (<TableRow key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>{inv.invoice_number}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component="span" sx={{ fontSize: "11px", fontWeight: "600", color: "hsl(var(--primary))" }}>
                        {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </Box>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customers?.name || "—"}</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "none", "@media (min-width: 640px)": { display: "block" } }}>{inv.customers?.email || ""}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                  {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  {inv.payment_status === "paid" ? (<StatusBadge status="paid"/>) : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--destructive))" }}>
                        ₹{((inv.total || 0) - (inv.paid_amount || 0)).toLocaleString("en-IN")}
                      </Box>
                      {inv.paid_amount > 0 && (<LinearProgress value={(inv.paid_amount / (inv.total || 1)) * 100} variant="determinate" sx={{ height: "0.375rem", width: "5rem" }}/>)}
                    </Box>)}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center", justifyContent: "flex-end" }}>
                    {inv.payment_status !== "paid" && (<Button onClick={() => openPayment(inv)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }}>Pay</Button>)}
                    <IconButton onClick={() => copyPublicLink(inv.public_token)} title="Copy link" aria-label={"Copy link"} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                      <Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/>
                    </IconButton>
                    <IconButton onClick={() => navigate(`/invoices/${inv.id}`)} title="View" aria-label={"View"} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                      <Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/>
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Card>

      {/* Payment Sheet */}
      <FormDialog open={paySheetOpen} onClose={() => setPaySheetOpen(false)} title={"Record Payment"} description={<>
              {payInvoice?.invoice_number} — Balance: ₹{((payInvoice?.total || 0) - (payInvoice?.paid_amount || 0)).toFixed(2)}
            </>} paperSx={{ "@media (min-width: 640px)": { maxWidth: "28rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} label={"Amount"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payMethod} label={"Payment Method"} select size="small" fullWidth onChange={event => setPayMethod(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  {["cash", "card", "upi", "online"].map(m => <MenuItem key={m} value={m} sx={{ textTransform: "capitalize" }}>{m}</MenuItem>)}
                </TextField>
            </Box>
            <Button onClick={recordPayment} variant="contained" sx={{ width: "100%" }}>Record Payment</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
