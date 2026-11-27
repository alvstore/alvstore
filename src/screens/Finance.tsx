"use client";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel, FormLabel, IconButton, MenuItem, Switch, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, TabBar, TabPanel, TabView, TrendChart, DistributionWidget, mergeSx, toast, type StatAccent } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    fetchCashControlContext,
    localDateKey,
    normalizeCashDate,
    openCashflowAuditPdf,
    recomputeCashControlDay,
    syncFinanceEvent,
    type CashControlContextResponse,
} from "@/lib/finance-sync";
import { Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Landmark, PiggyBank, Tags, BookOpen, ShieldCheck, Plus, Search, Download, DollarSign, BarChart3, Eye, FileText, RefreshCw, AlertTriangle, CheckCircle2, Lock, Unlock } from "lucide-react";
import { format, startOfMonth } from "date-fns";
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
    entry_source?: string | null;
    source_id?: string | null;
    date: string;
    daily_cash_date?: string | null;
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
    previous_closing?: number | null;
    opening_override_reason?: string | null;
    closing_cash: number | null;
    difference: number | null;
    staff_name: string | null;
    status: string | null;
    denominations: any;
    pos_total: number | null;
    auto_income?: number | null;
    manual_income: number | null;
    auto_expense?: number | null;
    manual_expense: number | null;
    transfer_in?: number | null;
    transfer_out?: number | null;
    expected_closing: number | null;
    notes: string | null;
    closed_at: string | null;
    closed_by: string | null;
    reopened_at?: string | null;
    reopened_by?: string | null;
    created_by: string | null;
}
export default function Finance() {
    const { user, hasRole } = useAuth();
    const isAdmin = hasRole("admin");
    const [activeTab, setActiveTab] = useState("dashboard");
    // ─── Shared data ──────────────────────────────
    const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
    const [categories, setCategories] = useState<FinanceCategory[]>([]);
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [cashRecords, setCashRecords] = useState<CashControl[]>([]);
    const [cashContext, setCashContext] = useState<CashControlContextResponse | null>(null);
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
            const todayKey = localDateKey();
            const [accRes, catRes, txRes, auditRes, cashRes, ctx] = await Promise.all([
                supabase.from("finance_accounts").select("*").order("created_at", { ascending: false }),
                supabase.from("finance_categories").select("*").order("name"),
                supabase.from("finance_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
                supabase.from("finance_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
                supabase.from("daily_cash_control").select("*").order("date", { ascending: false }),
                fetchCashControlContext(todayKey),
            ]);
            for (const result of [accRes, catRes, txRes, auditRes, cashRes]) if (result.error) throw new Error(result.error.message);
            setAccounts(accRes.data ?? []);
            setCategories(catRes.data ?? []);
            setTransactions(txRes.data ?? []);
            setAuditLog(auditRes.data ?? []);
            setCashRecords(cashRes.data ?? []);
            setCashContext(ctx);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : "Finance data could not be loaded");
        } finally { setLoading(false); }
    };
    useEffect(() => { fetchAll(); }, []);
    // ─── KPI Calculations ─────────────────────────
    const today = new Date();
    const todayStr = localDateKey(today);
    const monthStart = localDateKey(startOfMonth(today));
    const cashBalance = accounts.filter(a => a.type === "cash").reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const bankBalance = accounts.filter(a => a.type === "bank").reduce((s, a) => s + Number(a.current_balance || 0), 0);
    const todayIncome = transactions.filter(t => t.type === "income" && normalizeCashDate(t.date) === todayStr).reduce((s, t) => s + Number(t.amount || 0), 0);
    const todayExpense = transactions.filter(t => t.type === "expense" && normalizeCashDate(t.date) === todayStr).reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthlyIncome = transactions.filter(t => t.type === "income" && normalizeCashDate(t.date) >= monthStart && normalizeCashDate(t.date) <= todayStr).reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthlyExpense = transactions.filter(t => t.type === "expense" && normalizeCashDate(t.date) >= monthStart && normalizeCashDate(t.date) <= todayStr).reduce((s, t) => s + Number(t.amount || 0), 0);
    const netBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
    // ─── Chart Data ───────────────────────────────
    const cashflowSeries = useMemo(() => [
        { id: "income", label: "Income", color: "success" as const, values: transactions.filter(t => t.type === "income").map(t => ({ date: normalizeCashDate(t.date), value: Number(t.amount) })) },
        { id: "expense", label: "Expenses", color: "warning" as const, increaseIsGood: false, values: transactions.filter(t => t.type === "expense").map(t => ({ date: normalizeCashDate(t.date), value: Number(t.amount) })) },
    ], [transactions]);
    const categoryChart = useMemo(() => {
        const map: Record<string, number> = {};
        transactions.filter(t => t.type === "expense" && normalizeCashDate(t.date) >= monthStart && normalizeCashDate(t.date) <= todayStr).forEach(t => {
            const cat = categories.find(c => c.id === t.category_id);
            const name = cat?.name || "Uncategorized";
            map[name] = (map[name] || 0) + Number(t.amount || 0);
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
          <CashControlTab
            records={cashRecords}
            transactions={transactions}
            accounts={accounts}
            categories={categories}
            auditLog={auditLog}
            cashContext={cashContext}
            isAdmin={isAdmin}
            staffName={staffName}
            userId={user?.id}
            onRefresh={fetchAll}
          />
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
    const [sourceFilter, setSourceFilter] = useState<"all" | "auto" | "manual">("all");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const weekAgoKey = localDateKey(new Date(Date.now() - 7 * 86400000));
    const todayKey = localDateKey();
    const monthStartKey = localDateKey(startOfMonth(new Date()));
    const filtered = transactions.filter(t => {
        if (t.type !== type)
            return false;
        const src = t.entry_source || "manual";
        if (sourceFilter === "manual" && src !== "manual")
            return false;
        if (sourceFilter === "auto" && src === "manual")
            return false;
        const dk = normalizeCashDate(t.date);
        // Date filter
        if (dateFilter === "today" && dk !== todayKey)
            return false;
        if (dateFilter === "7days" && dk < weekAgoKey)
            return false;
        if (dateFilter === "month" && dk < monthStartKey)
            return false;
        if (dateFilter === "custom" && customFrom && dk < customFrom)
            return false;
        if (dateFilter === "custom" && customTo && dk > customTo)
            return false;
        // Search filter
        if (search) {
            const q = search.toLowerCase();
            return t.transaction_id.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.staff_name?.toLowerCase().includes(q) ||
                t.reference?.toLowerCase().includes(q) ||
                src.toLowerCase().includes(q) ||
                t.payment_mode?.toLowerCase().includes(q) ||
                format(new Date(`${dk}T00:00:00`), "dd MMM yyyy").toLowerCase().includes(q) ||
                String(t.amount).includes(q);
        }
        return true;
    });
    const [form, setForm] = useState({
        date: localDateKey(), amount: "", payment_mode: "cash",
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
        const syncRes = await syncFinanceEvent({
            entry_source: "manual",
            type,
            date: form.date,
            amount,
            payment_mode: form.payment_mode,
            account_id: form.account_id,
            category_id: form.category_id || null,
            reference: form.reference || null,
            description: form.description || null,
            staff_name: staffName,
        });
        if (!syncRes.ok)
            toast.error(syncRes.error || "Failed to record transaction");
        else {
            toast.success(`${type === "income" ? "Income" : "Expense"} recorded & cash drawer updated`);
            setSheetOpen(false);
            onRefresh();
        }
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, gap: "0.75rem" }}>
          <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search ID, source, date, amount, ref, staff..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
          <Button onClick={() => { setForm({ date: localDateKey(), amount: "", payment_mode: "cash", account_id: "", category_id: "", customer_name: "", reference: "", description: "" }); setSheetOpen(true); }} variant="contained">
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
          <TextField value={sourceFilter} select size="small" onChange={e => setSourceFilter(e.target.value as any)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150, ml: { sm: "auto" } }}>
            <MenuItem value="all">All Sources</MenuItem>
            <MenuItem value="auto">Auto-Recorded</MenuItem>
            <MenuItem value="manual">Manual Only</MenuItem>
          </TextField>
          {dateFilter === "custom" && (<>
              <TextField type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "9rem" }}/>
              <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>to</Box>
              <TextField type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "9rem" }}/>
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

      {/* Receipt Drawer */}
      <SideDrawer
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title={"Receipt Slip"}
        width={460}
        footer={
          <>
            <Button variant="outlined" onClick={() => setReceiptOpen(false)} sx={{ minHeight: 36 }}>Close</Button>
            <Button onClick={() => window.print()} variant="contained" size="small" sx={{ minHeight: 36 }}>
              <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Print / PDF
            </Button>
          </>
        }
        paperSx={{ "@media print": { maxWidth: "100%", "--alv-shadow": "0 0 #0000", "--alv-shadow-colored": "0 0 #0000", boxShadow: "none" } }}
      >
          {receiptTx && (<ReceiptSlip transaction={receiptTx} accounts={accounts} categories={categories}/>)}
        </SideDrawer>

      <SideDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={<>Add {type === "income" ? "Income" : "Expense"}</>}
        description={<>Staff: {staffName}</>}
        width={460}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" sx={{ minHeight: 36 }}>Save</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} label={"Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/></Box>
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
          </Box>
        </SideDrawer>
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
            type: "transfer", date: form.date, daily_cash_date: form.date, amount, account_id: form.from,
            to_account_id: form.to, description: form.description || null,
            created_by: userId, staff_name: staffName,
        });
        if (error)
            toast.error(error.message);
        else {
            await recomputeCashControlDay({ date: form.date }).catch(() => {});
            toast.success("Transfer recorded & cash drawer synced");
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
      <SideDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={"New Transfer"}
        description={"Move funds between accounts"}
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" sx={{ minHeight: 36 }}>Transfer</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} label={"Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.from} label={"From Account *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, from: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select"}</MenuItem>{accounts.filter(a => a.status === "active").map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.to} label={"To Account *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, to: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select"}</MenuItem>{accounts.filter(a => a.status === "active").map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} label={"Amount *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} label={"Description"} size="small" fullWidth multiline/></Box>
          </Box>
        </SideDrawer>
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
      <SideDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={"Add Account"}
        description={"Create a new financial account"}
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" sx={{ minHeight: 36 }}>Create Account</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Account Name *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{["cash", "bank", "upi", "gateway"].map(t => <MenuItem key={t} value={t} sx={{ textTransform: "capitalize" }}>{t}</MenuItem>)}</TextField>
            </Box>
            {(form.type === "bank") && <>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} label={"Bank Name"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} label={"Account Number"} size="small" fullWidth/></Box>
            </>}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))} label={"Opening Balance"} size="small" fullWidth/></Box>
          </Box>
        </SideDrawer>
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
    const [sourceFilter, setSourceFilter] = useState("all");
    const filtered = transactions.filter(t => {
        if (typeFilter !== "all" && t.type !== typeFilter)
            return false;
        const src = t.entry_source || "manual";
        if (sourceFilter === "manual" && src !== "manual")
            return false;
        if (sourceFilter === "auto" && src === "manual")
            return false;
        if (search) {
            const q = search.toLowerCase();
            return t.transaction_id.toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q) ||
                (t.reference || "").toLowerCase().includes(q) ||
                (t.staff_name || "").toLowerCase().includes(q) ||
                src.toLowerCase().includes(q);
        }
        return true;
    });
    const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";
    const catName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";
    const exportCSV = () => {
        const header = "Date,ID,Type,Source,Category,Account,Mode,Amount,Staff,Reference,Balance\n";
        const rows = filtered.map(t => [
            normalizeCashDate(t.date), t.transaction_id, t.type, t.entry_source || "manual",
            catName(t.category_id), acctName(t.account_id), t.payment_mode || "", t.amount,
            t.staff_name || "", t.reference || "", t.balance_after ?? ""
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ledger-${localDateKey()}.csv`;
        a.click();
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center" }, gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search ID, ref, source, description, staff..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={typeFilter} select size="small" onChange={event => setTypeFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: 140 }}><MenuItem value="all">All Types</MenuItem><MenuItem value="income">Income</MenuItem><MenuItem value="expense">Expense</MenuItem><MenuItem value="transfer">Transfer</MenuItem></TextField>
        <TextField value={sourceFilter} select size="small" onChange={event => setSourceFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: 150 }}><MenuItem value="all">All Sources</MenuItem><MenuItem value="auto">Auto-Recorded</MenuItem><MenuItem value="manual">Manual Only</MenuItem></TextField>
        <Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button>
      </Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={10} empty={filtered.length === 0} emptyMessage={"No transactions"}>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>ID</TableCell><TableCell>Type</TableCell><TableCell>Source</TableCell>
              <TableCell>Category</TableCell><TableCell>Account</TableCell>
              <TableCell sx={{ textAlign: "right" }}>Amount</TableCell><TableCell>Staff</TableCell>
              <TableCell>Reference</TableCell><TableCell sx={{ textAlign: "right" }}>Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{filtered.map(t => (<TableRow key={t.id}>
                <TableCell>{format(new Date(`${normalizeCashDate(t.date)}T00:00:00`), "dd MMM yy")}</TableCell>
                <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{t.transaction_id}</TableCell>
                <TableCell><StatusChip label={t.type} variant="outlined" sx={t.type === "income" ? { color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" } : t.type === "expense" ? { color: "hsl(var(--destructive))", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 30%, transparent)" } : { color: "hsl(var(--primary))", borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)" }}/></TableCell>
                <TableCell><StatusChip label={(t.entry_source || "manual").replace(/_/g, " ")} size="small" variant="outlined" sx={{ textTransform: "capitalize", fontSize: "10px" }}/></TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{catName(t.category_id)}</TableCell>
                <TableCell>{acctName(t.account_id)}</TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "500", fontVariantNumeric: "tabular-nums" }}>₹{t.amount.toLocaleString()}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{t.staff_name || "—"}</TableCell>
                <TableCell sx={{ color: "hsl(var(--muted-foreground))" }}>{t.reference || "—"}</TableCell>
                <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{t.balance_after != null ? `₹${t.balance_after.toLocaleString()}` : "—"}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>
    </Box>);
}
// ─── Cash Control Tab (Carry-Forward, Auto + Manual Sync & Audit) ──────────────
const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

function DenomGrid({ denoms, onChange }: {
    denoms: Record<number, string>;
    onChange: (d: Record<number, string>) => void;
}) {
    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem" }}>
        {DENOMINATIONS.map(d => (
          <TextField
            key={d}
            type="number"
            value={denoms[d] || ""}
            onChange={e => onChange({ ...denoms, [d]: e.target.value })}
            placeholder="0"
            label={`₹${d}`}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { min: "0" } }}
            sx={{ fontSize: "0.75rem", textAlign: "center" }}
          />
        ))}
      </Box>
    );
}

function calcExpectedClosing(r: CashControl): number {
    return (
        Number(r.opening_cash || 0) +
        Number(r.pos_total || 0) +
        Number(r.auto_income || 0) +
        Number(r.manual_income || 0) +
        Number(r.transfer_in || 0) -
        Number(r.auto_expense || 0) -
        Number(r.manual_expense || 0) -
        Number(r.transfer_out || 0)
    );
}

function CashControlTab({
    records,
    transactions,
    accounts,
    categories,
    auditLog,
    cashContext,
    isAdmin,
    staffName,
    userId,
    onRefresh,
}: {
    records: CashControl[];
    transactions: FinanceTransaction[];
    accounts: FinanceAccount[];
    categories: FinanceCategory[];
    auditLog: AuditEntry[];
    cashContext: CashControlContextResponse | null;
    isAdmin: boolean;
    staffName: string;
    userId?: string;
    onRefresh: () => void;
}) {
    const today = localDateKey();
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all" | "custom">("month");
    const [customFrom, setCustomFrom] = useState(() => localDateKey(startOfMonth(new Date())));
    const [customTo, setCustomTo] = useState(today);
    const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
    const [sourceFilter, setSourceFilter] = useState<"all" | "auto" | "manual">("all");
    const [search, setSearch] = useState("");

    const [openSheetOpen, setOpenSheetOpen] = useState(false);
    const [closeSheetOpen, setCloseSheetOpen] = useState(false);
    const [openingCash, setOpeningCash] = useState("");
    const [overrideOpening, setOverrideOpening] = useState(false);
    const [overrideReason, setOverrideReason] = useState("");
    const [closingCash, setClosingCash] = useState("");
    const [closingNotes, setClosingNotes] = useState("");
    const [openDenoms, setOpenDenoms] = useState<Record<number, string>>({});
    const [closeDenoms, setCloseDenoms] = useState<Record<number, string>>({});

    const [manualIncome, setManualIncome] = useState("");
    const [manualExpense, setManualExpense] = useState("");
    const [incomeCatId, setIncomeCatId] = useState("");
    const [expenseCatId, setExpenseCatId] = useState("");
    const [incomeRef, setIncomeRef] = useState("");
    const [expenseRef, setExpenseRef] = useState("");
    const [incomeDesc, setIncomeDesc] = useState("");
    const [expenseDesc, setExpenseDesc] = useState("");
    const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);
    const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);

    const [inspectRecord, setInspectRecord] = useState<CashControl | null>(null);
    const [drawerSourceFilter, setDrawerSourceFilter] = useState<"all" | "auto" | "manual">("all");
    const [reopenReason, setReopenReason] = useState("");
    const [reopening, setReopening] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);

    const todayRecord = records.find(r => normalizeCashDate(r.date) === today);
    const isDayOpen = todayRecord?.status === "open";
    const isDayClosed = todayRecord?.status === "closed";
    const denomTotal = (denoms: Record<number, string>) => DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(denoms[d] || "0") || 0), 0);

    const suggestedOpening = cashContext?.suggestedOpening ?? (() => {
        const prev = records.find(r => normalizeCashDate(r.date) < today);
        return prev ? Number(prev.closing_cash ?? prev.expected_closing ?? prev.opening_cash ?? 0) : 0;
    })();
    const prevDay = cashContext?.previousDay ?? null;

    const openDayDrawer = () => {
        setOpenDenoms({});
        setOpeningCash(String(suggestedOpening));
        setOverrideOpening(false);
        setOverrideReason("");
        setOpenSheetOpen(true);
    };

    const handleOpenDay = async () => {
        const denomSum = denomTotal(openDenoms);
        const parsed = denomSum > 0 ? denomSum : Number(openingCash || 0);
        if (!Number.isFinite(parsed) || parsed < 0) {
            toast.error("Enter valid opening cash (0 or greater)");
            return;
        }
        const delta = Math.abs(parsed - suggestedOpening);
        if (delta >= 0.01 && prevDay && !overrideReason.trim()) {
            toast.error("Enter a reason when overriding carried-forward opening balance");
            return;
        }

        const { error } = await supabase.from("daily_cash_control").insert({
            date: today,
            opening_cash: parsed,
            previous_closing: prevDay ? suggestedOpening : null,
            opening_override_reason: delta >= 0.01 ? overrideReason.trim() || null : null,
            status: "open",
            staff_name: staffName,
            created_by: userId,
            denominations: { opening: openDenoms },
        });
        if (error) {
            if (error.code === "23505")
                toast.error("Day already opened");
            else
                toast.error(error.message);
        } else {
            await recomputeCashControlDay({ date: today }).catch(() => {});
            await supabase.from("finance_audit_log").insert({
                action: "DAY_OPENED",
                entity_type: "cash_control",
                details: `Day opened with ₹${parsed.toLocaleString("en-IN")}${prevDay ? ` (Carried from ${prevDay.date}: ₹${suggestedOpening.toLocaleString("en-IN")})` : ""}${overrideReason.trim() ? ` · Override: ${overrideReason.trim()}` : ""}`,
                staff_name: staffName,
                user_id: userId,
            });
            toast.success("Day opened with carried-forward balance");
            setOpenSheetOpen(false);
            onRefresh();
        }
    };

    const handleCloseDay = async () => {
        if (!todayRecord)
            return;
        const denomSum = denomTotal(closeDenoms);
        const cc = denomSum > 0 ? denomSum : Number(closingCash || 0);
        if (!Number.isFinite(cc) || cc < 0 || (denomSum === 0 && closingCash.trim() === "")) {
            toast.error("Enter valid closing cash count (0 or greater)");
            return;
        }
        const expected = calcExpectedClosing(todayRecord);
        const diff = Math.round((cc - expected) * 100) / 100;
        if (Math.abs(diff) > 100 && !closingNotes.trim()) {
            toast.error("Notes required when variance exceeds ₹100");
            return;
        }
        const { error } = await supabase.from("daily_cash_control").update({
            closing_cash: cc,
            difference: diff,
            expected_closing: expected,
            status: "closed",
            closed_by: userId,
            closed_at: new Date().toISOString(),
            notes: closingNotes || null,
            denominations: { ...(todayRecord.denominations || {}), closing: closeDenoms },
        }).eq("id", todayRecord.id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("finance_audit_log").insert({
                action: "DAY_CLOSED",
                entity_type: "cash_control",
                details: `Day closed. Expected: ₹${expected.toLocaleString("en-IN")}, Actual: ₹${cc.toLocaleString("en-IN")}, Variance: ₹${diff.toLocaleString("en-IN")}`,
                staff_name: staffName,
                user_id: userId,
            });
            toast.success("Day closed — closing balance ready for next day carry-forward");
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
        const desc = type === "income" ? incomeDesc : expenseDesc;
        const catId = type === "income" ? incomeCatId : expenseCatId;
        if (amt <= 0) {
            toast.error("Enter valid amount");
            return;
        }
        const syncRes = await syncFinanceEvent({
            entry_source: "manual",
            type,
            amount: amt,
            date: today,
            payment_mode: "cash",
            category_id: catId || null,
            category_name: catId ? undefined : type === "income" ? "Other Income" : "Misc Expense",
            reference: ref || null,
            description: desc || `Cash Control manual ${type}`,
            staff_name: staffName,
        });
        if (!syncRes.ok) {
            toast.error(syncRes.error || `Failed to record ${type}`);
            return;
        }
        toast.success(`Manual cash ${type} recorded into Ledger & Cash Control`);
        if (type === "income") {
            setManualIncome("");
            setIncomeRef("");
            setIncomeDesc("");
            setIncomeCatId("");
            setIncomeSheetOpen(false);
        } else {
            setManualExpense("");
            setExpenseRef("");
            setExpenseDesc("");
            setExpenseCatId("");
            setExpenseSheetOpen(false);
        }
        onRefresh();
    };

    const handleRecomputeToday = async () => {
        try {
            await recomputeCashControlDay({ date: today, allow_create: false });
            toast.success("Cash drawer synced with latest ledger activity");
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || "Sync failed");
        }
    };

    const handleReopenDay = async (record: CashControl) => {
        if (!reopenReason.trim()) {
            toast.error("Enter a reason to reopen this closed day");
            return;
        }
        setReopening(true);
        try {
            await recomputeCashControlDay({
                date: normalizeCashDate(record.date),
                reopen: true,
                reason: reopenReason.trim(),
            });
            toast.success("Day reopened & totals refreshed");
            setReopenReason("");
            setInspectRecord(null);
            onRefresh();
        } catch (err: any) {
            toast.error(err.message || "Failed to reopen day");
        } finally {
            setReopening(false);
        }
    };

    const postVarianceAdjustment = async (record: CashControl) => {
        const diff = Number(record.difference || 0);
        if (Math.abs(diff) < 0.01) return;
        const absAmt = Math.abs(diff);
        const type = diff > 0 ? "income" : "expense";
        const res = await syncFinanceEvent({
            entry_source: "manual",
            source_id: `varadj:${record.id}:${Math.round(diff * 100)}`,
            type,
            amount: absAmt,
            date: normalizeCashDate(record.date),
            payment_mode: "cash",
            category_name: type === "income" ? "Other Income" : "Misc Expense",
            reference: `VARIANCE-${normalizeCashDate(record.date)}`,
            description: `Cash count variance reconciliation (${diff > 0 ? "excess" : "short"} ₹${absAmt})`,
            staff_name: staffName,
        });
        if (!res.ok) {
            toast.error(res.error || "Adjustment failed");
            return;
        }
        toast.success("Variance adjustment posted to Cash Account");
        setInspectRecord(null);
        onRefresh();
    };

    // Range computation
    const weekAgoKey = localDateKey(new Date(Date.now() - 7 * 86400000));
    const monthStartKey = localDateKey(startOfMonth(new Date()));
    const reportRange = useMemo(() => {
        if (dateRange === "today") return { from: today, to: today };
        if (dateRange === "week") return { from: weekAgoKey, to: today };
        if (dateRange === "month") return { from: monthStartKey, to: today };
        if (dateRange === "all") {
            const oldest = records.length ? normalizeCashDate(records[records.length - 1].date) : monthStartKey;
            return { from: oldest, to: today };
        }
        return { from: customFrom || monthStartKey, to: customTo || today };
    }, [dateRange, customFrom, customTo, monthStartKey, weekAgoKey, today, records]);

    const filteredRecords = records.filter(r => {
        const dk = normalizeCashDate(r.date);
        if (dateRange === "today" && dk !== today) return false;
        if (dateRange === "week" && dk < weekAgoKey) return false;
        if (dateRange === "month" && dk < monthStartKey) return false;
        if (dateRange === "custom" && customFrom && dk < customFrom) return false;
        if (dateRange === "custom" && customTo && dk > customTo) return false;
        if (statusFilter !== "all" && (r.status || "open") !== statusFilter) return false;
        if (sourceFilter === "auto") {
            const hasAuto = Number(r.pos_total || 0) + Number(r.auto_income || 0) + Number(r.auto_expense || 0) + Number(r.transfer_in || 0) + Number(r.transfer_out || 0) > 0;
            if (!hasAuto) return false;
        }
        if (sourceFilter === "manual") {
            const hasMan = Number(r.manual_income || 0) + Number(r.manual_expense || 0) > 0;
            if (!hasMan) return false;
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            const dayTxs = transactions.filter(t => normalizeCashDate(t.daily_cash_date || t.date) === dk);
            const txMatch = dayTxs.some(t =>
                t.transaction_id.toLowerCase().includes(q) ||
                (t.reference || "").toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q)
            );
            const selfMatch =
                dk.includes(q) ||
                format(new Date(`${dk}T00:00:00`), "dd MMM yyyy").toLowerCase().includes(q) ||
                (r.staff_name || "").toLowerCase().includes(q) ||
                (r.notes || "").toLowerCase().includes(q) ||
                (r.opening_override_reason || "").toLowerCase().includes(q);
            if (!selfMatch && !txMatch) return false;
        }
        return true;
    });

    const todayExpected = todayRecord ? calcExpectedClosing(todayRecord) : suggestedOpening;
    const todayInflows = todayRecord
        ? Number(todayRecord.pos_total || 0) + Number(todayRecord.auto_income || 0) + Number(todayRecord.manual_income || 0) + Number(todayRecord.transfer_in || 0)
        : 0;
    const todayOutflows = todayRecord
        ? Number(todayRecord.auto_expense || 0) + Number(todayRecord.manual_expense || 0) + Number(todayRecord.transfer_out || 0)
        : 0;

    const handleAuditPdf = async (download: boolean) => {
        setPdfLoading(true);
        try {
            await openCashflowAuditPdf({
                fromDate: reportRange.from,
                toDate: reportRange.to,
                entrySource: sourceFilter,
                download,
            });
        } catch (err: any) {
            toast.error(err.message || "PDF generation failed");
        } finally {
            setPdfLoading(false);
        }
    };

    const exportCashCsv = () => {
        const headers = [
            "Date", "Status", "Chain", "Opening", "POS Sales", "Auto Income", "Manual Income",
            "Transfer In", "Auto Expense", "Manual Expense", "Transfer Out", "Expected Closing",
            "Actual Closing", "Variance", "Staff", "Notes",
        ];
        const rows = filteredRecords.map(r => {
            const dk = normalizeCashDate(r.date);
            const chain = cashContext?.chainAudit?.[dk]?.status || "linked";
            const expected = calcExpectedClosing(r);
            return [
                dk, r.status || "open", chain, r.opening_cash, r.pos_total || 0, r.auto_income || 0,
                r.manual_income || 0, r.transfer_in || 0, r.auto_expense || 0, r.manual_expense || 0,
                r.transfer_out || 0, expected, r.closing_cash ?? "", r.difference ?? "", r.staff_name || "", r.notes || "",
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
        });
        const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cash-control-${reportRange.from}-to-${reportRange.to}.csv`;
        a.click();
    };

    const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";
    const catName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";

    const inspectTransactions = useMemo(() => {
        if (!inspectRecord) return [];
        const dk = normalizeCashDate(inspectRecord.date);
        return transactions.filter(t => {
            if (normalizeCashDate(t.daily_cash_date || t.date) !== dk) return false;
            const src = t.entry_source || "manual";
            if (drawerSourceFilter === "auto" && src === "manual") return false;
            if (drawerSourceFilter === "manual" && src !== "manual") return false;
            return true;
        });
    }, [inspectRecord, transactions, drawerSourceFilter]);

    return (
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5, minWidth: 0 }}>
        {/* Continuity Banner when day isn't opened yet */}
        {!isDayOpen && !isDayClosed && (
          <Alert
            severity={prevDay?.status === "open" ? "warning" : "info"}
            action={
              <Button size="small" variant="contained" onClick={openDayDrawer}>
                Open Day (Carry ₹{suggestedOpening.toLocaleString("en-IN")})
              </Button>
            }
          >
            {prevDay
              ? prevDay.status === "open"
                ? `Previous sheet (${format(new Date(`${prevDay.date}T00:00:00`), "dd MMM yyyy")}) is still OPEN. Opening today will carry forward its expected closing ₹${suggestedOpening.toLocaleString("en-IN")}.`
                : `Ready to open ${format(new Date(), "dd MMM yyyy")}: Previous day (${format(new Date(`${prevDay.date}T00:00:00`), "dd MMM yyyy")}) closed at ₹${suggestedOpening.toLocaleString("en-IN")} — will carry forward automatically.`
              : "No previous cash drawer history found. Open today to start tracking daily opening and closing balances."}
          </Alert>
        )}

        {/* Today's Cash Flow KPI & Balance Strip */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">Drawer Status · {format(new Date(), "dd MMM")}</Typography>
              <Box sx={{ mt: 0.75, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <StatusChip
                  label={isDayClosed ? "Closed" : isDayOpen ? "Open" : "Not Started"}
                  sx={mergeSx(
                    isDayClosed
                      ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)", color: "hsl(var(--success))" }
                      : isDayOpen
                      ? { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)", color: "hsl(var(--warning))" }
                      : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                  )}
                />
                {todayRecord && cashContext?.postCloseAlerts?.[today] && (
                  <Chip size="small" color="warning" label="Post-close activity" />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                {cashContext?.nonCashSummary
                  ? `Bank/UPI net today: ₹${cashContext.nonCashSummary.net.toLocaleString("en-IN")}`
                  : "Physical cash drawer"}
              </Typography>
            </CardContent>
          </Card>

          <StatCard
            label="Opening Balance"
            value={todayRecord ? todayRecord.opening_cash : suggestedOpening}
            isCurrency
            accent="primary"
            caption={prevDay ? `From ${format(new Date(`${prevDay.date}T00:00:00`), "dd MMM")} closing` : "Starting float"}
          />
          <StatCard
            label="Cash Inflows"
            value={todayInflows}
            isCurrency
            accent="success"
            caption={todayRecord ? `POS ₹${Number(todayRecord.pos_total || 0).toLocaleString("en-IN")} · Auto ₹${Number(todayRecord.auto_income || 0).toLocaleString("en-IN")} · Man ₹${Number(todayRecord.manual_income || 0).toLocaleString("en-IN")}` : "Today"}
          />
          <StatCard
            label="Cash Outflows"
            value={todayOutflows}
            isCurrency
            accent="warning"
            caption={todayRecord ? `Auto ₹${Number(todayRecord.auto_expense || 0).toLocaleString("en-IN")} · Man ₹${Number(todayRecord.manual_expense || 0).toLocaleString("en-IN")}` : "Today"}
          />
          <StatCard
            label={isDayClosed ? "Actual Closing" : "Expected Closing"}
            value={isDayClosed ? (todayRecord?.closing_cash ?? todayExpected) : todayExpected}
            isCurrency
            accent={todayRecord?.difference != null && todayRecord.difference < 0 ? "error" : "info"}
            caption={
              todayRecord?.difference != null
                ? `Variance: ${todayRecord.difference >= 0 ? "+" : ""}₹${todayRecord.difference.toLocaleString("en-IN")}`
                : `Transfers net: ₹${((todayRecord?.transfer_in || 0) - (todayRecord?.transfer_out || 0)).toLocaleString("en-IN")}`
            }
          />
        </Box>

        {/* Action & Audit Report Bar */}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {!isDayOpen && !isDayClosed && (
              <Button onClick={openDayDrawer} variant="contained" startIcon={<Plus size={16} />}>
                Open Day
              </Button>
            )}
            {isDayOpen && (
              <>
                <Button onClick={() => { setManualIncome(""); setIncomeRef(""); setIncomeDesc(""); setIncomeCatId(""); setIncomeSheetOpen(true); }} variant="outlined" startIcon={<TrendingUp size={16} />}>
                  Record Income
                </Button>
                <Button onClick={() => { setManualExpense(""); setExpenseRef(""); setExpenseDesc(""); setExpenseCatId(""); setExpenseSheetOpen(true); }} variant="outlined" startIcon={<TrendingDown size={16} />}>
                  Record Expense
                </Button>
                <Button onClick={() => void handleRecomputeToday()} variant="outlined" startIcon={<RefreshCw size={15} />}>
                  Sync Drawer
                </Button>
                <Button
                  onClick={() => { setCloseDenoms({}); setClosingCash(""); setClosingNotes(""); setCloseSheetOpen(true); }}
                  variant="contained"
                  color="error"
                  startIcon={<Lock size={15} />}
                >
                  Close Day
                </Button>
              </>
            )}
            {isDayClosed && todayRecord && isAdmin && (
              <Button onClick={() => { setInspectRecord(todayRecord); setReopenReason(""); }} variant="outlined" startIcon={<Eye size={15} />}>
                Inspect / Reopen Today
              </Button>
            )}
          </Box>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <Button onClick={() => void handleAuditPdf(false)} disabled={pdfLoading} variant="outlined" size="small" startIcon={<FileText size={15} />}>
              Audit Report PDF
            </Button>
            <Button onClick={() => void handleAuditPdf(true)} disabled={pdfLoading} variant="outlined" size="small" startIcon={<Download size={15} />}>
              Download PDF
            </Button>
            <Button onClick={exportCashCsv} variant="outlined" size="small" startIcon={<Download size={15} />}>
              Export CSV
            </Button>
          </Box>
        </Box>

        {/* Search & Multi-Filters */}
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25 }}>
          <SearchToolbar
            onSearch={setSearch}
            value={search}
            placeholder="Search date, staff, notes, ref or TXN ID..."
            sx={{ flex: 1, minWidth: 220, maxWidth: "24rem" }}
          />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {([
              ["today", "Today"],
              ["week", "7 Days"],
              ["month", "This Month"],
              ["all", "All"],
              ["custom", "Custom"],
            ] as const).map(([key, label]) => (
              <Button key={key} onClick={() => setDateRange(key)} variant={dateRange === key ? "contained" : "outlined"} size="small">
                {label}
              </Button>
            ))}
          </Box>
          {dateRange === "custom" && (
            <>
              <TextField type="date" label="From" value={customFrom} onChange={e => setCustomFrom(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
              <TextField type="date" label="To" value={customTo} onChange={e => setCustomTo(e.target.value)} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
            </>
          )}
          <TextField select size="small" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} label="Status" slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 120 }}>
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </TextField>
          <TextField select size="small" value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)} label="Source" slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 140 }}>
            <MenuItem value="all">Auto + Manual</MenuItem>
            <MenuItem value="auto">Has Auto Flow</MenuItem>
            <MenuItem value="manual">Has Manual Entry</MenuItem>
          </TextField>
        </Box>

        {/* Cash Control Daily Carry-Forward History Table */}
        <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", minWidth: 0, width: "100%", overflow: "hidden" }}>
          <DataTable columnsCount={11} empty={filteredRecords.length === 0} emptyMessage="No daily cash control records match your filter" sx={{ "& td, & th": { px: 1.25 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Date & Chain</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Opening</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Auto In</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Manual In</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Cash Out</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Expected</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Closing</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Variance</TableCell>
                <TableCell>Staff</TableCell>
                <TableCell sx={{ width: "5.5rem" }}>Audit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.map(r => {
                const dk = normalizeCashDate(r.date);
                const expected = calcExpectedClosing(r);
                const autoIn = Number(r.pos_total || 0) + Number(r.auto_income || 0) + Number(r.transfer_in || 0);
                const manIn = Number(r.manual_income || 0);
                const cashOut = Number(r.auto_expense || 0) + Number(r.manual_expense || 0) + Number(r.transfer_out || 0);
                const chain = cashContext?.chainAudit?.[dk];
                const postAlert = cashContext?.postCloseAlerts?.[dk];
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {format(new Date(`${dk}T00:00:00`), "dd MMM yyyy")}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25, flexWrap: "wrap" }}>
                        {chain?.status === "linked" && (
                          <Typography variant="caption" sx={{ color: "success.main", fontSize: "10px" }}>
                            Linked to prev closing
                          </Typography>
                        )}
                        {chain?.status === "overridden" && (
                          <Typography variant="caption" sx={{ color: "warning.main", fontSize: "10px" }}>
                            Adjusted ({chain.delta >= 0 ? "+" : ""}₹{chain.delta})
                          </Typography>
                        )}
                        {chain?.status === "mismatch" && (
                          <Typography variant="caption" sx={{ color: "error.main", fontSize: "10px" }}>
                            Carry gap {chain.delta >= 0 ? "+" : ""}₹{chain.delta}
                          </Typography>
                        )}
                        {postAlert && (
                          <Chip size="small" color="warning" label={`Late Δ₹${postAlert.delta}`} sx={{ height: 18, fontSize: "10px" }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        label={r.status || "open"}
                        variant="outlined"
                        sx={mergeSx(
                          r.status === "closed"
                            ? { color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }
                            : { color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 30%, transparent)" }
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{Number(r.opening_cash || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell sx={{ textAlign: "right", color: "hsl(var(--success))", fontVariantNumeric: "tabular-nums" }}>₹{autoIn.toLocaleString("en-IN")}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{manIn.toLocaleString("en-IN")}</TableCell>
                    <TableCell sx={{ textAlign: "right", color: "hsl(var(--destructive))", fontVariantNumeric: "tabular-nums" }}>₹{cashOut.toLocaleString("en-IN")}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>₹{expected.toLocaleString("en-IN")}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {r.closing_cash != null ? `₹${Number(r.closing_cash).toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell
                      sx={mergeSx(
                        { textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" },
                        r.difference != null && r.difference < 0
                          ? { color: "hsl(var(--destructive))" }
                          : r.difference != null && r.difference > 0
                          ? { color: "hsl(var(--success))" }
                          : {}
                      )}
                    >
                      {r.difference != null ? `₹${Number(r.difference).toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem" }}>{r.staff_name || "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => { setInspectRecord(r); setDrawerSourceFilter("all"); setReopenReason(""); }}
                        startIcon={<Eye size={13} />}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </Box>

        {/* Open Day Drawer (Auto Carry-Forward) */}
        <SideDrawer
          open={openSheetOpen}
          onClose={() => setOpenSheetOpen(false)}
          title={`Open Day — ${format(new Date(), "dd MMM yyyy")}`}
          description="Verify carried-forward opening balance or count cash denominations"
          width={480}
          footer={
            <>
              <Button variant="outlined" onClick={() => setOpenSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
              <Button onClick={handleOpenDay} variant="contained" sx={{ minHeight: 36 }}>Open Day</Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            {prevDay && (
              <Alert severity={prevDay.status === "closed" ? "success" : "warning"}>
                Carried from {format(new Date(`${prevDay.date}T00:00:00`), "dd MMM yyyy")}{" "}
                ({prevDay.status === "closed" ? "Closing Balance" : "Expected Balance"}): ₹{suggestedOpening.toLocaleString("en-IN")}
              </Alert>
            )}
            <TextField
              type="number"
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              disabled={Boolean(prevDay) && !overrideOpening && denomTotal(openDenoms) === 0}
              label="Opening Cash Amount"
              size="small"
              fullWidth
            />
            {prevDay && (
              <FormControlLabel
                control={<Switch checked={overrideOpening} onChange={(_, c) => setOverrideOpening(c)} />}
                label="Override carried-forward opening balance"
              />
            )}
            {(overrideOpening || (prevDay && Math.abs((denomTotal(openDenoms) || Number(openingCash || 0)) - suggestedOpening) >= 0.01)) && (
              <TextField
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                label="Override Audit Reason *"
                placeholder="e.g. Float topped up from owner pocket"
                size="small"
                fullWidth
              />
            )}
            <Box>
              <FormLabel sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", display: "block", mb: 1 }}>
                Denomination Count (optional)
              </FormLabel>
              <DenomGrid denoms={openDenoms} onChange={setOpenDenoms} />
              {denomTotal(openDenoms) > 0 && (
                <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", mt: 1 }}>
                  Denomination Total: ₹{denomTotal(openDenoms).toLocaleString("en-IN")}
                </Typography>
              )}
            </Box>
          </Box>
        </SideDrawer>

        {/* Close Day Drawer */}
        <SideDrawer
          open={closeSheetOpen}
          onClose={() => setCloseSheetOpen(false)}
          title="Close Day & Lock Drawer"
          description={
            todayRecord
              ? `Expected Closing: ₹${calcExpectedClosing(todayRecord).toLocaleString("en-IN")}`
              : undefined
          }
          width={480}
          footer={
            <>
              <Button variant="outlined" onClick={() => setCloseSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
              <Button onClick={handleCloseDay} variant="contained" color="error" sx={{ minHeight: 36 }}>Close Day</Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            {todayRecord && (
              <Box sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider", display: "grid", gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Drawer Reconciliation Preview</Typography>
                <Typography variant="caption">Opening Balance: ₹{Number(todayRecord.opening_cash || 0).toLocaleString("en-IN")}</Typography>
                <Typography variant="caption" sx={{ color: "success.main" }}>
                  + Inflows (POS ₹{Number(todayRecord.pos_total || 0).toLocaleString("en-IN")} + Auto ₹{Number(todayRecord.auto_income || 0).toLocaleString("en-IN")} + Manual ₹{Number(todayRecord.manual_income || 0).toLocaleString("en-IN")} + Transfer In ₹{Number(todayRecord.transfer_in || 0).toLocaleString("en-IN")})
                </Typography>
                <Typography variant="caption" sx={{ color: "error.main" }}>
                  - Outflows (Auto ₹{Number(todayRecord.auto_expense || 0).toLocaleString("en-IN")} + Manual ₹{Number(todayRecord.manual_expense || 0).toLocaleString("en-IN")} + Transfer Out ₹{Number(todayRecord.transfer_out || 0).toLocaleString("en-IN")})
                </Typography>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  Expected Closing: ₹{calcExpectedClosing(todayRecord).toLocaleString("en-IN")}
                </Typography>
              </Box>
            )}
            <TextField
              type="number"
              value={closingCash}
              onChange={e => setClosingCash(e.target.value)}
              placeholder="Or enter physical count below"
              label="Actual Counted Closing Cash"
              size="small"
              fullWidth
            />
            <Box>
              <FormLabel sx={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))", display: "block", mb: 1 }}>
                Denomination Count (optional)
              </FormLabel>
              <DenomGrid denoms={closeDenoms} onChange={setCloseDenoms} />
              {denomTotal(closeDenoms) > 0 && (
                <Typography variant="body2" sx={{ fontWeight: 600, textAlign: "right", mt: 1 }}>
                  Denomination Total: ₹{denomTotal(closeDenoms).toLocaleString("en-IN")}
                </Typography>
              )}
            </Box>
            <TextField
              value={closingNotes}
              onChange={e => setClosingNotes(e.target.value)}
              rows={2}
              placeholder="Explain any variance or handover remarks"
              label={(() => {
                const denomSum = denomTotal(closeDenoms);
                const cc = denomSum > 0 ? denomSum : parseFloat(closingCash) || 0;
                const exp = todayRecord ? calcExpectedClosing(todayRecord) : 0;
                return Math.abs(cc - exp) > 100 ? "Notes (required — variance > ₹100)" : "Notes (optional)";
              })()}
              size="small"
              fullWidth
              multiline
            />
          </Box>
        </SideDrawer>

        {/* Manual Income Sheet (Creates Real Ledger Transaction + Syncs Drawer) */}
        <SideDrawer
          open={incomeSheetOpen}
          onClose={() => setIncomeSheetOpen(false)}
          title="Record Manual Cash Income"
          description="Posts to Finance Ledger & Daily Cash Drawer"
          width={440}
          footer={
            <>
              <Button variant="outlined" onClick={() => setIncomeSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
              <Button onClick={() => addManualEntry("income")} variant="contained" sx={{ minHeight: 36 }}>Record Income</Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField type="number" value={manualIncome} onChange={e => setManualIncome(e.target.value)} label="Amount *" size="small" fullWidth />
            <TextField select value={incomeCatId} onChange={e => setIncomeCatId(e.target.value)} label="Category" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}>
              <MenuItem value="">Auto (Other Income)</MenuItem>
              {categories.filter(c => c.type === "income").map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField value={incomeRef} onChange={e => setIncomeRef(e.target.value)} placeholder="INV-00001 / JOB-2026-00001 / QT-00001" label="Reference" size="small" fullWidth />
            <TextField value={incomeDesc} onChange={e => setIncomeDesc(e.target.value)} label="Description / Remarks" size="small" fullWidth multiline rows={2} />
          </Box>
        </SideDrawer>

        {/* Manual Expense Sheet (Creates Real Ledger Transaction + Syncs Drawer) */}
        <SideDrawer
          open={expenseSheetOpen}
          onClose={() => setExpenseSheetOpen(false)}
          title="Record Manual Cash Expense"
          description="Posts to Finance Ledger & Daily Cash Drawer"
          width={440}
          footer={
            <>
              <Button variant="outlined" onClick={() => setExpenseSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
              <Button onClick={() => addManualEntry("expense")} variant="contained" sx={{ minHeight: 36 }}>Record Expense</Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField type="number" value={manualExpense} onChange={e => setManualExpense(e.target.value)} label="Amount *" size="small" fullWidth />
            <TextField select value={expenseCatId} onChange={e => setExpenseCatId(e.target.value)} label="Category" size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}>
              <MenuItem value="">Auto (Misc Expense)</MenuItem>
              {categories.filter(c => c.type === "expense").map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField value={expenseRef} onChange={e => setExpenseRef(e.target.value)} placeholder="Petty cash / Courier / Tea / Repair" label="Reference" size="small" fullWidth />
            <TextField value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} label="Description / Remarks" size="small" fullWidth multiline rows={2} />
          </Box>
        </SideDrawer>

        {/* Day Breakdown & Audit Reconciliation Drawer */}
        <SideDrawer
          open={Boolean(inspectRecord)}
          onClose={() => setInspectRecord(null)}
          title={inspectRecord ? `Cash Flow Audit — ${format(new Date(`${normalizeCashDate(inspectRecord.date)}T00:00:00`), "dd MMM yyyy")}` : "Day Audit"}
          description="Complete opening-to-closing balance math, itemized entries, and reconciliation controls"
          width={680}
        >
          {inspectRecord && (() => {
            const dk = normalizeCashDate(inspectRecord.date);
            const expected = calcExpectedClosing(inspectRecord);
            const postAlert = cashContext?.postCloseAlerts?.[dk];
            const dayAudits = auditLog.filter(a => a.details?.includes(dk) || normalizeCashDate(a.created_at) === dk);
            return (
              <Box sx={{ display: "grid", gap: 2.5 }}>
                {postAlert && (
                  <Alert severity="warning" icon={<AlertTriangle size={18} />}>
                    Post-Close Ledger Delta Detected: live cash transactions on {dk} imply expected closing ₹{postAlert.liveExpected.toLocaleString("en-IN")} vs saved ₹{postAlert.savedExpected.toLocaleString("en-IN")} (Δ ₹{postAlert.delta}). Reopen this day below to re-reconcile cleanly.
                  </Alert>
                )}

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1.25 }}>
                  {[
                    ["Opening", Number(inspectRecord.opening_cash || 0)],
                    ["Total Inflow", Number(inspectRecord.pos_total || 0) + Number(inspectRecord.auto_income || 0) + Number(inspectRecord.manual_income || 0) + Number(inspectRecord.transfer_in || 0)],
                    ["Total Outflow", Number(inspectRecord.auto_expense || 0) + Number(inspectRecord.manual_expense || 0) + Number(inspectRecord.transfer_out || 0)],
                    ["Expected Close", expected],
                  ].map(([lbl, val]) => (
                    <Box key={String(lbl)} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="caption" color="text.secondary">{lbl}</Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        ₹{Number(val).toLocaleString("en-IN")}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {inspectRecord.opening_override_reason && (
                  <Alert severity="info">Opening Balance Override Note: {inspectRecord.opening_override_reason}</Alert>
                )}
                {inspectRecord.notes && (
                  <Typography variant="body2" color="text.secondary">Closing Notes: {inspectRecord.notes}</Typography>
                )}

                <Divider />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>
                    Itemized Movements ({inspectTransactions.length})
                  </Typography>
                  <TextField select size="small" value={drawerSourceFilter} onChange={e => setDrawerSourceFilter(e.target.value as any)} sx={{ width: 140 }}>
                    <MenuItem value="all">All Sources</MenuItem>
                    <MenuItem value="auto">Auto Only</MenuItem>
                    <MenuItem value="manual">Manual Only</MenuItem>
                  </TextField>
                </Box>

                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <DataTable columnsCount={5} empty={inspectTransactions.length === 0} emptyMessage="No linked ledger transactions found for this date">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Source / Mode</TableCell>
                        <TableCell>Category / Account</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell sx={{ textAlign: "right" }}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {inspectTransactions.map(t => (
                        <TableRow key={t.id}>
                          <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>{t.transaction_id}</TableCell>
                          <TableCell>
                            <StatusChip label={(t.entry_source || "manual").replace(/_/g, " ")} size="small" variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }} />
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{t.payment_mode || "cash"}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>
                            <Box>{catName(t.category_id)}</Box>
                            <Typography variant="caption" color="text.secondary">{acctName(t.account_id)}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem", maxWidth: 160 }} title={t.description || t.reference || ""}>
                            {t.description || t.reference || "—"}
                          </TableCell>
                          <TableCell
                            sx={{
                              textAlign: "right",
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                              color: t.type === "income" ? "success.main" : t.type === "expense" ? "error.main" : "primary.main",
                            }}
                          >
                            {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}₹{Number(t.amount || 0).toLocaleString("en-IN")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </DataTable>
                </Box>

                {dayAudits.length > 0 && (
                  <Box sx={{ display: "grid", gap: 0.75 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>Day Audit Events</Typography>
                    {dayAudits.slice(0, 6).map(a => (
                      <Typography key={a.id} variant="caption" color="text.secondary">
                        [{format(new Date(a.created_at), "HH:mm")}] {a.action} — {a.details} ({a.staff_name || "System"})
                      </Typography>
                    ))}
                  </Box>
                )}

                {isAdmin && inspectRecord.status === "closed" && (
                  <>
                    <Divider />
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>Admin Reconciliation Controls</Typography>
                      {inspectRecord.difference != null && Math.abs(Number(inspectRecord.difference)) >= 0.01 && (
                        <Button variant="outlined" color="warning" onClick={() => void postVarianceAdjustment(inspectRecord)} startIcon={<CheckCircle2 size={15} />}>
                          Post Variance Adjustment (₹{Math.abs(Number(inspectRecord.difference)).toLocaleString("en-IN")} {Number(inspectRecord.difference) > 0 ? "Income" : "Expense"})
                        </Button>
                      )}
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          value={reopenReason}
                          onChange={e => setReopenReason(e.target.value)}
                          placeholder="Reason to reopen & recount this closed day *"
                        />
                        <Button
                          variant="contained"
                          color="error"
                          disabled={reopening}
                          onClick={() => void handleReopenDay(inspectRecord)}
                          startIcon={<Unlock size={15} />}
                          sx={{ flexShrink: 0 }}
                        >
                          {reopening ? "Reopening..." : "Reopen Day"}
                        </Button>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            );
          })()}
        </SideDrawer>
      </Box>
    );
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
