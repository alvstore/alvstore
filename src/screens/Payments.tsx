"use client";

import { Box, Button, Card, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, DataTable, DistributionWidget, FormDialog, PageHeader, SearchToolbar, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Clock, CheckCircle, Plus, Search, CreditCard, TrendingUp } from "lucide-react";
import { format } from "date-fns";
interface Payment {
    id: string;
    payment_number: string;
    type: string;
    amount: number;
    payment_method: string;
    status: string;
    reference_id: string | null;
    notes: string | null;
    created_at: string;
    customer_id: string | null;
}
export default function Payments() {
    const { user } = useAuth();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState({ amount: "", type: "pos", payment_method: "cash", status: "completed", reference_id: "", notes: "" });
    const fetchPayments = async () => {
        setLoading(true);
        let query = supabase.from("payments").select("*").order("created_at", { ascending: false });
        if (statusFilter !== "all")
            query = query.eq("status", statusFilter as any);
        if (search)
            query = query.ilike("payment_number", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        setPayments(data || []);
        setLoading(false);
    };
    useEffect(() => { fetchPayments(); }, [search, statusFilter]);
    const todayTotal = payments.filter(p => p.status === "completed" && new Date(p.created_at).toDateString() === new Date().toDateString()).reduce((s, p) => s + p.amount, 0);
    const pendingTotal = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
    const completedTotal = payments.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);

    const methodDistribution = Object.entries(payments.reduce((acc, p) => {
        const method = p.payment_method ? p.payment_method.toUpperCase() : "OTHER";
        acc[method] = (acc[method] || 0) + (p.amount || 0);
        return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const handleSave = async () => {
        const amount = parseFloat(form.amount);
        if (!amount || amount <= 0) {
            toast.error("Enter valid amount");
            return;
        }
        const { error } = await supabase.from("payments").insert({
            amount, type: form.type as any, payment_method: form.payment_method as any,
            status: form.status as any, reference_id: form.reference_id || null,
            notes: form.notes || null, created_by: user?.id,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Payment recorded");
            setSheetOpen(false);
            fetchPayments();
        }
    };
    return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader title={"Payments"} subtitle={"Track and manage customer payments, collections, and settlement records"} actions={<><Button onClick={() => { setForm({ amount: "", type: "pos", payment_method: "cash", status: "completed", reference_id: "", notes: "" }); setSheetOpen(true); }} variant="contained" startIcon={<Box component={Plus} sx={{ height: "1rem", width: "1rem" }} />}>Record Payment</Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard label="Total Collected" value={completedTotal} formatter={amount => "₹" + amount.toLocaleString("en-IN")} icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />} accent="success" loading={loading} />
        <StatCard label="Collected Today" value={todayTotal} formatter={amount => "₹" + amount.toLocaleString("en-IN")} icon={<Box component={TrendingUp} sx={{ height: 20, width: 20 }} />} accent="primary" loading={loading} />
        <StatCard label="Pending Clearance" value={pendingTotal} formatter={amount => "₹" + amount.toLocaleString("en-IN")} icon={<Box component={Clock} sx={{ height: 20, width: 20 }} />} accent="warning" loading={loading} />
        <StatCard label="Total Transactions" value={payments.length} icon={<Box component={CreditCard} sx={{ height: 20, width: 20 }} />} accent="info" loading={loading} />
      </Box>

      {/* Widget: Payment Method Breakdown */}
      {methodDistribution.length > 1 && (
        <DistributionWidget
          title="Payment channel distribution"
          subtitle="Collections volume segmented by payment method."
          items={methodDistribution}
          loading={loading}
          formatter={val => `₹${val.toLocaleString("en-IN")}`}
        />
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, alignItems: "flex-start" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search payment #..." sx={{ flex: 1, maxWidth: "24rem" }}/>
        <TextField value={statusFilter} select size="small" onChange={event => setStatusFilter(event.target.value)} slotProps={{ select: { displayEmpty: true } }} sx={{ width: 160 }}>
          <MenuItem value="all">All Status</MenuItem>
          <MenuItem value="completed">Completed</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
          <MenuItem value="failed">Failed</MenuItem>
          <MenuItem value="refunded">Refunded</MenuItem>
        </TextField>
      </Box>

      {/* Table */}
      <Card sx={theme => ({ borderRadius: "16px", border: `1px solid ${theme.palette.divider}`, overflow: "hidden" })}>
        <DataTable columnsCount={6} loading={loading} empty={payments.length === 0} emptyMessage={<>
                <Box component={DollarSign} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.25 }}/>
                <Typography variant="body2" color="text.secondary">No payments found</Typography>
              </>}>
          <TableHead>
            <TableRow sx={theme => ({ bgcolor: alpha(theme.palette.text.primary, 0.03) })}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Payment #</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Type</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Method</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", textAlign: "right" }}>Amount</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Status</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{payments.map(p => (<TableRow key={p.id} sx={theme => ({ "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) }, transition: "background-color 160ms ease" })}>
                <TableCell sx={{ fontFamily: "monospace", fontWeight: "700", color: "primary.main", fontSize: "0.875rem" }}>{p.payment_number}</TableCell>
                <TableCell sx={{ textTransform: "capitalize", fontSize: "0.875rem" }}>{p.type}</TableCell>
                <TableCell sx={{ textTransform: "uppercase", fontWeight: "600", fontSize: "0.8rem", color: "text.secondary" }}>{p.payment_method}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "650", fontVariantNumeric: "tabular-nums", fontSize: "0.875rem" }}>₹{Number(p.amount || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell><StatusChip label={p.status} /></TableCell>
                <TableCell sx={{ color: "text.secondary", fontSize: "0.8rem" }}>{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Card>

      {/* Slide-over */}
      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={"Record Payment"} description={"Enter payment details"}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="pos">POS</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.payment_method} label={"Method"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, payment_method: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.status} label={"Status"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, status: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.reference_id} onChange={e => setForm(p => ({ ...p, reference_id: e.target.value }))} label={"Reference ID"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} label={"Notes"} size="small" fullWidth multiline/></Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>Save Payment</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
