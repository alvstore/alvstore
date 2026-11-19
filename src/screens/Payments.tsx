"use client";

import { Box, Button, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, SearchToolbar, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Clock, CheckCircle, Plus, Search } from "lucide-react";
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
    const statusBadge = (s: string) => {
        const map = { completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, pending: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }, failed: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }, refunded: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" } };
        return <StatusChip label={s} sx={map[s] || {}}/>;
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Payments"} subtitle={"Track and manage payment records"} actions={<><Button onClick={() => { setForm({ amount: "", type: "pos", payment_method: "cash", status: "completed", reference_id: "", notes: "" }); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Record Payment
        </Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Collected Today"} value={todayTotal} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Pending"} value={pendingTotal} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={Clock} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Total Records"} value={payments.length} icon={<Box component={DollarSign} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search payment #..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={statusFilter} select size="small" fullWidth onChange={event => setStatusFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}>
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="refunded">Refunded</MenuItem>
          </TextField>
      </Box>

      {/* Table */}
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={6} loading={loading} empty={payments.length === 0} emptyMessage={"No payments found"}>
          <TableHead>
            <TableRow>
              <TableCell>Payment #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Method</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{payments.map(p => (<TableRow key={p.id}>
                <TableCell sx={{ fontWeight: "500" }}>{p.payment_number}</TableCell>
                <TableCell sx={{ textTransform: "capitalize" }}>{p.type}</TableCell>
                <TableCell sx={{ textTransform: "capitalize" }}>{p.payment_method}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>₹{p.amount.toLocaleString()}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>

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
