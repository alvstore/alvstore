"use client";

import { Box, Button, Card, CardContent, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Building2, Phone, Mail, IndianRupee, TrendingDown, Users, Eye, MapPin, CreditCard } from "lucide-react";
interface Supplier {
    id: string;
    name: string;
    gst_number: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    outstanding_balance: number;
    status: string;
    created_at: string;
}
const emptyForm = { name: "", gst_number: "", phone: "", email: "", address: "" };
const emptyPayForm = { amount: "", payment_mode: "cash", notes: "", account_id: "" };
export default function Suppliers() {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [ledgerOpen, setLedgerOpen] = useState(false);
    const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
    const [ledgerBills, setLedgerBills] = useState<any[]>([]);
    const [ledgerReturns, setLedgerReturns] = useState<any[]>([]);
    const [ledgerPayments, setLedgerPayments] = useState<any[]>([]);
    const [paySheetOpen, setPaySheetOpen] = useState(false);
    const [payForm, setPayForm] = useState(emptyPayForm);
    const [payingSaving, setPayingSaving] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const fetchSuppliers = async () => {
        setLoading(true);
        let q = supabase.from("suppliers").select("*").order("created_at", { ascending: false });
        if (search)
            q = q.ilike("name", `%${search}%`);
        const { data, error } = await q;
        if (error)
            toast.error(error.message);
        else
            setSuppliers((data || []) as Supplier[]);
        setLoading(false);
    };
    const fetchAccounts = async () => {
        const { data } = await supabase.from("finance_accounts").select("id, name, type").eq("status", "active");
        setAccounts(data || []);
    };
    useEffect(() => { fetchSuppliers(); fetchAccounts(); }, [search]);
    const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
    const openEdit = (s: Supplier) => {
        setEditId(s.id);
        setForm({ name: s.name, gst_number: s.gst_number || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
        setSheetOpen(true);
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
        setSaving(true);
        const payload = { name: form.name, gst_number: form.gst_number || null, phone: form.phone || null, email: form.email || null, address: form.address || null };
        if (editId) {
            const { error } = await supabase.from("suppliers").update({ ...payload, updated_at: new Date().toISOString() } as any).eq("id", editId);
            if (error)
                toast.error(error.message);
            else
                toast.success("Supplier updated");
        }
        else {
            const { error } = await supabase.from("suppliers").insert({ ...payload, created_by: user?.id } as any);
            if (error)
                toast.error(error.message);
            else
                toast.success("Supplier created");
        }
        setSaving(false);
        setSheetOpen(false);
        fetchSuppliers();
    };
    const openLedger = async (s: Supplier) => {
        setLedgerSupplier(s);
        const [billsRes, returnsRes, paymentsRes] = await Promise.all([
            supabase.from("purchase_bills").select("*").eq("supplier_id", s.id).order("created_at", { ascending: false }),
            supabase.from("purchase_returns").select("*").eq("supplier_id", s.id).order("created_at", { ascending: false }),
            supabase.from("finance_transactions").select("*").eq("reference", `supplier:${s.id}`).order("created_at", { ascending: false }),
        ]);
        setLedgerBills(billsRes.data || []);
        setLedgerReturns(returnsRes.data || []);
        setLedgerPayments(paymentsRes.data || []);
        setLedgerOpen(true);
    };
    const openPayment = () => {
        setPayForm(emptyPayForm);
        setPaySheetOpen(true);
    };
    const recordSupplierPayment = async () => {
        if (!ledgerSupplier)
            return;
        const amount = parseFloat(payForm.amount) || 0;
        if (amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        if (!payForm.account_id) {
            toast.error("Select an account");
            return;
        }
        setPayingSaving(true);
        try {
            // Create finance expense transaction
            const { error: finErr } = await supabase.from("finance_transactions").insert({
                type: "expense",
                amount,
                account_id: payForm.account_id,
                payment_mode: payForm.payment_mode,
                description: `Supplier payment to ${ledgerSupplier.name}`,
                reference: `supplier:${ledgerSupplier.id}`,
                staff_name: "Admin",
                created_by: user?.id,
            });
            if (finErr)
                throw finErr;
            // Reduce outstanding balance
            const newBalance = Math.max(0, (ledgerSupplier.outstanding_balance || 0) - amount);
            await supabase.from("suppliers").update({ outstanding_balance: newBalance, updated_at: new Date().toISOString() } as any).eq("id", ledgerSupplier.id);
            toast.success(`₹${amount.toLocaleString()} payment recorded`);
            setPaySheetOpen(false);
            // Refresh ledger
            setLedgerSupplier({ ...ledgerSupplier, outstanding_balance: newBalance });
            const { data: paymentsData } = await supabase.from("finance_transactions").select("*").eq("reference", `supplier:${ledgerSupplier.id}`).order("created_at", { ascending: false });
            setLedgerPayments(paymentsData || []);
            fetchSuppliers();
        }
        catch (err: any) {
            toast.error(err.message);
        }
        finally {
            setPayingSaving(false);
        }
    };
    const totalOutstanding = suppliers.reduce((s, v) => s + (v.outstanding_balance || 0), 0);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Suppliers"} subtitle={"Manage your suppliers and vendor relationships"} actions={<><Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add Supplier</Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total Suppliers"} value={suppliers.length} icon={<Box component={Users} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Active"} value={suppliers.filter(s => s.status === "active").length} icon={<Box component={Building2} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Outstanding"} value={totalOutstanding} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={TrendingDown} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error"/>
        <StatCard label={"With Dues"} value={suppliers.filter(s => (s.outstanding_balance || 0) > 0).length} icon={<Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search suppliers..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={6} empty={suppliers.length === 0} emptyMessage={"No suppliers found"}>
            <TableHead><TableRow>
              <TableCell>Supplier</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Contact</TableCell>
              <TableCell>GST</TableCell>
              <TableCell>Outstanding</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ width: "6rem" }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{suppliers.map(s => (<TableRow key={s.id}>
                  <TableCell><Box component="span" sx={{ fontWeight: "500" }}>{s.name}</Box></TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                      {s.phone && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem" }}/>{s.phone}</Box>}
                      {s.email && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Mail} sx={{ height: "0.75rem", width: "0.75rem" }}/>{s.email}</Box>}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{s.gst_number || "—"}</TableCell>
                  <TableCell>
                    <Box component="span" sx={mergeSx({ fontFamily: "JetBrains Mono, monospace", fontWeight: "500" }, (s.outstanding_balance || 0) > 0 ? { color: "hsl(var(--destructive))" } : { color: "hsl(var(--primary))" })}>
                      ₹{(s.outstanding_balance || 0).toLocaleString()}
                    </Box>
                  </TableCell>
                  <TableCell><StatusChip label={s.status}/></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: "0.25rem" }}>
                      <Button onClick={() => openLedger(s)} variant="text" size="small"><Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/></Button>
                      <Button onClick={() => openEdit(s)} variant="text" size="small">Edit</Button>
                    </Box>
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      {/* Add/Edit Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={editId ? "Edit Supplier" : "Add Supplier"}
        description={"Manage supplier details"}
        width={520}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>{saving ? "Saving..." : editId ? "Update" : "Create Supplier"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Name *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.gst_number} onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))} label={"GST Number"} size="small" fullWidth/></Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} label={"Phone"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} label={"Email"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={3} label={"Address"} size="small" fullWidth multiline/></Box>
          </Box>
        </SideDrawer>

      {/* Supplier Ledger Drawer */}
      <SideDrawer open={ledgerOpen} onClose={() => setLedgerOpen(false)} width={760} title={<>Supplier Ledger — {ledgerSupplier?.name}</>}>


          {/* Supplier Contact Info */}
          {ledgerSupplier && (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
              {ledgerSupplier.phone && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "hsl(var(--muted-foreground))" }}>
                  <Box component={Phone} sx={{ height: "0.875rem", width: "0.875rem" }}/>{ledgerSupplier.phone}
                </Box>)}
              {ledgerSupplier.email && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "hsl(var(--muted-foreground))" }}>
                  <Box component={Mail} sx={{ height: "0.875rem", width: "0.875rem" }}/>{ledgerSupplier.email}
                </Box>)}
              {ledgerSupplier.gst_number && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "hsl(var(--muted-foreground))" }}>
                  <Box component={Building2} sx={{ height: "0.875rem", width: "0.875rem" }}/>GST: {ledgerSupplier.gst_number}
                </Box>)}
              {ledgerSupplier.address && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "hsl(var(--muted-foreground))", gridColumn: "span 2 / span 2", "@media (min-width: 640px)": { gridColumn: "span 1 / span 1" } }}>
                  <Box component={MapPin} sx={{ height: "0.875rem", width: "0.875rem", flexShrink: "0" }}/><Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ledgerSupplier.address}</Box>
                </Box>)}
            </Box>)}

          {/* KPI Cards */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            <Card><CardContent sx={{ padding: "0.75rem", textAlign: "center" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Total Billed</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700" }}>₹{ledgerBills.reduce((s, b) => s + (b.total || 0), 0).toLocaleString()}</Typography>
            </CardContent></Card>
            <Card><CardContent sx={{ padding: "0.75rem", textAlign: "center" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Payments Made</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--primary))" }}>₹{ledgerPayments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()}</Typography>
            </CardContent></Card>
            <Card><CardContent sx={{ padding: "0.75rem", textAlign: "center" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Outstanding</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--destructive))" }}>₹{(ledgerSupplier?.outstanding_balance || 0).toLocaleString()}</Typography>
            </CardContent></Card>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={openPayment} disabled={(ledgerSupplier?.outstanding_balance || 0) <= 0} variant="contained" size="small">
              <Box component={CreditCard} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Record Payment
            </Button>
          </Box>

          {/* Tabs: Bills / Payments / Returns */}
          <TabView defaultValue="bills" sx={{ width: "100%" }}>
            <TabBar sx={{ width: "100%" }}>
              <Tab value="bills" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Bills ({ledgerBills.length})</Box>} sx={{ flex: "1 1 0%" }}/>
              <Tab value="payments" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Payments ({ledgerPayments.length})</Box>} sx={{ flex: "1 1 0%" }}/>
              <Tab value="returns" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Returns ({ledgerReturns.length})</Box>} sx={{ flex: "1 1 0%" }}/>
            </TabBar>

            <TabPanel value="bills">
              <DataTable columnsCount={5} empty={ledgerBills.length === 0} emptyMessage={"No bills found"}>
                <TableHead><TableRow>
                  <TableCell>Bill #</TableCell><TableCell>Date</TableCell><TableCell>Total</TableCell><TableCell>Paid</TableCell><TableCell>Status</TableCell>
                </TableRow></TableHead>
                <TableBody>{ledgerBills.map(b => (<TableRow key={b.id}>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{b.bill_number}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{b.bill_date}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(b.total || 0).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(b.paid_amount || 0).toLocaleString()}</TableCell>
                      <TableCell><StatusChip label={b.payment_status}/></TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </TabPanel>

            <TabPanel value="payments">
              <DataTable columnsCount={4} empty={ledgerPayments.length === 0} emptyMessage={"No payments recorded"}>
                <TableHead><TableRow>
                  <TableCell>Transaction ID</TableCell><TableCell>Date</TableCell><TableCell>Amount</TableCell><TableCell>Mode</TableCell>
                </TableRow></TableHead>
                <TableBody>{ledgerPayments.map(p => (<TableRow key={p.id}>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{p.transaction_id}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{p.date}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", color: "hsl(var(--primary))" }}>₹{(p.amount || 0).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", textTransform: "capitalize" }}>{p.payment_mode || "—"}</TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </TabPanel>

            <TabPanel value="returns">
              <DataTable columnsCount={5} empty={ledgerReturns.length === 0} emptyMessage={"No returns found"}>
                <TableHead><TableRow>
                  <TableCell>Return #</TableCell><TableCell>Date</TableCell><TableCell>Total</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell>
                </TableRow></TableHead>
                <TableBody>{ledgerReturns.map(r => (<TableRow key={r.id}>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{r.return_number}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{r.created_at?.split("T")[0]}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(r.total || 0).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>{r.reason || "—"}</TableCell>
                      <TableCell><StatusChip label={r.status}/></TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </TabPanel>
          </TabView>
        </SideDrawer>

      {/* Record Payment Sheet */}
      <SideDrawer
        open={paySheetOpen}
        busy={payingSaving}
        onClose={() => setPaySheetOpen(false)}
        title={"Record Supplier Payment"}
        description={<>Pay {ledgerSupplier?.name} — Outstanding: ₹{(ledgerSupplier?.outstanding_balance || 0).toLocaleString()}</>}
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPaySheetOpen(false)} disabled={payingSaving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={recordSupplierPayment} disabled={payingSaving} variant="contained" sx={{ minHeight: 36 }}>
              {payingSaving ? "Processing..." : "Record Payment"}
            </Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" placeholder="0" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payForm.account_id} label={"Account *"} select size="small" fullWidth onChange={event => (v => setPayForm(p => ({ ...p, account_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select account"}</MenuItem>
                  {accounts.map(a => (<MenuItem key={a.id} value={a.id}>{a.name} ({a.type})</MenuItem>))}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payForm.payment_mode} label={"Payment Mode"} select size="small" fullWidth onChange={event => (v => setPayForm(p => ({ ...p, payment_mode: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional notes" label={"Notes"} size="small" fullWidth multiline/>
            </Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
