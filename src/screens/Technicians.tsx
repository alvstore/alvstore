"use client";

import { Avatar, Box, Button, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Wrench, Pencil, ShieldCheck, AlertTriangle, Users, CheckCircle2, Clock, IndianRupee, BookOpen } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
interface Technician {
    id: string;
    user_id: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    department: string | null;
    designation: string | null;
    salary: number;
    status: string;
    created_at: string;
    avatar_url: string | null;
    device_employee_code: string | null;
}
const emptyForm = {
    name: "", email: "", phone: "", department: "", designation: "",
    salary: "0", joining_date: "", password: "", createLogin: true,
};
export default function Technicians() {
    const { hasRole, user } = useAuth();
    const isAdmin = hasRole("admin");
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [activeJobs, setActiveJobs] = useState<Record<string, number>>({});
    // Ledger state
    const [ledgerOpen, setLedgerOpen] = useState(false);
    const [ledgerTech, setLedgerTech] = useState<Technician | null>(null);
    const [ledgerPayments, setLedgerPayments] = useState<any[]>([]);
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ amount: "", notes: "", payment_mode: "cash", job_sheet_id: "" });
    const [techJobSheets, setTechJobSheets] = useState<any[]>([]);
    const fetchTechnicians = async () => {
        setLoading(true);
        let query = supabase.from("employees").select("*").eq("role", "technician").order("created_at", { ascending: false });
        if (search)
            query = query.ilike("name", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setTechnicians((data || []) as Technician[]);
        const { data: jobs } = await supabase.from("job_sheets").select("assigned_technician_id")
            .not("status", "in", '("delivered","invoice_generated")');
        const counts: Record<string, number> = {};
        jobs?.forEach((j: any) => { if (j.assigned_technician_id)
            counts[j.assigned_technician_id] = (counts[j.assigned_technician_id] || 0) + 1; });
        setActiveJobs(counts);
        setLoading(false);
    };
    useEffect(() => { fetchTechnicians(); }, [search]);
    const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
    const openEdit = (t: Technician) => {
        setEditId(t.id);
        setForm({ name: t.name, email: t.email || "", phone: t.phone || "", department: t.department || "", designation: t.designation || "", salary: String(t.salary), joining_date: "", password: "", createLogin: false });
        setSheetOpen(true);
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
        if (!editId && form.createLogin && (!form.email || !form.password || form.password.length < 6)) {
            toast.error("Email and password (6+ chars) required for login");
            return;
        }
        setSaving(true);
        try {
            if (editId) {
                await supabase.from("employees").update({
                    name: form.name, phone: form.phone || null, email: form.email || null,
                    department: form.department || null, designation: form.designation || null,
                    salary: parseFloat(form.salary) || 0,
                } as any).eq("id", editId);
                toast.success("Technician updated");
            }
            else {
                let userId: string | null = null;
                if (form.createLogin && form.email && form.password) {
                    const { data, error } = await supabase.functions.invoke("manage-staff", {
                        body: { action: "create", email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: "technician" },
                    });
                    if (error)
                        throw error;
                    if (data?.error)
                        throw new Error(data.error);
                    userId = data?.user_id || null;
                }
                await supabase.from("employees").insert({
                    user_id: userId, name: form.name, phone: form.phone || null, email: form.email || null,
                    role: "technician", department: form.department || null, designation: form.designation || null,
                    salary: parseFloat(form.salary) || 0, employee_type: "internal",
                } as any);
                toast.success("Technician created");
            }
            setSheetOpen(false);
            fetchTechnicians();
        }
        catch (err: any) {
            toast.error(err.message);
        }
        setSaving(false);
    };
    // Ledger functions
    const openLedger = async (t: Technician) => {
        setLedgerTech(t);
        const techId = t.user_id || t.id;
        const { data } = await supabase.from("technician_payments").select("*").eq("technician_id", techId).order("created_at", { ascending: false });
        setLedgerPayments(data || []);
        // Get unpaid job sheets for this technician
        const { data: js } = await supabase.from("job_sheets").select("id, job_number, technician_payment, technician_payment_status")
            .eq("assigned_technician_id", techId)
            .eq("technician_payment_status", "pending");
        setTechJobSheets(js || []);
        setLedgerOpen(true);
    };
    const markAsPaid = async (payment: any) => {
        // Create finance expense transaction
        const { data: accounts } = await supabase.from("finance_accounts").select("id").limit(1);
        let finTxnId: string | null = null;
        if (accounts && accounts.length > 0) {
            const { data: txn } = await supabase.from("finance_transactions").insert({
                type: "expense", amount: payment.amount, account_id: accounts[0].id,
                description: `Tech payment: ${ledgerTech?.name}`, reference: `TP-${payment.id.slice(0, 8)}`,
                created_by: user?.id,
            } as any).select().single();
            finTxnId = txn?.id || null;
        }
        await supabase.from("technician_payments").update({
            status: "paid", payment_date: new Date().toISOString().split("T")[0],
            finance_transaction_id: finTxnId,
        } as any).eq("id", payment.id);
        toast.success("Payment marked as paid & synced to Finance");
        openLedger(ledgerTech!);
    };
    const addPaymentRecord = async () => {
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        const techId = ledgerTech?.user_id || ledgerTech?.id;
        await supabase.from("technician_payments").insert({
            technician_id: techId, amount: parseFloat(paymentForm.amount),
            notes: paymentForm.notes || null, payment_mode: paymentForm.payment_mode,
            job_sheet_id: paymentForm.job_sheet_id || null, created_by: user?.id,
        } as any);
        // Update job sheet tech payment status if linked
        if (paymentForm.job_sheet_id) {
            await supabase.from("job_sheets").update({ technician_payment_status: "recorded" } as any).eq("id", paymentForm.job_sheet_id);
        }
        toast.success("Payment record added");
        setPaymentSheetOpen(false);
        setPaymentForm({ amount: "", notes: "", payment_mode: "cash", job_sheet_id: "" });
        openLedger(ledgerTech!);
    };
    const stats = {
        total: technicians.length,
        active: technicians.filter(t => t.status === "active").length,
        withLogin: technicians.filter(t => t.user_id).length,
        totalActiveJobs: Object.values(activeJobs).reduce((s, v) => s + v, 0),
    };
    const ledgerTotals = {
        total: ledgerPayments.reduce((s, p) => s + (p.amount || 0), 0),
        paid: ledgerPayments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0),
        unpaid: ledgerPayments.filter(p => p.status === "unpaid").reduce((s, p) => s + (p.amount || 0), 0),
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Technicians"} subtitle={"Manage repair technicians & payment ledger"} actions={<>{isAdmin && <Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add Technician</Button>}</>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total"} value={stats.total} icon={<Box component={Users} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Active"} value={stats.active} icon={<Box component={CheckCircle2} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Active Jobs"} value={stats.totalActiveJobs} icon={<Box component={Wrench} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"With Login"} value={stats.withLogin} icon={<Box component={ShieldCheck} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search technicians..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={6} empty={technicians.length === 0} emptyMessage={"No technicians found"}>
            <TableHead><TableRow>
              <TableCell>Technician</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Contact</TableCell>
              <TableCell>Active Jobs</TableCell>
              <TableCell>Login</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ width: "7rem" }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{technicians.map(t => (<TableRow key={t.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar src={t.avatar_url ?? undefined} sx={mergeSx({ height: "2rem", width: "2rem" }, { fontSize: "0.75rem", lineHeight: "1rem" })}>{t.name.slice(0, 2).toUpperCase()}</Avatar>
                      <Box>
                        <Box component="span" sx={{ fontWeight: "500" }}>{t.name}</Box>
                        {t.designation && <Box component="span" sx={{ display: "block", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{t.designation}</Box>}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{t.phone || t.email || "—"}</TableCell>
                  <TableCell>
                    <StatusChip label={activeJobs[t.user_id || ""] || 0} variant="outlined" sx={{ fontFamily: "JetBrains Mono, monospace" }}/>
                  </TableCell>
                  <TableCell>
                    {t.user_id ? (<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "hsl(var(--success))" }}><Box component={ShieldCheck} sx={{ height: "0.875rem", width: "0.875rem" }}/><Box component="span" sx={{ fontSize: "11px" }}>Linked</Box></Box>) : (<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "hsl(var(--warning))" }}><Box component={AlertTriangle} sx={{ height: "0.875rem", width: "0.875rem" }}/><Box component="span" sx={{ fontSize: "11px" }}>No Login</Box></Box>)}
                  </TableCell>
                  <TableCell><StatusChip label={t.status}/></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: "0.25rem" }}>
                      <IconButton onClick={() => openLedger(t)} title="Ledger" aria-label={"Ledger"}><Box component={BookOpen} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                      {isAdmin && <IconButton onClick={() => openEdit(t)} aria-label={"Pencil"}><Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/></IconButton>}
                    </Box>
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      {/* Add/Edit Technician Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={editId ? "Edit Technician" : "Add Technician"}
        description={"Manage technician details and login"}
        width={520}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>{saving ? "Saving..." : editId ? "Update" : "Create Technician"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <AvatarUpload currentUrl={editId ? technicians.find(t => t.id === editId)?.avatar_url : undefined} name={form.name} folder="technicians" entityId={editId || undefined} onUploaded={async (url) => {
        if (editId) {
            await supabase.from("employees").update({ avatar_url: url } as any).eq("id", editId);
            fetchTechnicians();
        }
    }}/>
              <Box sx={{ flex: "1 1 0%", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Full Name *"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} label={"Email"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} label={"Phone"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} label={"Department"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} label={"Designation"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} label={"Salary"} size="small" fullWidth/></Box>
            {!editId && (<>
                <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--warning)) 30%, transparent)", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 5%, transparent)" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--warning))", fontWeight: "500" }}>⚠ Technicians without login cannot access the app or receive job assignments</Typography>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" label={"Password *"} size="small" fullWidth/></Box>
              </>)}
          </Box>
        </SideDrawer>

      {/* Payment Ledger Drawer */}
      <SideDrawer open={ledgerOpen} onClose={() => setLedgerOpen(false)} width={760} title={<>
              <Box component={BookOpen} sx={{ height: "1.25rem", width: "1.25rem" }}/> Payment Ledger — {ledgerTech?.name}
            </>}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
              <StatCard label={"Total Earnings"} value={ledgerTotals.total} formatter={amount => "\u20B9" + amount.toLocaleString()}/>
              <StatCard label={"Paid"} value={ledgerTotals.paid} formatter={amount => "\u20B9" + amount.toLocaleString()} accent="success"/>
              <StatCard label={"Unpaid"} value={ledgerTotals.unpaid} formatter={amount => "\u20B9" + amount.toLocaleString()} accent="error"/>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography component="h3" variant="h3" sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>Payment Records</Typography>
              <Button onClick={() => setPaymentSheetOpen(true)} variant="contained" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Add Record</Button>
            </Box>

            <DataTable columnsCount={6} empty={ledgerPayments.length === 0} emptyMessage={"No payment records"}>
              <TableHead><TableRow>
                <TableCell>Date</TableCell><TableCell>Amount</TableCell><TableCell>Mode</TableCell>
                <TableCell>Notes</TableCell><TableCell>Status</TableCell><TableCell sx={{ width: "6rem" }}>Action</TableCell>
              </TableRow></TableHead>
              <TableBody>{ledgerPayments.map(p => (<TableRow key={p.id}>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontWeight: "500" }}>₹{(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", textTransform: "capitalize" }}>{p.payment_mode || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notes || "—"}</TableCell>
                    <TableCell><StatusChip label={p.status}/></TableCell>
                    <TableCell>
                      {p.status === "unpaid" && (<Button onClick={() => markAsPaid(p)} variant="outlined" size="small">Pay</Button>)}
                      {p.status === "paid" && p.finance_transaction_id && (<Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--success))" }}>✓ Synced</Box>)}
                    </TableCell>
                  </TableRow>))}</TableBody>
            </DataTable>
          </Box>
        </SideDrawer>

      {/* Add Payment Record Sheet */}
      <SideDrawer
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        title={"Add Payment Record"}
        description={<>Record a technician payment for {ledgerTech?.name}</>}
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPaymentSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={addPaymentRecord} variant="contained" sx={{ minHeight: 36 }}>Add Payment Record</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            {techJobSheets.length > 0 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={paymentForm.job_sheet_id} label={"Link to Job Sheet (optional)"} select size="small" fullWidth onChange={event => (v => {
            const js = techJobSheets.find(j => j.id === v);
            setPaymentForm(p => ({ ...p, job_sheet_id: v, amount: js?.technician_payment ? String(js.technician_payment) : p.amount }));
        })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select job sheet"}</MenuItem>{techJobSheets.map(j => <MenuItem key={j.id} value={j.id}>{j.job_number} — ₹{j.technician_payment || 0}</MenuItem>)}</TextField>
              </Box>)}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={paymentForm.payment_mode} label={"Payment Mode"} select size="small" fullWidth onChange={event => (v => setPaymentForm(p => ({ ...p, payment_mode: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} rows={2} label={"Notes"} size="small" fullWidth multiline/></Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
