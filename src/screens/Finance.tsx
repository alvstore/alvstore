"use client";

import { Alert, Box, Button, Card, CardContent, FormLabel, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, SearchToolbar, StatCard, StatusChip, TabBar, TabPanel, TabView, TrendChart, DistributionWidget, mergeSx, toast, type StatAccent } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Landmark, PiggyBank, Tags, BookOpen, ShieldCheck, Plus, Search, Download, DollarSign, BarChart3, } from "lucide-react";
import { format, startOfMonth, startOfDay, endOfDay } from "date-fns";
// ─── Types ────────────────────────────────────
interface FinanceAccount {
    id: string;
    name: string;
    type: string;
    account_number: string | null;
    bank_name: string | null;
    opening_balance: number;
    current_balance: number;
    status: string;
    created_at: string;
}
interface FinanceCategory {
    id: string;
    name: string;
    type: string;
    status: string;
}
interface FinanceTransaction {
    id: string;
    transaction_id: string;
    type: string;
    date: string;
    amount: number;
    payment_mode: string | null;
    account_id: string | null;
    to_account_id: string | null;
    category_id: string | null;
    customer_id: string | null;
    reference: string | null;
    description: string | null;
    staff_name: string | null;
    balance_after: number | null;
    created_at: string;
}
interface AuditEntry {
    id: string;
    action: string;
    entity_type: string | null;
    details: string | null;
    staff_name: string | null;
    user_role: string | null;
    created_at: string;
}
interface CashControl {
    id: string;
    date: string;
    opening_cash: number;
    closing_cash: number | null;
    difference: number | null;
    staff_name: string | null;
    status: string | null;
    denominations: any;
    pos_total: number | null;
    manual_income: number | null;
    manual_expense: number | null;
    expected_closing: number | null;
    notes: string | null;
    closed_at: string | null;
    closed_by: string | null;
    created_by: string | null;
}
export default function Finance() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("dashboard");
    // ─── Shared data ──────────────────────────────
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [categories, setCategories] = useState<FinanceCategory[]>([]);
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [cashRecords, setCashRecords] = useState<CashControl[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [staffName, setStaffName] = useState("");
    // Fetch staff name from profile
    useEffect(() => {
        if (!user)
            return;
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
            .then(({ data }) => setStaffName(data?.full_name || user.email || ""));
    }, [user]);
    const fetchAll = async () => {
        setLoading(true);
        setLoadError("");
        try {
            const [accRes, catRes, txRes, auditRes, cashRes] = await Promise.all([
                supabase.from("finance_accounts").select("*").order("created_at", { ascending: false }),
                supabase.from("finance_categories").select("*").order("name"),
                supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }),
                supabase.from("finance_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
                supabase.from("daily_cash_control").select("*").order("date", { ascending: false }),
            ]);
            for (const result of [accRes, catRes, txRes, auditRes, cashRes]) if (result.error) throw new Error(result.error.message);
            setAccounts(accRes.data ?? []);
            setCategories(catRes.data ?? []);
            setTransactions(txRes.data ?? []);
            setAuditLog(auditRes.data ?? []);
            setCashRecords(cashRes.data ?? []);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "Finance data could not be loaded");
        } finally { setLoading(false); }
    };
    useEffect(() => { fetchAll(); }, []);
    // ─── KPI Calculations ─────────────────────────
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const cashBalance = accounts.filter(a => a.type === "cash").reduce((s, a) => s + a.current_balance, 0);
    const bankBalance = accounts.filter(a => a.type === "bank").reduce((s, a) => s + a.current_balance, 0);
    const todayIncome = transactions.filter(t => t.type === "income" && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
    const todayExpense = transactions.filter(t => t.type === "expense" && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
    const monthlyIncome = transactions.filter(t => t.type === "income" && t.date >= monthStart && t.date <= todayStr).reduce((s, t) => s + t.amount, 0);
    const monthlyExpense = transactions.filter(t => t.type === "expense" && t.date >= monthStart && t.date <= todayStr).reduce((s, t) => s + t.amount, 0);
    const netBalance = accounts.reduce((s, a) => s + a.current_balance, 0);
    // ─── Chart Data ───────────────────────────────
    const cashflowSeries = useMemo(() => [
        { id: "income", label: "Income", color: "success" as const, values: transactions.filter(t => t.type === "income").map(t => ({ date: t.date, value: Number(t.amount) })) },
        { id: "expense", label: "Expenses", color: "warning" as const, increaseIsGood: false, values: transactions.filter(t => t.type === "expense").map(t => ({ date: t.date, value: Number(t.amount) })) },
    ], [transactions]);
    const categoryChart = useMemo(() => {
        const map: Record<string, number> = {};
        transactions.filter(t => t.type === "expense" && t.date >= monthStart && t.date <= todayStr).forEach(t => {
            const cat = categories.find(c => c.id === t.category_id);
            const name = cat?.name || "Uncategorized";
            map[name] = (map[name] || 0) + t.amount;
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [transactions, categories, monthStart, todayStr]);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Finance"} subtitle={"Daily finance control & ledger management"}/>
      {loadError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void fetchAll()}>Retry</Button>}>Finance data is unavailable. {loadError}</Alert>}

      <TabView value={activeTab} onChange={setActiveTab}>
        <TabBar aria-label="Finance sections">
          <Tab value="dashboard" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={BarChart3} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Dashboard</Box>}/>
          <Tab value="income" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={TrendingUp} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Income</Box>}/>
          <Tab value="expenses" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={TrendingDown} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Expenses</Box>}/>
          <Tab value="transfers" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={ArrowRightLeft} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Transfers</Box>}/>
          <Tab value="accounts" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Landmark} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Accounts</Box>}/>
          <Tab value="categories" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Tags} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Categories</Box>}/>
          <Tab value="ledger" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={BookOpen} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Ledger</Box>}/>
          <Tab value="cash" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={PiggyBank} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Cash Control</Box>}/>
          <Tab value="audit" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={ShieldCheck} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Audit Log</Box>}/>
        </TabBar>

        {/* ─── DASHBOARD ─────────────────────────── */}
        <TabPanel value="dashboard" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          {!loadError && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>
            {[
                { label: "Total Balance", value: netBalance, icon: DollarSign, accent: "primary", caption: "Across all accounts" },
                { label: "Cash in Hand", value: cashBalance, icon: Wallet, accent: "success", caption: "Cash accounts" },
                { label: "Bank Balance", value: bankBalance, icon: Landmark, accent: "info", caption: "Bank accounts" },
                { label: "Today Income", value: todayIncome, icon: TrendingUp, accent: "success", caption: "Recorded today" },
                { label: "Today Expense", value: todayExpense, icon: TrendingDown, accent: "warning", caption: "Recorded today" },
                { label: "Net Income", value: monthlyIncome - monthlyExpense, icon: BarChart3, accent: monthlyIncome >= monthlyExpense ? "success" : "error", caption: "Income less expenses · this month" },
            ].map((kpi, index) => <StatCard key={kpi.label} label={kpi.label} value={kpi.value} isCurrency icon={<Box component={kpi.icon} sx={{ width: 18, height: 18 }} />} accent={kpi.accent as StatAccent} caption={kpi.caption} loading={loading} index={index} />)}
          </Box>}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.8fr) minmax(0,1fr)" }, gap: 2.5 }}>
            <TrendChart title="Cash flow" subtitle="A clearer view of money in and money out." series={cashflowSeries} loading={loading} error={loadError || undefined} onRetry={() => void fetchAll()} />
            <DistributionWidget title="Where it went" subtitle="Expense categories · this month" items={categoryChart} loading={loading} error={loadError || undefined} onRetry={() => void fetchAll()} index={1} />
          </Box>
        </TabPanel>

        {/* ─── INCOME TAB ────────────────────────── */}
        <TabPanel value="income">
          <TransactionTab type="income" transactions={transactions} accounts={accounts} categories={categories.filter(c => c.type === "income")} staffName={staffName} userId={user?.id} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── EXPENSES TAB ──────────────────────── */}
        <TabPanel value="expenses">
          <TransactionTab type="expense" transactions={transactions} accounts={accounts} categories={categories.filter(c => c.type === "expense")} staffName={staffName} userId={user?.id} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── TRANSFERS TAB ─────────────────────── */}
        <TabPanel value="transfers">
          <TransfersTab accounts={accounts} transactions={transactions.filter(t => t.type === "transfer")} staffName={staffName} userId={user?.id} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── ACCOUNTS TAB ──────────────────────── */}
        <TabPanel value="accounts">
          <AccountsTab accounts={accounts} userId={user?.id} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── CATEGORIES TAB ────────────────────── */}
        <TabPanel value="categories">
          <CategoriesTab categories={categories} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── LEDGER TAB ────────────────────────── */}
        <TabPanel value="ledger">
          <LedgerTab transactions={transactions} accounts={accounts} categories={categories}/>
        </TabPanel>

        {/* ─── CASH CONTROL TAB ──────────────────── */}
        <TabPanel value="cash">
          <CashControlTab records={cashRecords} staffName={staffName} userId={user?.id} onRefresh={fetchAll}/>
        </TabPanel>

        {/* ─── AUDIT LOG TAB ─────────────────────── */}
        <TabPanel value="audit">
          <AuditLogTab entries={auditLog}/>
        </TabPanel>
      </TabView>
    </Box></AnimatedPage>;
}
// ═══════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════
// ─── Transaction Tab (Income / Expense) ───────
function TransactionTab({ type, transactions, accounts, categories, staffName, userId, onRefresh }: {
    type: "income" | "expense";
    transactions: FinanceTransaction[];
    accounts: FinanceAccount[];
    categories: FinanceCategory[];
    staffName: string;
    userId?: string;
    onRefresh: () => void;
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [receiptTx, setReceiptTx] = useState<FinanceTransaction | null>(null);
    const [search, setSearch] = useState("");
    const [dateFilter, setDateFilter] = useState("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const filtered = transactions.filter(t => {
        if (t.type !== type)
            return false;
        // Date filter
        if (dateFilter === "today" && t.date !== format(new Date(), "yyyy-MM-dd"))
            return false;
        if (dateFilter === "7days" && new Date(t.date) < new Date(Date.now() - 7 * 86400000))
            return false;
        if (dateFilter === "month" && new Date(t.date) < startOfMonth(new Date()))
            return false;
        if (dateFilter === "custom" && customFrom && t.date < customFrom)
            return false;
        if (dateFilter === "custom" && customTo && t.date > customTo)
            return false;
        // Search filter
        if (search) {
            const q = search.toLowerCase();
            return t.transaction_id.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.staff_name?.toLowerCase().includes(q) ||
                t.reference?.toLowerCase().includes(q) ||
                t.payment_mode?.toLowerCase().includes(q) ||
                format(new Date(t.date), "dd MMM yyyy").toLowerCase().includes(q) ||
                String(t.amount).includes(q);
        }
        return true;
    });
    const [form, setForm] = useState({
        date: format(new Date(), "yyyy-MM-dd"), amount: "", payment_mode: "cash",
        account_id: "", category_id: "", customer_name: "", reference: "", description: "",
    });
    const handleSave = async () => {
        const amount = parseFloat(form.amount);
        if (!amount || amount <= 0) {
            toast.error("Enter valid amount");
            return;
        }
        if (!form.account_id) {
            toast.error("Select an account");
            return;
        }
        const { error } = await supabase.from("finance_transactions").insert({
            type, date: form.date, amount, payment_mode: form.payment_mode,
            account_id: form.account_id, category_id: form.category_id || null,
            reference: form.reference || null, description: form.description || null,
            created_by: userId, staff_name: staffName,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success(`${type === "income" ? "Income" : "Expense"} recorded`);
            setSheetOpen(false);
            onRefresh();
        }
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, gap: "0.75rem" }}>
          <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search ID, date, amount, reference, staff..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
          <Button onClick={() => { setForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", payment_mode: "cash", account_id: "", category_id: "", customer_name: "", reference: "", description: "" }); setSheetOpen(true); }} variant="contained">
            <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add {type === "income" ? "Income" : "Expense"}
          </Button>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "7days", label: "7 Days" },
            { key: "month", label: "This Month" },
            { key: "custom", label: "Custom" },
        ].map(f => (<Button key={f.key} onClick={() => setDateFilter(f.key)} variant={dateFilter === f.key ? "contained" : "outlined"} size="small">
              {f.label}
            </Button>))}
          {dateFilter === "custom" && (<>
              <TextField type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "9rem", height: "2rem" }}/>
              <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>to</Box>
              <TextField type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "9rem", height: "2rem" }}/>
            </>)}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{filtered.length} entries</Typography>
        <Button onClick={() => {
        const headers = ["ID", "Date", "Category", "Account", "Mode", "Amount", "Reference", "Description", "Staff"];
        const rows = filtered.map(t => [
            t.transaction_id,
            format(new Date(t.date), "dd MMM yyyy"),
            categories.find(c => c.id === t.category_id)?.name || "",
            accounts.find(a => a.id === t.account_id)?.name || "",
            t.payment_mode || "",
            t.amount,
            t.reference || "",
            t.description || "",
            t.staff_name || "",
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}_${format(new Date(), "yyyyMMdd")}.csv`;
        a.click();
    }} variant="outlined" size="small">
          <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Export CSV
        </Button>
      </Box>

      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={10} empty={filtered.length === 0} emptyMessage={<>No {type} entries</>}>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Amount</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Staff</TableCell>
              <TableCell sx={{ width: "2.5rem" }}/>
            </TableRow>
          </TableHead>
          <TableBody>{filtered.map(t => (<TableRow key={t.id}>
                <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{t.transaction_id}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{categories.find(c => c.id === t.category_id)?.name || <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>—</Box>}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{accounts.find(a => a.id === t.account_id)?.name || <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>—</Box>}</TableCell>
                <TableCell sx={{ textTransform: "capitalize", fontSize: "0.75rem", lineHeight: "1rem" }}>{t.payment_mode}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>₹{t.amount.toLocaleString()}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description || "—"}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{t.reference || "—"}</TableCell>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{t.staff_name || "—"}</TableCell>
                <TableCell>
                  <Button onClick={() => { setReceiptTx(t); setReceiptOpen(true); }} title="View Receipt" variant="text" size="small" sx={{ height: "1.75rem", width: "1.75rem", padding: "0px" }}>
                    <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                  </Button>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>

      {/* Receipt Dialog */}
      <FormDialog open={receiptOpen} onClose={() => setReceiptOpen(false)} title={"Receipt Slip"} paperSx={{ "@media (min-width: 640px)": { maxWidth: "28rem" }, "@media print": { maxWidth: "100%", "--alv-shadow": "0 0 #0000", "--alv-shadow-colored": "0 0 #0000", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" } }}>

          {receiptTx && (<ReceiptSlip transaction={receiptTx} accounts={accounts} categories={categories}/>)}
          <Box sx={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", "@media print": { display: "none" } }}>
            <Button onClick={() => window.print()} variant="outlined" size="small">
              <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Print / PDF
            </Button>
          </Box>
        </FormDialog>

      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={<>Add {type === "income" ? "Income" : "Expense"}</>} description={<>Staff: {staffName}</>}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} label={"Date"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.payment_mode} label={"Payment Mode"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, payment_mode: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  {["cash", "bank", "upi", "card", "gateway"].map(m => <MenuItem key={m} value={m} sx={{ textTransform: "capitalize" }}>{m}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.account_id} label={"Account *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, account_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select account"}</MenuItem>
                  {accounts.filter(a => a.status === "active").map(a => <MenuItem key={a.id} value={a.id}>{a.name} ({a.type})</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.category_id} label={"Category"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, category_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select category"}</MenuItem>
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Invoice / Job Sheet #" label={"Reference"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} label={"Description"} size="small" fullWidth multiline/></Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>Save</Button>
          </Box>
        </FormDialog>
    </Box>);
}
// ─── Transfers Tab ────────────────────────────
function TransfersTab({ accounts, transactions, staffName, userId, onRefresh }: {
    accounts: FinanceAccount[];
    transactions: FinanceTransaction[];
    staffName: string;
    userId?: string;
    onRefresh: () => void;
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState({ from: "", to: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
    const handleSave = async () => {
        const amount = parseFloat(form.amount);
        if (!amount || !form.from || !form.to) {
            toast.error("Fill all required fields");
            return;
        }
        if (form.from === form.to) {
            toast.error("From and To accounts must differ");
            return;
        }
        const { error } = await supabase.from("finance_transactions").insert({
            type: "transfer", date: form.date, amount, account_id: form.from,
            to_account_id: form.to, description: form.description || null,
            created_by: userId, staff_name: staffName,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Transfer recorded");
            setSheetOpen(false);
            onRefresh();
        }
    };
    const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={() => { setForm({ from: "", to: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" }); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Transfer
        </Button>
      </Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={6} empty={transactions.length === 0} emptyMessage={"No transfers"}>
          <TableHead><TableRow><TableCell>ID</TableCell><TableCell>Date</TableCell><TableCell>From</TableCell><TableCell>To</TableCell><TableCell sx={{ textAlign: "right" }}>Amount</TableCell><TableCell>Staff</TableCell></TableRow></TableHead>
          <TableBody>{transactions.map(t => (<TableRow key={t.id}>
                <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{t.transaction_id}</TableCell>
                <TableCell>{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                <TableCell>{acctName(t.account_id)}</TableCell>
                <TableCell>{acctName(t.to_account_id)}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>₹{t.amount.toLocaleString()}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{t.staff_name || "—"}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>
      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={"New Transfer"} description={"Move funds between accounts"}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} label={"Date"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.from} label={"From Account *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, from: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select"}</MenuItem>{accounts.filter(a => a.status === "active").map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.to} label={"To Account *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, to: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select"}</MenuItem>{accounts.filter(a => a.status === "active").map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} label={"Description"} size="small" fullWidth multiline/></Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>Transfer</Button>
          </Box>
        </FormDialog>
    </Box>);
}
// ─── Accounts Tab ─────────────────────────────
function AccountsTab({ accounts, userId, onRefresh }: {
    accounts: FinanceAccount[];
    userId?: string;
    onRefresh: () => void;
}) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState({ name: "", type: "cash", account_number: "", bank_name: "", opening_balance: "" });
    const handleSave = async () => {
        if (!form.name) {
            toast.error("Enter account name");
            return;
        }
        const ob = parseFloat(form.opening_balance) || 0;
        const { error } = await supabase.from("finance_accounts").insert({
            name: form.name, type: form.type, account_number: form.account_number || null,
            bank_name: form.bank_name || null, opening_balance: ob, current_balance: ob,
            created_by: userId,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Account created");
            setSheetOpen(false);
            onRefresh();
        }
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={() => { setForm({ name: "", type: "cash", account_number: "", bank_name: "", opening_balance: "" }); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add Account
        </Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
        {accounts.map(a => (<StatCard label={a.name} caption={[a.bank_name, a.account_number].filter(Boolean).join(" • ") || a.type} value={a.current_balance} formatter={amount => "\u20B9" + amount.toLocaleString()} key={a.id}/>))}
        {accounts.length === 0 && <Typography component="p" variant="body1" sx={{ gridColumn: "1 / -1", textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "2rem", paddingBottom: "2rem" }}>No accounts yet. Create one to start tracking.</Typography>}
      </Box>
      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={"Add Account"} description={"Create a new financial account"}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Account Name *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{["cash", "bank", "upi", "gateway"].map(t => <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>{t}</MenuItem>)}</TextField>
            </Box>
            {(form.type === "bank") && <>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} label={"Bank Name"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} label={"Account Number"} size="small" fullWidth/></Box>
            </>}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))} label={"Opening Balance"} size="small" fullWidth/></Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>Create Account</Button>
          </Box>
        </FormDialog>
    </Box>);
}
// ─── Categories Tab ───────────────────────────
function CategoriesTab({ categories, onRefresh }: {
    categories: FinanceCategory[];
    onRefresh: () => void;
}) {
    const [newName, setNewName] = useState("");
    const [newType, setNewType] = useState<"income" | "expense">("income");
    const handleAdd = async () => {
        if (!newName.trim()) {
            toast.error("Enter category name");
            return;
        }
        const { error } = await supabase.from("finance_categories").insert({ name: newName.trim(), type: newType });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Category added");
            setNewName("");
            onRefresh();
        }
    };
    const incCats = categories.filter(c => c.type === "income");
    const expCats = categories.filter(c => c.type === "expense");
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <Box sx={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
        <Box sx={{ flex: "1 1 0%", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category" label={"Category Name"} size="small" fullWidth/></Box>
        <TextField value={newType} select size="small" fullWidth onChange={event => (v => setNewType(v as any))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "130px" }}><MenuItem value="income">Income</MenuItem><MenuItem value="expense">Expense</MenuItem></TextField>
        <Button onClick={handleAdd} variant="contained">Add</Button>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--success))" })}>Income Categories</Typography></Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
            {incCats.map(c => <Box key={c.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderBottomWidth: "1px", "&:last-child": { borderWidth: "0px" } }}><Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{c.name}</Box><StatusChip label={"income"} variant="outlined" sx={{ color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }}/></Box>)}
          </CardContent>
        </Card>
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--destructive))" })}>Expense Categories</Typography></Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
            {expCats.map(c => <Box key={c.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderBottomWidth: "1px", "&:last-child": { borderWidth: "0px" } }}><Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{c.name}</Box><StatusChip label={"expense"} variant="outlined" sx={{ color: "hsl(var(--destructive))", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 30%, transparent)" }}/></Box>)}
          </CardContent>
        </Card>
      </Box>
    </Box>);
}
// ─── Ledger Tab ───────────────────────────────
function LedgerTab({ transactions, accounts, categories }: {
    transactions: FinanceTransaction[];
    accounts: FinanceAccount[];
    categories: FinanceCategory[];
}) {
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const filtered = transactions.filter(t => {
        if (typeFilter !== "all" && t.type !== typeFilter)
            return false;
        if (search && !t.transaction_id.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });
    const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";
    const catName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";
    const exportCSV = () => {
        const header = "Date,ID,Type,Category,Account,Amount,Staff,Reference,Balance\n";
        const rows = filtered.map(t => `${t.date},${t.transaction_id},${t.type},${catName(t.category_id)},${acctName(t.account_id)},${t.amount},${t.staff_name || ""},${t.reference || ""},${t.balance_after || ""}`).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={typeFilter} select size="small" fullWidth onChange={event => setTypeFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}><MenuItem value="all">All Types</MenuItem><MenuItem value="income">Income</MenuItem><MenuItem value="expense">Expense</MenuItem><MenuItem value="transfer">Transfer</MenuItem></TextField>
        <Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button>
      </Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={9} empty={filtered.length === 0} emptyMessage={"No transactions"}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>ID</TableCell><TableCell>Type</TableCell>
              <TableCell>Category</TableCell><TableCell>Account</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Amount</TableCell><TableCell>Staff</TableCell>
              <TableCell>Reference</TableCell><TableCell sx={{ textAlign: "right" }}>Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{filtered.map(t => (<TableRow key={t.id}>
                <TableCell>{format(new Date(t.date), "dd MMM")}</TableCell>
                <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{t.transaction_id}</TableCell>
                <TableCell><StatusChip label={t.type} variant="outlined" sx={t.type === "income" ? { color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" } : t.type === "expense" ? { color: "hsl(var(--destructive))", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 30%, transparent)" } : { color: "hsl(var(--primary))", borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)" }}/></TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{catName(t.category_id)}</TableCell>
                <TableCell>{acctName(t.account_id)}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>₹{t.amount.toLocaleString()}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{t.staff_name || "—"}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{t.reference || "—"}</TableCell>
                <TableCell sx={{ textAlign: "right" }}>{t.balance_after != null ? `₹${t.balance_after.toLocaleString()}` : "—"}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>
    </Box>);
}
// ─── Cash Control Tab (Advanced) ──────────────
const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
function CashControlTab({ records, staffName, userId, onRefresh }: {
    records: CashControl[];
    staffName: string;
    userId?: string;
    onRefresh: () => void;
}) {
    const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "custom">("today");
    const [openSheetOpen, setOpenSheetOpen] = useState(false);
    const [closeSheetOpen, setCloseSheetOpen] = useState(false);
    const [openingCash, setOpeningCash] = useState("");
    const [closingCash, setClosingCash] = useState("");
    const [closingNotes, setClosingNotes] = useState("");
    const [openDenoms, setOpenDenoms] = useState<Record<number, string>>({});
    const [closeDenoms, setCloseDenoms] = useState<Record<number, string>>({});
    const [manualIncome, setManualIncome] = useState("");
    const [manualExpense, setManualExpense] = useState("");
    const [incomeRef, setIncomeRef] = useState("");
    const [expenseRef, setExpenseRef] = useState("");
    const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);
    const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
    const today = format(new Date(), "yyyy-MM-dd");
    const todayRecord = records.find(r => r.date === today);
    const isDayOpen = todayRecord?.status === "open";
    const isDayClosed = todayRecord?.status === "closed";
    const denomTotal = (denoms: Record<number, string>) => DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(denoms[d] || "0") || 0), 0);
    const handleOpenDay = async () => {
        const oc = denomTotal(openDenoms) || parseFloat(openingCash) || 0;
        if (oc <= 0) {
            toast.error("Enter valid opening cash");
            return;
        }
        const { error } = await supabase.from("daily_cash_control").insert({
            date: today, opening_cash: oc, status: "open",
            staff_name: staffName, created_by: userId,
            denominations: { opening: openDenoms },
        });
        if (error) {
            if (error.code === "23505")
                toast.error("Day already opened");
            else
                toast.error(error.message);
        }
        else {
            await supabase.from("finance_audit_log").insert({
                action: "DAY_OPENED", entity_type: "cash_control",
                details: `Day opened with ₹${oc.toLocaleString()}`,
                staff_name: staffName, user_id: userId,
            });
            toast.success("Day opened");
            setOpenSheetOpen(false);
            onRefresh();
        }
    };
    const handleCloseDay = async () => {
        if (!todayRecord)
            return;
        const cc = denomTotal(closeDenoms) || parseFloat(closingCash) || 0;
        if (cc <= 0) {
            toast.error("Enter valid closing cash");
            return;
        }
        const expected = todayRecord.opening_cash + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0);
        const diff = cc - expected;
        if (Math.abs(diff) > 100 && !closingNotes.trim()) {
            toast.error("Notes required when variance exceeds ₹100");
            return;
        }
        const { error } = await supabase.from("daily_cash_control").update({
            closing_cash: cc, difference: diff, expected_closing: expected,
            status: "closed", closed_by: userId, closed_at: new Date().toISOString(),
            notes: closingNotes || null,
            denominations: { ...(todayRecord.denominations || {}), closing: closeDenoms },
        }).eq("id", todayRecord.id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("finance_audit_log").insert({
                action: "DAY_CLOSED", entity_type: "cash_control",
                details: `Day closed. Expected: ₹${expected.toLocaleString()}, Actual: ₹${cc.toLocaleString()}, Variance: ₹${diff.toLocaleString()}`,
                staff_name: staffName, user_id: userId,
            });
            toast.success("Day closed");
            setCloseSheetOpen(false);
            onRefresh();
        }
    };
    const addManualEntry = async (type: "income" | "expense") => {
        if (!todayRecord || todayRecord.status !== "open") {
            toast.error("Open the day first");
            return;
        }
        const amt = parseFloat(type === "income" ? manualIncome : manualExpense) || 0;
        const ref = type === "income" ? incomeRef : expenseRef;
        if (amt <= 0) {
            toast.error("Enter valid amount");
            return;
        }
        const field = type === "income" ? "manual_income" : "manual_expense";
        const current = type === "income" ? (todayRecord.manual_income || 0) : (todayRecord.manual_expense || 0);
        const { error } = await supabase.from("daily_cash_control").update({
            [field]: current + amt,
        }).eq("id", todayRecord.id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("finance_audit_log").insert({
                action: `MANUAL_${type.toUpperCase()}`, entity_type: "cash_control",
                details: `Manual ${type}: ₹${amt.toLocaleString()} | Ref: ${ref || "N/A"}`,
                staff_name: staffName, user_id: userId,
            });
            toast.success(`${type === "income" ? "Income" : "Expense"} recorded`);
            if (type === "income") {
                setManualIncome("");
                setIncomeRef("");
                setIncomeSheetOpen(false);
            }
            else {
                setManualExpense("");
                setExpenseRef("");
                setExpenseSheetOpen(false);
            }
            onRefresh();
        }
    };
    // Filter records by date
    const filteredRecords = records.filter(r => {
        if (dateRange === "today")
            return r.date === today;
        if (dateRange === "week") {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            return new Date(r.date) >= d;
        }
        if (dateRange === "month") {
            const d = new Date();
            d.setDate(1);
            return new Date(r.date) >= d;
        }
        return r.date === dateFilter;
    });
    const DenomGrid = ({ denoms, onChange }: {
        denoms: Record<number, string>;
        onChange: (d: Record<number, string>) => void;
    }) => (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem" }}>
      {DENOMINATIONS.map(d => (<Box key={d} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>

          <TextField type="number" value={denoms[d] || ""} onChange={e => onChange({ ...denoms, [d]: e.target.value })} placeholder="0" label={<>₹{d}</>} size="small" fullWidth slotProps={{ htmlInput: { min: "0" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "center" }}/>
        </Box>))}
    </Box>);
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Today's Status Card */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <Card>
          <CardContent sx={{ padding: "1rem" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Status</Typography>
            <StatusChip label={isDayClosed ? "Closed" : isDayOpen ? "Open" : "Not Started"} sx={mergeSx(isDayClosed ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } :
        isDayOpen ? { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}/>
            <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{format(new Date(), "dd MMM yyyy")}</Typography>
          </CardContent>
        </Card>
        <StatCard label={"Opening Cash"} value={(todayRecord?.opening_cash || 0)} formatter={amount => "\u20B9" + amount.toLocaleString()}/>
        <StatCard label={"Expected Closing"} value={todayRecord ? ((todayRecord.opening_cash || 0) + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)).toLocaleString() : "0"} isCurrency/>
        <Card>
          <CardContent sx={{ padding: "1rem" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Variance</Typography>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700" }, todayRecord?.difference != null && todayRecord.difference < 0 ? { color: "hsl(var(--destructive))" } :
        todayRecord?.difference != null && todayRecord.difference > 0 ? { color: "hsl(var(--success))" } : {})}>
              {todayRecord?.difference != null ? `₹${todayRecord.difference.toLocaleString()}` : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {!isDayOpen && !isDayClosed && (<Button onClick={() => { setOpenDenoms({}); setOpeningCash(""); setOpenSheetOpen(true); }} variant="contained">
            <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Open Day
          </Button>)}
        {isDayOpen && (<>
            <Button onClick={() => { setManualIncome(""); setIncomeRef(""); setIncomeSheetOpen(true); }} variant="outlined">
              <Box component={TrendingUp} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Record Income
            </Button>
            <Button onClick={() => { setManualExpense(""); setExpenseRef(""); setExpenseSheetOpen(true); }} variant="outlined">
              <Box component={TrendingDown} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Record Expense
            </Button>
            <Button onClick={() => { setCloseDenoms({}); setClosingCash(""); setClosingNotes(""); setCloseSheetOpen(true); }} variant="contained" sx={{ backgroundColor: "hsl(var(--destructive))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 90%, transparent)" } }}>
              Close Day
            </Button>
          </>)}
      </Box>

      {/* Date Filter */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
        {(["today", "week", "month", "custom"] as const).map(v => (<Button key={v} onClick={() => setDateRange(v)} variant={dateRange === v ? "contained" : "outlined"} size="small" sx={{ textTransform: "capitalize" }}>
            {v === "custom" ? "Custom" : v === "today" ? "Today" : v === "week" ? "7 Days" : "This Month"}
          </Button>))}
        {dateRange === "custom" && (<TextField type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "auto", height: "2.25rem" }}/>)}
      </Box>

      {/* History Table */}
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={10} empty={filteredRecords.length === 0} emptyMessage={"No records for this period"}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Opening</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Income</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Expense</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Expected</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Actual</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Variance</TableCell>
              <TableCell>Staff</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{filteredRecords.map(r => {
        const expected = (r.opening_cash || 0) + (r.manual_income || 0) + (r.pos_total || 0) - (r.manual_expense || 0);
        return (<TableRow key={r.id}>
                  <TableCell sx={{ fontWeight: "500" }}>{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <StatusChip label={r.status || "open"} variant="outlined" sx={mergeSx(r.status === "closed" ? { color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" } : { color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 30%, transparent)" })}/>
                  </TableCell>
                  <TableCell sx={{ textAlign: "right" }}>₹{r.opening_cash.toLocaleString()}</TableCell>
                  <TableCell sx={{ textAlign: "right", color: "hsl(var(--success))" }}>₹{((r.manual_income || 0) + (r.pos_total || 0)).toLocaleString()}</TableCell>
                  <TableCell sx={{ textAlign: "right", color: "hsl(var(--destructive))" }}>₹{(r.manual_expense || 0).toLocaleString()}</TableCell>
                  <TableCell sx={{ textAlign: "right" }}>₹{expected.toLocaleString()}</TableCell>
                  <TableCell sx={{ textAlign: "right" }}>{r.closing_cash != null ? `₹${r.closing_cash.toLocaleString()}` : "—"}</TableCell>
                  <TableCell sx={mergeSx({ textAlign: "right", fontWeight: "500" }, r.difference != null && r.difference < 0 ? { color: "hsl(var(--destructive))" } :
            r.difference != null && r.difference > 0 ? { color: "hsl(var(--success))" } : {})}>
                    {r.difference != null ? `₹${r.difference.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>{r.staff_name || "—"}</TableCell>
                  <TableCell sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "—"}</TableCell>
                </TableRow>);
    })}</TableBody>
        </DataTable>
      </Box>

      {/* Open Day Sheet */}
      <FormDialog open={openSheetOpen} onClose={() => setOpenSheetOpen(false)} title={<>Open Day — {format(new Date(), "dd MMM yyyy")}</>} description={"Enter opening cash or count denominations"} paperSx={{ overflowY: "auto" }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="Or use denominations below" label={"Opening Cash Amount"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Denomination Count (optional)</FormLabel>
              <DenomGrid denoms={openDenoms} onChange={setOpenDenoms}/>
              {denomTotal(openDenoms) > 0 && (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", textAlign: "right" }}>Denomination Total: ₹{denomTotal(openDenoms).toLocaleString()}</Typography>)}
            </Box>
            <Button onClick={handleOpenDay} variant="contained" sx={{ width: "100%" }}>Open Day</Button>
          </Box>
        </FormDialog>

      {/* Close Day Sheet */}
      <FormDialog open={closeSheetOpen} onClose={() => setCloseSheetOpen(false)} title={"Close Day"} description={<>
              Expected: ₹{todayRecord ? ((todayRecord.opening_cash || 0) + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)).toLocaleString() : "0"}
            </>} paperSx={{ overflowY: "auto" }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Or use denominations below" label={"Actual Closing Cash"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Denomination Count (optional)</FormLabel>
              <DenomGrid denoms={closeDenoms} onChange={setCloseDenoms}/>
              {denomTotal(closeDenoms) > 0 && (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", textAlign: "right" }}>Denomination Total: ₹{denomTotal(closeDenoms).toLocaleString()}</Typography>)}
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} placeholder="Explain any variance" label={<>Notes {(() => {
            const cc = denomTotal(closeDenoms) || parseFloat(closingCash) || 0;
            const exp = todayRecord ? (todayRecord.opening_cash + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)) : 0;
            return Math.abs(cc - exp) > 100 ? "(required — variance > ₹100)" : "(optional)";
        })()}</>} size="small" fullWidth multiline/>
            </Box>
            <Button onClick={handleCloseDay} variant="contained" sx={{ width: "100%" }}>Close Day</Button>
          </Box>
        </FormDialog>

      {/* Manual Income Sheet */}
      <FormDialog open={incomeSheetOpen} onClose={() => setIncomeSheetOpen(false)} title={"Record Manual Income"} description={"Link to invoice, job sheet, quotation, or other"}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={manualIncome} onChange={e => setManualIncome(e.target.value)} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={incomeRef} onChange={e => setIncomeRef(e.target.value)} placeholder="INV-00001 / JOB-2026-00001 / QT-00001" label={"Reference (Invoice/Job Sheet/Quote #)"} size="small" fullWidth/>
            </Box>
            <Button onClick={() => addManualEntry("income")} variant="contained" sx={{ width: "100%" }}>Record Income</Button>
          </Box>
        </FormDialog>

      {/* Manual Expense Sheet */}
      <FormDialog open={expenseSheetOpen} onClose={() => setExpenseSheetOpen(false)} title={"Record Manual Expense"} description={"Link to repair, invoice, or other reference"}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={manualExpense} onChange={e => setManualExpense(e.target.value)} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={expenseRef} onChange={e => setExpenseRef(e.target.value)} placeholder="JOB-2026-00001 / Parts purchase / Other" label={"Reference (Repair/Invoice/Other)"} size="small" fullWidth/>
            </Box>
            <Button onClick={() => addManualEntry("expense")} variant="contained" sx={{ width: "100%" }}>Record Expense</Button>
          </Box>
        </FormDialog>
    </Box>);
}
// ─── Audit Log Tab ────────────────────────────
function AuditLogTab({ entries }: {
    entries: AuditEntry[];
}) {
    const [search, setSearch] = useState("");
    const filtered = entries.filter(e => {
        if (!search)
            return true;
        const q = search.toLowerCase();
        return e.action.toLowerCase().includes(q) ||
            e.details?.toLowerCase().includes(q) ||
            e.staff_name?.toLowerCase().includes(q) ||
            e.user_role?.toLowerCase().includes(q) ||
            e.entity_type?.toLowerCase().includes(q) ||
            format(new Date(e.created_at), "dd MMM yyyy HH:mm").toLowerCase().includes(q);
    });
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search actions..." sx={{ maxWidth: "24rem" }}/>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={5} empty={filtered.length === 0} emptyMessage={"No audit entries"}>
          <TableHead><TableRow><TableCell>Timestamp</TableCell><TableCell>Action</TableCell><TableCell>Details</TableCell><TableCell>Staff</TableCell><TableCell>Role</TableCell></TableRow></TableHead>
          <TableBody>{filtered.map(e => (<TableRow key={e.id}>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{format(new Date(e.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell><StatusChip label={e.action} variant="outlined"/></TableCell>
                <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.details || "—"}</TableCell>
                <TableCell>{e.staff_name || "—"}</TableCell>
                <TableCell sx={{ textTransform: "capitalize" }}>{e.user_role || "—"}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>
    </Box>);
}
// ─── Receipt Slip Component ──────────────────
function ReceiptSlip({ transaction, accounts, categories }: {
    transaction: FinanceTransaction;
    accounts: FinanceAccount[];
    categories: FinanceCategory[];
}) {
    const acctName = accounts.find(a => a.id === transaction.account_id)?.name || "—";
    const catName = categories.find(c => c.id === transaction.category_id)?.name || "—";
    const numberToWords = (n: number): string => {
        if (n === 0)
            return "Zero";
        const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        if (n < 20)
            return ones[n];
        if (n < 100)
            return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
        if (n < 1000)
            return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + numberToWords(n % 100) : "");
        if (n < 100000)
            return numberToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numberToWords(n % 1000) : "");
        if (n < 10000000)
            return numberToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numberToWords(n % 100000) : "");
        return numberToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numberToWords(n % 10000000) : "");
    };
    return (<Box id="receipt-slip" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, "@media print": { padding: "1.5rem" } }}>
      <Box sx={{ textAlign: "center", borderBottomWidth: "1px", borderStyle: "dashed", borderColor: "hsl(var(--border))", paddingBottom: "0.75rem" }}>
        <Typography component="h3" variant="h3" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>
          {transaction.type === "income" ? "RECEIPT" : "PAYMENT VOUCHER"}
        </Typography>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>#{transaction.transaction_id}</Typography>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
        <Box>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Date</Typography>
          <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{format(new Date(transaction.date), "dd MMM yyyy")}</Typography>
        </Box>
        <Box>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Payment Mode</Typography>
          <Typography component="p" variant="body1" sx={{ fontWeight: "500", textTransform: "capitalize" }}>{transaction.payment_mode || "—"}</Typography>
        </Box>
        <Box>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Account</Typography>
          <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{acctName}</Typography>
        </Box>
        <Box>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Category</Typography>
          <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{catName}</Typography>
        </Box>
      </Box>

      <Box sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center" }}>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Amount</Typography>
        <Typography component="p" variant="body1" sx={{ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>₹{transaction.amount.toLocaleString()}</Typography>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem", fontStyle: "italic" }}>
          {numberToWords(Math.floor(transaction.amount))} Rupees Only
        </Typography>
      </Box>

      {transaction.reference && (<Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Reference</Typography>
          <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{transaction.reference}</Typography>
        </Box>)}
      {transaction.description && (<Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Description</Typography>
          <Typography component="p" variant="body1">{transaction.description}</Typography>
        </Box>)}
      <Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Recorded By</Typography>
        <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{transaction.staff_name || "—"}</Typography>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", paddingTop: "2rem", borderTopWidth: "1px", borderStyle: "dashed", borderColor: "hsl(var(--border))", marginTop: "1rem" }}>
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ width: "8rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--foreground)) 30%, transparent)", marginTop: "2rem" }}/>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{transaction.type === "income" ? "Received By" : "Paid By"}</Typography>
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Box sx={{ width: "8rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--foreground)) 30%, transparent)", marginTop: "2rem" }}/>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>Authorized Signature</Typography>
        </Box>
      </Box>
    </Box>);
}
