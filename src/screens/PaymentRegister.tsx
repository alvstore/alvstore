"use client";

import { Box, Button, Card, CardContent, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { FileText, Plus, Search, Download, Filter, CreditCard, AlertTriangle, CheckCircle2, Clock, Banknote, Upload, X, ChevronDown, Percent, } from "lucide-react";
type PaymentRegisterRow = {
    id: string;
    register_number: string;
    transaction_date: string;
    customer_name: string;
    customer_id: string | null;
    invoice_number: string | null;
    invoice_id: string | null;
    invoice_amount: number;
    payment_mode: string;
    payment_sub_mode: string | null;
    bank_name: string | null;
    card_type: string | null;
    card_network: string | null;
    mdr_percentage: number;
    transaction_reference: string | null;
    cheque_number: string | null;
    cheque_deposit_date: string | null;
    cheque_clearance_date: string | null;
    received_amount: number;
    bank_charges: number;
    net_received_amount: number;
    difference_amount: number;
    difference_type: string;
    deposit_bank_name: string | null;
    settlement_date: string | null;
    status: string;
    notes: string | null;
    document_url: string | null;
    created_by: string | null;
    created_at: string;
};
const MDR_RATES: Record<string, Record<string, number>> = {
    visa: { debit: 0.40, credit: 1.80 },
    mastercard: { debit: 0.40, credit: 1.80 },
    amex: { debit: 2.00, credit: 2.20 },
    rupay: { debit: 0.00, credit: 0.60 },
};
const emptyForm = {
    transaction_date: format(new Date(), "yyyy-MM-dd"),
    customer_name: "",
    customer_id: "",
    invoice_number: "",
    invoice_id: "",
    invoice_amount: 0,
    payment_mode: "card",
    payment_sub_mode: "debit_card",
    bank_name: "",
    card_type: "debit",
    card_network: "visa",
    mdr_percentage: 0.40,
    transaction_reference: "",
    cheque_number: "",
    cheque_deposit_date: "",
    cheque_clearance_date: "",
    received_amount: 0,
    bank_charges: 0,
    deposit_bank_name: "",
    settlement_date: "",
    status: "pending",
    notes: "",
};
const statusColors = {
    pending: { backgroundColor: "rgb(254 249 195 / 1)", color: "rgb(133 77 14 / 1)", '[data-theme-mode="dark"] &': { backgroundColor: "rgb(113 63 18 / 0.3)", color: "rgb(250 204 21 / 1)" } },
    deposited: { backgroundColor: "rgb(219 234 254 / 1)", color: "rgb(30 64 175 / 1)", '[data-theme-mode="dark"] &': { backgroundColor: "rgb(30 58 138 / 0.3)", color: "rgb(96 165 250 / 1)" } },
    cleared: { backgroundColor: "rgb(209 250 229 / 1)", color: "rgb(6 95 70 / 1)", '[data-theme-mode="dark"] &': { backgroundColor: "rgb(6 78 59 / 0.3)", color: "rgb(52 211 153 / 1)" } },
    reconciled: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    failed: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
};
const diffColors = {
    none: { color: "rgb(5 150 105 / 1)", '[data-theme-mode="dark"] &': { color: "rgb(52 211 153 / 1)" } },
    short: { color: "hsl(var(--destructive))" },
    excess: { color: "rgb(234 88 12 / 1)", '[data-theme-mode="dark"] &': { color: "rgb(251 146 60 / 1)" } },
};
const paymentModes = [
    { value: "card", label: "Card" },
    { value: "upi", label: "UPI" },
    { value: "net_banking", label: "Net Banking" },
    { value: "neft_rtgs", label: "NEFT/RTGS/IMPS" },
    { value: "cheque", label: "Cheque" },
    { value: "bank_transfer", label: "Bank Transfer" },
];
const paymentSubModes: Record<string, {
    value: string;
    label: string;
}[]> = {
    card: [
        { value: "debit_card", label: "Debit Card" },
        { value: "credit_card", label: "Credit Card" },
    ],
    upi: [{ value: "upi", label: "UPI" }],
    net_banking: [{ value: "net_banking", label: "Net Banking" }],
    neft_rtgs: [
        { value: "neft", label: "NEFT" },
        { value: "rtgs", label: "RTGS" },
        { value: "imps", label: "IMPS" },
    ],
    cheque: [{ value: "cheque", label: "Cheque" }],
    bank_transfer: [{ value: "bank_transfer", label: "Bank Transfer" }],
};
const cardNetworks = [
    { value: "visa", label: "Visa" },
    { value: "mastercard", label: "Mastercard" },
    { value: "amex", label: "Amex" },
    { value: "rupay", label: "Rupay" },
];
const statusOptions = ["pending", "deposited", "cleared", "reconciled", "failed"];
export default function PaymentRegister() {
    const { user } = useAuth();
    const [entries, setEntries] = useState<PaymentRegisterRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterMode, setFilterMode] = useState("all");
    const [customers, setCustomers] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [invoices, setInvoices] = useState<{
        id: string;
        invoice_number: string;
        total: number;
    }[]>([]);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [editId, setEditId] = useState<string | null>(null);
    const fetchEntries = async () => {
        const { data, error } = await supabase
            .from("payment_register")
            .select("*")
            .order("created_at", { ascending: false });
        if (!error && data)
            setEntries(data as unknown as PaymentRegisterRow[]);
        setLoading(false);
    };
    const fetchLookups = async () => {
        const [cRes, iRes] = await Promise.all([
            supabase.from("customers").select("id, name").order("name"),
            supabase.from("invoices").select("id, invoice_number, total").order("created_at", { ascending: false }).limit(200),
        ]);
        if (cRes.data)
            setCustomers(cRes.data);
        if (iRes.data)
            setInvoices(iRes.data as {
                id: string;
                invoice_number: string;
                total: number;
            }[]);
    };
    useEffect(() => {
        fetchEntries();
        fetchLookups();
    }, []);
    // Auto-suggest MDR when card network or type changes
    const updateMdr = (network: string, cardType: string) => {
        const rate = MDR_RATES[network]?.[cardType] ?? 0;
        setForm(f => {
            const charges = +(f.received_amount * rate / 100).toFixed(2);
            return { ...f, card_network: network, card_type: cardType, mdr_percentage: rate, bank_charges: charges };
        });
    };
    // Auto-calc bank charges when MDR% or received amount changes
    const recalcCharges = (receivedAmount: number, mdrPct: number) => {
        if (form.payment_mode === "card") {
            return +(receivedAmount * mdrPct / 100).toFixed(2);
        }
        return form.bank_charges;
    };
    // KPIs
    const kpis = useMemo(() => {
        const total = entries.length;
        const pending = entries.filter(e => e.status === "pending" || e.status === "deposited").length;
        const charges = entries.reduce((s, e) => s + (e.bank_charges || 0), 0);
        const mdrTotal = entries.reduce((s, e) => s + (e.bank_charges || 0), 0);
        const mismatch = entries.filter(e => e.difference_type !== "none").reduce((s, e) => s + Math.abs(e.difference_amount || 0), 0);
        const reconciled = entries.filter(e => e.status === "reconciled").length;
        return { total, pending, charges, mdrTotal, mismatch, reconciled };
    }, [entries]);
    // Filter
    const filtered = useMemo(() => {
        let list = entries;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(e => e.customer_name?.toLowerCase().includes(q) ||
                e.invoice_number?.toLowerCase().includes(q) ||
                e.transaction_reference?.toLowerCase().includes(q) ||
                e.register_number?.toLowerCase().includes(q));
        }
        if (filterStatus !== "all")
            list = list.filter(e => e.status === filterStatus);
        if (filterMode !== "all")
            list = list.filter(e => e.payment_mode === filterMode);
        return list;
    }, [entries, search, filterStatus, filterMode]);
    // Live calc
    const netReceived = (form.received_amount || 0) - (form.bank_charges || 0);
    const diffAmount = (form.invoice_amount || 0) - netReceived;
    const diffType = diffAmount > 0.01 ? "short" : diffAmount < -0.01 ? "excess" : "none";
    const handleSave = async () => {
        if (!form.customer_name.trim())
            return toast.error("Customer name is required");
        setSaving(true);
        let documentUrl: string | null = null;
        if (docFile) {
            const ext = docFile.name.split(".").pop();
            const path = `payment-register/${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from("uploads").upload(path, docFile);
            if (upErr) {
                toast.error("Upload failed");
                setSaving(false);
                return;
            }
            const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
            documentUrl = urlData.publicUrl;
        }
        const payload: Record<string, unknown> = {
            transaction_date: form.transaction_date,
            customer_name: form.customer_name,
            customer_id: form.customer_id || null,
            invoice_number: form.invoice_number || null,
            invoice_id: form.invoice_id || null,
            invoice_amount: form.invoice_amount,
            payment_mode: form.payment_mode,
            payment_sub_mode: form.payment_sub_mode || null,
            bank_name: form.bank_name || null,
            card_type: form.payment_mode === "card" ? form.card_type : null,
            card_network: form.payment_mode === "card" ? form.card_network : null,
            mdr_percentage: form.payment_mode === "card" ? form.mdr_percentage : 0,
            transaction_reference: form.transaction_reference || null,
            cheque_number: form.payment_mode === "cheque" ? form.cheque_number : null,
            cheque_deposit_date: form.payment_mode === "cheque" && form.cheque_deposit_date ? form.cheque_deposit_date : null,
            cheque_clearance_date: form.payment_mode === "cheque" && form.cheque_clearance_date ? form.cheque_clearance_date : null,
            received_amount: form.received_amount,
            bank_charges: form.bank_charges,
            deposit_bank_name: form.deposit_bank_name || null,
            settlement_date: form.settlement_date || null,
            status: form.status,
            notes: form.notes || null,
            ...(documentUrl && { document_url: documentUrl }),
            ...(!editId && { created_by: user?.id }),
        };
        let error;
        if (editId) {
            ({ error } = await supabase.from("payment_register").update(payload as any).eq("id", editId));
        }
        else {
            ({ error } = await supabase.from("payment_register").insert(payload as any));
        }
        if (error) {
            toast.error(error.message);
        }
        else {
            toast.success(editId ? "Entry updated" : "Entry created");
            setSheetOpen(false);
            setForm(emptyForm);
            setDocFile(null);
            setEditId(null);
            fetchEntries();
        }
        setSaving(false);
    };
    const openEdit = (row: PaymentRegisterRow) => {
        setEditId(row.id);
        setForm({
            transaction_date: row.transaction_date,
            customer_name: row.customer_name,
            customer_id: row.customer_id || "",
            invoice_number: row.invoice_number || "",
            invoice_id: row.invoice_id || "",
            invoice_amount: row.invoice_amount,
            payment_mode: row.payment_mode,
            payment_sub_mode: row.payment_sub_mode || "",
            bank_name: row.bank_name || "",
            card_type: row.card_type || "debit",
            card_network: row.card_network || "visa",
            mdr_percentage: row.mdr_percentage || 0,
            transaction_reference: row.transaction_reference || "",
            cheque_number: row.cheque_number || "",
            cheque_deposit_date: row.cheque_deposit_date || "",
            cheque_clearance_date: row.cheque_clearance_date || "",
            received_amount: row.received_amount,
            bank_charges: row.bank_charges,
            deposit_bank_name: row.deposit_bank_name || "",
            settlement_date: row.settlement_date || "",
            status: row.status,
            notes: row.notes || "",
        });
        setDocFile(null);
        setSheetOpen(true);
    };
    const openNew = () => {
        setEditId(null);
        setForm(emptyForm);
        setDocFile(null);
        setSheetOpen(true);
    };
    const exportCSV = () => {
        const headers = ["Date", "Register#", "Customer", "Invoice", "Mode", "Sub Mode", "Card Network", "MDR%", "Bank", "Deposit Bank", "Settlement Date", "Reference", "Invoice Amt", "Received", "Charges", "Net Received", "Difference", "Type", "Status"];
        const rows = filtered.map(e => [
            e.transaction_date, e.register_number, e.customer_name, e.invoice_number || "",
            e.payment_mode, e.payment_sub_mode || "", e.card_network || "", e.mdr_percentage || 0,
            e.bank_name || "", e.deposit_bank_name || "", e.settlement_date || "",
            e.transaction_reference || "",
            e.invoice_amount, e.received_amount, e.bank_charges, e.net_received_amount,
            e.difference_amount, e.difference_type, e.status,
        ]);
        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payment-register-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
    };
    const handleInvoiceSelect = (invoiceId: string) => {
        const inv = invoices.find(i => i.id === invoiceId);
        if (inv)
            setForm(f => ({ ...f, invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_amount: inv.total || 0 }));
    };
    const handleCustomerSelect = (customerId: string) => {
        const cust = customers.find(c => c.id === customerId);
        if (cust)
            setForm(f => ({ ...f, customer_id: cust.id, customer_name: cust.name }));
    };
    const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
    const showCardFields = form.payment_mode === "card";
    const showBankFields = ["card", "upi", "net_banking", "neft_rtgs", "bank_transfer"].includes(form.payment_mode);
    const showChequeFields = form.payment_mode === "cheque";
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header */}
      <PageHeader title={"Payment Register"} subtitle={"Reconciliation & audit register with MDR tracking, settlement & bank charges"} actions={<><Box sx={{ display: "flex", gap: "0.5rem" }}>
          <Button onClick={exportCSV} variant="outlined" size="small">
            <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Export
          </Button>
          <SideDrawer
            open={sheetOpen}
            busy={saving}
            onClose={() => setSheetOpen(false)}
            onOpen={() => setSheetOpen(true)}
            title={editId ? "Edit Entry" : "New Register Entry"}
            trigger={<Button onClick={openNew} variant="contained" size="small"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> New Entry</Button>}
            width={520}
            footer={
              <>
                <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
                  {saving ? "Saving..." : editId ? "Update Entry" : "Create Entry"}
                </Button>
              </>
            }
          >

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
                {/* Basic Info */}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Basic Info</Typography>
                  <Box>

                    <TextField type="date" value={form.transaction_date} onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))} label={"Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                  </Box>
                  <Box>

                    <TextField value={form.customer_id} label={"Customer"} select size="small" fullWidth onChange={event => handleCustomerSelect(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select or type below"}</MenuItem>
                        {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </TextField>
                    <TextField placeholder="Or type customer name" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Or type customer name" } }} sx={{ marginTop: "0.25rem" }}/>
                  </Box>
                  <Box>

                    <TextField value={form.invoice_id} label={"Invoice"} select size="small" fullWidth onChange={event => handleInvoiceSelect(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select invoice"}</MenuItem>
                        {invoices.map(i => <MenuItem key={i.id} value={i.id}>{i.invoice_number} — {fmt(i.total || 0)}</MenuItem>)}
                      </TextField>
                    <TextField placeholder="Or type invoice number" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Or type invoice number" } }} sx={{ marginTop: "0.25rem" }}/>
                  </Box>
                </Box>

                {/* Payment Details */}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Details</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                    <Box>

                      <TextField value={form.payment_mode} label={"Payment Mode"} select size="small" fullWidth onChange={event => (v => {
        const subModes = paymentSubModes[v];
        const defaultSub = subModes?.[0]?.value || "";
        setForm(f => ({ ...f, payment_mode: v, payment_sub_mode: defaultSub }));
    })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                          {paymentModes.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                        </TextField>
                    </Box>
                    <Box>

                      <TextField value={form.payment_sub_mode} label={"Sub Mode"} select size="small" fullWidth onChange={event => (v => {
        setForm(f => ({ ...f, payment_sub_mode: v }));
        if (form.payment_mode === "card") {
            const cardType = v === "credit_card" ? "credit" : "debit";
            updateMdr(form.card_network, cardType);
        }
    })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                          {(paymentSubModes[form.payment_mode] || []).map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                        </TextField>
                    </Box>
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                    <Box>

                      <TextField type="number" value={form.invoice_amount} onChange={e => setForm(f => ({ ...f, invoice_amount: +e.target.value }))} label={"Invoice Amount"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField type="number" value={form.received_amount} onChange={e => {
        const amt = +e.target.value;
        const charges = showCardFields ? +(amt * form.mdr_percentage / 100).toFixed(2) : form.bank_charges;
        setForm(f => ({ ...f, received_amount: amt, bank_charges: charges }));
    }} label={"Received Amount"} size="small" fullWidth/>
                    </Box>
                  </Box>
                </Box>

                {/* MDR & Charges — Card specific */}
                {showCardFields && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Box component={Percent} sx={{ height: "0.875rem", width: "0.875rem" }}/> MDR & Charges
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                      <Box>

                        <TextField value={form.card_network} label={"Card Network"} select size="small" fullWidth onChange={event => (v => updateMdr(v, form.card_type))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                            {cardNetworks.map(n => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
                          </TextField>
                      </Box>
                      <Box>

                        <TextField type="number" value={form.mdr_percentage} onChange={e => {
            const pct = +e.target.value;
            const charges = +(form.received_amount * pct / 100).toFixed(2);
            setForm(f => ({ ...f, mdr_percentage: pct, bank_charges: charges }));
        }} label={"MDR %"} size="small" fullWidth slotProps={{ htmlInput: { step: "0.01" } }}/>
                      </Box>
                    </Box>
                    <Box>

                      <TextField type="number" value={form.bank_charges} onChange={e => setForm(f => ({ ...f, bank_charges: +e.target.value }))} label={"Bank Charges (Auto-calculated)"} size="small" fullWidth slotProps={{ htmlInput: { step: "0.01" } }}/>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>= Received × MDR% — editable override</Typography>
                    </Box>
                  </Box>)}

                {/* Non-card bank charges */}
                {!showCardFields && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Charges</Typography>
                    <Box>

                      <TextField type="number" value={form.bank_charges} onChange={e => setForm(f => ({ ...f, bank_charges: +e.target.value }))} label={"Bank Charges"} size="small" fullWidth slotProps={{ htmlInput: { step: "0.01" } }}/>
                    </Box>
                  </Box>)}

                {/* Live Calc */}
                <Box sx={{ borderRadius: "0.75rem", borderWidth: "1px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Net Received</Box><Box component="span" sx={{ fontWeight: "600" }}>{fmt(netReceived)}</Box></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Difference</Box>
                    <Box component="span" sx={mergeSx({ fontWeight: "600" }, diffColors[diffType])}>
                      {fmt(Math.abs(diffAmount))} {diffType !== "none" && `(${diffType})`}
                    </Box>
                  </Box>
                </Box>

                {/* Banking Details */}
                {showBankFields && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Banking Details</Typography>
                    <Box>

                      <TextField value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Customer's bank" label={"Issuing Bank"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField value={form.deposit_bank_name} onChange={e => setForm(f => ({ ...f, deposit_bank_name: e.target.value }))} placeholder="Your bank where amount credits" label={"Deposit / Settlement Bank"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField type="date" value={form.settlement_date} onChange={e => setForm(f => ({ ...f, settlement_date: e.target.value }))} label={"Settlement Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                    </Box>
                    <Box>

                      <TextField value={form.transaction_reference} onChange={e => setForm(f => ({ ...f, transaction_reference: e.target.value }))} label={"Transaction Reference"} size="small" fullWidth/>
                    </Box>
                  </Box>)}

                {/* Cheque Details */}
                {showChequeFields && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cheque Details</Typography>
                    <Box>

                      <TextField value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} label={"Bank Name"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField value={form.deposit_bank_name} onChange={e => setForm(f => ({ ...f, deposit_bank_name: e.target.value }))} placeholder="Bank where cheque is deposited" label={"Deposit Bank"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField value={form.cheque_number} onChange={e => setForm(f => ({ ...f, cheque_number: e.target.value }))} label={"Cheque Number"} size="small" fullWidth/>
                    </Box>
                    <Box>

                      <TextField value={form.transaction_reference} onChange={e => setForm(f => ({ ...f, transaction_reference: e.target.value }))} label={"Transaction Reference"} size="small" fullWidth/>
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                      <Box>

                        <TextField type="date" value={form.cheque_deposit_date} onChange={e => setForm(f => ({ ...f, cheque_deposit_date: e.target.value }))} label={"Deposit Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                      </Box>
                      <Box>

                        <TextField type="date" value={form.cheque_clearance_date} onChange={e => setForm(f => ({ ...f, cheque_clearance_date: e.target.value }))} label={"Clearance Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                      </Box>
                    </Box>
                  </Box>)}

                {/* Reconciliation */}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reconciliation</Typography>
                  <Box>

                    <TextField value={form.status} label={"Status"} select size="small" fullWidth onChange={event => (v => setForm(f => ({ ...f, status: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                        {statusOptions.map(s => <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s}</MenuItem>)}
                      </TextField>
                  </Box>
                  <Box>

                    <TextField value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} label={"Notes / Remarks"} size="small" fullWidth multiline/>
                  </Box>
                </Box>

                {/* Document Upload */}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Document Upload</Typography>
                  <Box sx={{ borderWidth: "2px", borderStyle: "dashed", borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
                    <Box type="file" accept="image/*,.pdf" id="doc-upload" onChange={e => setDocFile(e.target.files?.[0] || null)} component="input" sx={{ display: "none" }}/>
                    <Box htmlFor="doc-upload" component="label" sx={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                      <Box component={Upload} sx={{ height: "2rem", width: "2rem" }}/>
                      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{docFile ? docFile.name : "Upload slip, photo or PDF"}</Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </SideDrawer>
        </Box></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }, gap: "1rem" }}>
        {[
            { label: "Total Entries", value: kpis.total, icon: FileText, color: { color: "hsl(var(--primary))" } },
            { label: "Pending Clearance", value: kpis.pending, icon: Clock, color: { color: "rgb(202 138 4 / 1)" } },
            { label: "Total MDR Paid", value: fmt(kpis.mdrTotal), icon: Percent, color: { color: "rgb(147 51 234 / 1)" } },
            { label: "Total Charges", value: fmt(kpis.charges), icon: Banknote, color: { color: "rgb(234 88 12 / 1)" } },
            { label: "Mismatch Amount", value: fmt(kpis.mismatch), icon: AlertTriangle, color: { color: "hsl(var(--destructive))" } },
            { label: "Reconciled", value: kpis.reconciled, icon: CheckCircle2, color: { color: "rgb(5 150 105 / 1)" } },
        ].map(kpi => (<StatCard label={kpi.label} value={kpi.value} icon={<Box component={kpi.icon} sx={{ height: "1rem", width: "1rem" }}/>} key={kpi.label} sx={{ borderRadius: "1rem", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderWidth: "0px", backgroundColor: "hsl(var(--card))" }}/>))}
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search customer, invoice, reference..." sx={{ flex: "1 1 0%" }}/>
        <TextField value={filterStatus} select size="small" fullWidth onChange={event => setFilterStatus(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}><MenuItem value="" disabled>{"Status"}</MenuItem>
            <MenuItem value="all">All Status</MenuItem>
            {statusOptions.map(s => <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s}</MenuItem>)}
          </TextField>
        <TextField value={filterMode} select size="small" fullWidth onChange={event => setFilterMode(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}><MenuItem value="" disabled>{"Mode"}</MenuItem>
            <MenuItem value="all">All Modes</MenuItem>
            {paymentModes.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
      </Box>

      {/* Table */}
      <Card sx={{ borderRadius: "1rem", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderWidth: "0px" }}>
        <CardContent sx={{ padding: "0px", overflowX: "auto" }}>
          <DataTable columnsCount={17} loading={loading} empty={filtered.length === 0} emptyMessage={"No entries found"}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>
                <TableCell>Date</TableCell>
                <TableCell>Reg #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Network</TableCell>
                <TableCell>MDR%</TableCell>
                <TableCell>Bank</TableCell>
                <TableCell>Deposit Bank</TableCell>
                <TableCell>Settlement</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Invoice Amt</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Received</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Charges</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Net Received</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Difference</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{(filtered.map(e => (<TableRow key={e.id} onClick={() => openEdit(e)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 40%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.transaction_date}</TableCell>
                    <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{e.register_number}</TableCell>
                    <TableCell sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.customer_name}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.invoice_number || "—"}</TableCell>
                    <TableCell>
                      <StatusChip label={e.payment_sub_mode ? e.payment_sub_mode.replace(/_/g, " ") : e.payment_mode.replace(/_/g, " ")} variant="outlined" sx={{ textTransform: "capitalize", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", textTransform: "uppercase" }}>{e.card_network || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.mdr_percentage ? `${e.mdr_percentage}%` : "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.bank_name || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.deposit_bank_name || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", whiteSpace: "nowrap" }}>{e.settlement_date || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontFamily: "JetBrains Mono, monospace" }}>{e.transaction_reference || "—"}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{fmt(e.invoice_amount)}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{fmt(e.received_amount)}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{fmt(e.bank_charges)}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{fmt(e.net_received_amount)}</TableCell>
                    <TableCell sx={mergeSx({ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }, diffColors[e.difference_type] || {})}>
                      {fmt(Math.abs(e.difference_amount))}
                      {e.difference_type !== "none" && <Box component="span" sx={{ fontSize: "10px", marginLeft: "0.25rem", textTransform: "uppercase" }}>({e.difference_type})</Box>}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={e.status} variant="filled" sx={mergeSx({ fontSize: "10px", textTransform: "capitalize" }, statusColors[e.status] || {})}/>
                    </TableCell>
                  </TableRow>)))}</TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </Box></AnimatedPage>;
}
