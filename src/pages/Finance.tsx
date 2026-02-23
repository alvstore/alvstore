import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Wallet, TrendingUp, TrendingDown, ArrowRightLeft, Landmark,
  PiggyBank, Tags, BookOpen, ShieldCheck, Plus, Search, Download,
  DollarSign, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, startOfDay, endOfDay } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(262, 83%, 58%)", "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)", "hsl(199, 89%, 48%)", "hsl(0, 84%, 60%)",
  "hsl(280, 60%, 50%)", "hsl(160, 60%, 45%)", "hsl(30, 80%, 55%)", "hsl(200, 70%, 50%)",
];

// ─── Types ────────────────────────────────────
interface FinanceAccount {
  id: string; name: string; type: string; account_number: string | null;
  bank_name: string | null; opening_balance: number; current_balance: number;
  status: string; created_at: string;
}
interface FinanceCategory {
  id: string; name: string; type: string; status: string;
}
interface FinanceTransaction {
  id: string; transaction_id: string; type: string; date: string;
  amount: number; payment_mode: string | null; account_id: string | null;
  to_account_id: string | null; category_id: string | null;
  customer_id: string | null; reference: string | null;
  description: string | null; staff_name: string | null;
  balance_after: number | null; created_at: string;
}
interface AuditEntry {
  id: string; action: string; entity_type: string | null;
  details: string | null; staff_name: string | null;
  user_role: string | null; created_at: string;
}
interface CashControl {
  id: string; date: string; opening_cash: number;
  closing_cash: number | null; difference: number | null;
  staff_name: string | null; status: string | null;
  denominations: any; pos_total: number | null;
  manual_income: number | null; manual_expense: number | null;
  expected_closing: number | null; notes: string | null;
  closed_at: string | null; closed_by: string | null;
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
  const [staffName, setStaffName] = useState("");

  // Fetch staff name from profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setStaffName(data?.full_name || user.email || ""));
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    const [accRes, catRes, txRes, auditRes, cashRes] = await Promise.all([
      supabase.from("finance_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("finance_categories").select("*").order("name"),
      supabase.from("finance_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("finance_audit_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("daily_cash_control").select("*").order("date", { ascending: false }),
    ]);
    setAccounts(accRes.data || []);
    setCategories(catRes.data || []);
    setTransactions(txRes.data || []);
    setAuditLog(auditRes.data || []);
    setCashRecords(cashRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── KPI Calculations ─────────────────────────
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = startOfMonth(today);

  const cashBalance = accounts.filter(a => a.type === "cash").reduce((s, a) => s + a.current_balance, 0);
  const bankBalance = accounts.filter(a => a.type === "bank").reduce((s, a) => s + a.current_balance, 0);
  const todayIncome = transactions.filter(t => t.type === "income" && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
  const todayExpense = transactions.filter(t => t.type === "expense" && t.date === todayStr).reduce((s, t) => s + t.amount, 0);
  const monthlyIncome = transactions.filter(t => t.type === "income" && new Date(t.date) >= monthStart).reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = transactions.filter(t => t.type === "expense" && new Date(t.date) >= monthStart).reduce((s, t) => s + t.amount, 0);
  const netBalance = accounts.reduce((s, a) => s + a.current_balance, 0);

  // ─── Chart Data ───────────────────────────────
  const incExpChart = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const ds = format(d, "yyyy-MM-dd");
      const label = format(d, "dd MMM");
      const inc = transactions.filter(t => t.type === "income" && t.date === ds).reduce((s, t) => s + t.amount, 0);
      const exp = transactions.filter(t => t.type === "expense" && t.date === ds).reduce((s, t) => s + t.amount, 0);
      return { date: label, Income: inc, Expense: exp };
    });
    return last7;
  }, [transactions]);

  const categoryChart = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === "expense" && new Date(t.date) >= monthStart).forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const name = cat?.name || "Uncategorized";
      map[name] = (map[name] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [transactions, categories]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">Daily finance control & ledger management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="income"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Income</TabsTrigger>
          <TabsTrigger value="expenses"><TrendingDown className="h-3.5 w-3.5 mr-1.5" />Expenses</TabsTrigger>
          <TabsTrigger value="transfers"><ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />Transfers</TabsTrigger>
          <TabsTrigger value="accounts"><Landmark className="h-3.5 w-3.5 mr-1.5" />Accounts</TabsTrigger>
          <TabsTrigger value="categories"><Tags className="h-3.5 w-3.5 mr-1.5" />Categories</TabsTrigger>
          <TabsTrigger value="ledger"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Ledger</TabsTrigger>
          <TabsTrigger value="cash"><PiggyBank className="h-3.5 w-3.5 mr-1.5" />Cash Control</TabsTrigger>
          <TabsTrigger value="audit"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Audit Log</TabsTrigger>
        </TabsList>

        {/* ─── DASHBOARD ─────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Cash Balance", value: cashBalance, icon: Wallet, color: "bg-success/10 text-success" },
              { label: "Bank Balance", value: bankBalance, icon: Landmark, color: "bg-primary/10 text-primary" },
              { label: "Net Balance", value: netBalance, icon: DollarSign, color: "bg-accent/10 text-accent-foreground" },
              { label: "Pending Payments", value: 0, icon: TrendingUp, color: "bg-warning/10 text-warning", hidden: true },
            ].filter(k => !k.hidden).map(kpi => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className={`p-2 rounded-lg w-fit ${kpi.color} mb-2`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold">₹{kpi.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Today Income", value: todayIncome, icon: TrendingUp, color: "bg-info/10 text-info" },
              { label: "Today Expense", value: todayExpense, icon: TrendingDown, color: "bg-destructive/10 text-destructive" },
              { label: "Monthly Income", value: monthlyIncome, icon: TrendingUp, color: "bg-success/10 text-success" },
              { label: "Monthly Expense", value: monthlyExpense, icon: TrendingDown, color: "bg-warning/10 text-warning" },
            ].map(kpi => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className={`p-2 rounded-lg w-fit ${kpi.color} mb-2`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold">₹{kpi.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Income vs Expense (7 Days)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={incExpChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <RTooltip />
                    <Bar dataKey="Income" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expense" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Expense Breakdown (This Month)</CardTitle></CardHeader>
              <CardContent>
                {categoryChart.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No expenses this month</p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={categoryChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categoryChart.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── INCOME TAB ────────────────────────── */}
        <TabsContent value="income">
          <TransactionTab
            type="income"
            transactions={transactions}
            accounts={accounts}
            categories={categories.filter(c => c.type === "income")}
            staffName={staffName}
            userId={user?.id}
            onRefresh={fetchAll}
          />
        </TabsContent>

        {/* ─── EXPENSES TAB ──────────────────────── */}
        <TabsContent value="expenses">
          <TransactionTab
            type="expense"
            transactions={transactions}
            accounts={accounts}
            categories={categories.filter(c => c.type === "expense")}
            staffName={staffName}
            userId={user?.id}
            onRefresh={fetchAll}
          />
        </TabsContent>

        {/* ─── TRANSFERS TAB ─────────────────────── */}
        <TabsContent value="transfers">
          <TransfersTab accounts={accounts} transactions={transactions.filter(t => t.type === "transfer")} staffName={staffName} userId={user?.id} onRefresh={fetchAll} />
        </TabsContent>

        {/* ─── ACCOUNTS TAB ──────────────────────── */}
        <TabsContent value="accounts">
          <AccountsTab accounts={accounts} userId={user?.id} onRefresh={fetchAll} />
        </TabsContent>

        {/* ─── CATEGORIES TAB ────────────────────── */}
        <TabsContent value="categories">
          <CategoriesTab categories={categories} onRefresh={fetchAll} />
        </TabsContent>

        {/* ─── LEDGER TAB ────────────────────────── */}
        <TabsContent value="ledger">
          <LedgerTab transactions={transactions} accounts={accounts} categories={categories} />
        </TabsContent>

        {/* ─── CASH CONTROL TAB ──────────────────── */}
        <TabsContent value="cash">
          <CashControlTab records={cashRecords} staffName={staffName} userId={user?.id} onRefresh={fetchAll} />
        </TabsContent>

        {/* ─── AUDIT LOG TAB ─────────────────────── */}
        <TabsContent value="audit">
          <AuditLogTab entries={auditLog} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════

// ─── Transaction Tab (Income / Expense) ───────
function TransactionTab({ type, transactions, accounts, categories, staffName, userId, onRefresh }: {
  type: "income" | "expense"; transactions: FinanceTransaction[];
  accounts: FinanceAccount[]; categories: FinanceCategory[];
  staffName: string; userId?: string; onRefresh: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptTx, setReceiptTx] = useState<FinanceTransaction | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filtered = transactions.filter(t => {
    if (t.type !== type) return false;
    // Date filter
    if (dateFilter === "today" && t.date !== format(new Date(), "yyyy-MM-dd")) return false;
    if (dateFilter === "7days" && new Date(t.date) < new Date(Date.now() - 7 * 86400000)) return false;
    if (dateFilter === "month" && new Date(t.date) < startOfMonth(new Date())) return false;
    if (dateFilter === "custom" && customFrom && t.date < customFrom) return false;
    if (dateFilter === "custom" && customTo && t.date > customTo) return false;
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
    if (!amount || amount <= 0) { toast.error("Enter valid amount"); return; }
    if (!form.account_id) { toast.error("Select an account"); return; }
    const { error } = await supabase.from("finance_transactions").insert({
      type, date: form.date, amount, payment_mode: form.payment_mode,
      account_id: form.account_id, category_id: form.category_id || null,
      reference: form.reference || null, description: form.description || null,
      created_by: userId, staff_name: staffName,
    });
    if (error) toast.error(error.message);
    else { toast.success(`${type === "income" ? "Income" : "Expense"} recorded`); setSheetOpen(false); onRefresh(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ID, date, amount, reference, staff..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button onClick={() => { setForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", payment_mode: "cash", account_id: "", category_id: "", customer_name: "", reference: "", description: "" }); setSheetOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Add {type === "income" ? "Income" : "Expense"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "7days", label: "7 Days" },
            { key: "month", label: "This Month" },
            { key: "custom", label: "Custom" },
          ].map(f => (
            <Button key={f.key} variant={dateFilter === f.key ? "default" : "outline"} size="sm" onClick={() => setDateFilter(f.key)}>
              {f.label}
            </Button>
          ))}
          {dateFilter === "custom" && (
            <>
              <Input type="date" className="w-36 h-8" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" className="w-36 h-8" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">{filtered.length} entries</p>
        <Button variant="outline" size="sm" onClick={() => {
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
          const a = document.createElement("a"); a.href = url; a.download = `${type}_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
        }}>
          <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No {type} entries</TableCell></TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.transaction_id}</TableCell>
                <TableCell className="text-xs">{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-xs">{categories.find(c => c.id === t.category_id)?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-xs">{accounts.find(a => a.id === t.account_id)?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="capitalize text-xs">{t.payment_mode}</TableCell>
                <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{t.description || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.reference || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.staff_name || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setReceiptTx(t); setReceiptOpen(true); }} title="View Receipt">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-md print:max-w-full print:shadow-none">
          <DialogHeader>
            <DialogTitle>Receipt Slip</DialogTitle>
          </DialogHeader>
          {receiptTx && (
            <ReceiptSlip transaction={receiptTx} accounts={accounts} categories={categories} />
          )}
          <div className="flex gap-2 justify-end print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Print / PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add {type === "income" ? "Income" : "Expense"}</SheetTitle>
            <SheetDescription>Staff: {staffName}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "bank", "upi", "card", "gateway"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account *</Label>
              <Select value={form.account_id} onValueChange={v => setForm(p => ({ ...p, account_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.status === "active").map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reference</Label><Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Invoice / Job Sheet #" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave}>Save</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Transfers Tab ────────────────────────────
function TransfersTab({ accounts, transactions, staffName, userId, onRefresh }: {
  accounts: FinanceAccount[]; transactions: FinanceTransaction[];
  staffName: string; userId?: string; onRefresh: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ from: "", to: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });

  const handleSave = async () => {
    const amount = parseFloat(form.amount);
    if (!amount || !form.from || !form.to) { toast.error("Fill all required fields"); return; }
    if (form.from === form.to) { toast.error("From and To accounts must differ"); return; }
    const { error } = await supabase.from("finance_transactions").insert({
      type: "transfer", date: form.date, amount, account_id: form.from,
      to_account_id: form.to, description: form.description || null,
      created_by: userId, staff_name: staffName,
    });
    if (error) toast.error(error.message);
    else { toast.success("Transfer recorded"); setSheetOpen(false); onRefresh(); }
  };

  const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm({ from: "", to: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), description: "" }); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Transfer
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Staff</TableHead></TableRow></TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers</TableCell></TableRow>
            ) : transactions.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.transaction_id}</TableCell>
                <TableCell>{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                <TableCell>{acctName(t.account_id)}</TableCell>
                <TableCell>{acctName(t.to_account_id)}</TableCell>
                <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{t.staff_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>New Transfer</SheetTitle><SheetDescription>Move funds between accounts</SheetDescription></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>From Account *</Label>
              <Select value={form.from} onValueChange={v => setForm(p => ({ ...p, from: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{accounts.filter(a => a.status === "active").map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To Account *</Label>
              <Select value={form.to} onValueChange={v => setForm(p => ({ ...p, to: v }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{accounts.filter(a => a.status === "active").map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave}>Transfer</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Accounts Tab ─────────────────────────────
function AccountsTab({ accounts, userId, onRefresh }: { accounts: FinanceAccount[]; userId?: string; onRefresh: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "cash", account_number: "", bank_name: "", opening_balance: "" });

  const handleSave = async () => {
    if (!form.name) { toast.error("Enter account name"); return; }
    const ob = parseFloat(form.opening_balance) || 0;
    const { error } = await supabase.from("finance_accounts").insert({
      name: form.name, type: form.type, account_number: form.account_number || null,
      bank_name: form.bank_name || null, opening_balance: ob, current_balance: ob,
      created_by: userId,
    });
    if (error) toast.error(error.message);
    else { toast.success("Account created"); setSheetOpen(false); onRefresh(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setForm({ name: "", type: "cash", account_number: "", bank_name: "", opening_balance: "" }); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Account
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(a => (
          <Card key={a.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{a.name}</span>
                <Badge variant="outline" className="capitalize">{a.type}</Badge>
              </div>
              {a.bank_name && <p className="text-xs text-muted-foreground">{a.bank_name} • {a.account_number}</p>}
              <p className="text-2xl font-bold mt-3">₹{a.current_balance.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Opening: ₹{a.opening_balance.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
        {accounts.length === 0 && <p className="col-span-full text-center text-muted-foreground py-8">No accounts yet. Create one to start tracking.</p>}
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Add Account</SheetTitle><SheetDescription>Create a new financial account</SheetDescription></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Account Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["cash", "bank", "upi", "gateway"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(form.type === "bank") && <>
              <div className="space-y-1.5"><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
            </>}
            <div className="space-y-1.5"><Label>Opening Balance</Label><Input type="number" value={form.opening_balance} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleSave}>Create Account</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Categories Tab ───────────────────────────
function CategoriesTab({ categories, onRefresh }: { categories: FinanceCategory[]; onRefresh: () => void }) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("income");

  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Enter category name"); return; }
    const { error } = await supabase.from("finance_categories").insert({ name: newName.trim(), type: newType });
    if (error) toast.error(error.message);
    else { toast.success("Category added"); setNewName(""); onRefresh(); }
  };

  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1.5"><Label>Category Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New category" /></div>
        <Select value={newType} onValueChange={v => setNewType(v as any)}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
        </Select>
        <Button onClick={handleAdd}>Add</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-success">Income Categories</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {incCats.map(c => <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0"><span className="text-sm">{c.name}</span><Badge variant="outline" className="text-success border-success/30">income</Badge></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">Expense Categories</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {expCats.map(c => <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0"><span className="text-sm">{c.name}</span><Badge variant="outline" className="text-destructive border-destructive/30">expense</Badge></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────
function LedgerTab({ transactions, accounts, categories }: {
  transactions: FinanceTransaction[]; accounts: FinanceAccount[]; categories: FinanceCategory[];
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = transactions.filter(t => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search && !t.transaction_id.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const acctName = (id: string | null) => accounts.find(a => a.id === id)?.name || "—";
  const catName = (id: string | null) => categories.find(c => c.id === id)?.name || "—";

  const exportCSV = () => {
    const header = "Date,ID,Type,Category,Account,Amount,Staff,Reference,Balance\n";
    const rows = filtered.map(t =>
      `${t.date},${t.transaction_id},${t.type},${catName(t.category_id)},${acctName(t.account_id)},${t.amount},${t.staff_name || ""},${t.reference || ""},${t.balance_after || ""}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ledger-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem><SelectItem value="transfer">Transfer</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>ID</TableHead><TableHead>Type</TableHead>
              <TableHead>Category</TableHead><TableHead>Account</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Staff</TableHead>
              <TableHead>Reference</TableHead><TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No transactions</TableCell></TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell>{format(new Date(t.date), "dd MMM")}</TableCell>
                <TableCell className="font-mono text-xs">{t.transaction_id}</TableCell>
                <TableCell><Badge variant="outline" className={t.type === "income" ? "text-success border-success/30" : t.type === "expense" ? "text-destructive border-destructive/30" : "text-primary border-primary/30"}>{t.type}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{catName(t.category_id)}</TableCell>
                <TableCell>{acctName(t.account_id)}</TableCell>
                <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{t.staff_name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.reference || "—"}</TableCell>
                <TableCell className="text-right">{t.balance_after != null ? `₹${t.balance_after.toLocaleString()}` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Cash Control Tab (Advanced) ──────────────
const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

function CashControlTab({ records, staffName, userId, onRefresh }: {
  records: CashControl[]; staffName: string; userId?: string; onRefresh: () => void;
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

  const denomTotal = (denoms: Record<number, string>) =>
    DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(denoms[d] || "0") || 0), 0);

  const handleOpenDay = async () => {
    const oc = denomTotal(openDenoms) || parseFloat(openingCash) || 0;
    if (oc <= 0) { toast.error("Enter valid opening cash"); return; }
    const { error } = await supabase.from("daily_cash_control").insert({
      date: today, opening_cash: oc, status: "open",
      staff_name: staffName, created_by: userId,
      denominations: { opening: openDenoms },
    });
    if (error) {
      if (error.code === "23505") toast.error("Day already opened");
      else toast.error(error.message);
    } else {
      await supabase.from("finance_audit_log").insert({
        action: "DAY_OPENED", entity_type: "cash_control",
        details: `Day opened with ₹${oc.toLocaleString()}`,
        staff_name: staffName, user_id: userId,
      });
      toast.success("Day opened"); setOpenSheetOpen(false); onRefresh();
    }
  };

  const handleCloseDay = async () => {
    if (!todayRecord) return;
    const cc = denomTotal(closeDenoms) || parseFloat(closingCash) || 0;
    if (cc <= 0) { toast.error("Enter valid closing cash"); return; }
    const expected = todayRecord.opening_cash + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0);
    const diff = cc - expected;
    if (Math.abs(diff) > 100 && !closingNotes.trim()) {
      toast.error("Notes required when variance exceeds ₹100"); return;
    }
    const { error } = await supabase.from("daily_cash_control").update({
      closing_cash: cc, difference: diff, expected_closing: expected,
      status: "closed", closed_by: userId, closed_at: new Date().toISOString(),
      notes: closingNotes || null,
      denominations: { ...(todayRecord.denominations || {}), closing: closeDenoms },
    }).eq("id", todayRecord.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("finance_audit_log").insert({
        action: "DAY_CLOSED", entity_type: "cash_control",
        details: `Day closed. Expected: ₹${expected.toLocaleString()}, Actual: ₹${cc.toLocaleString()}, Variance: ₹${diff.toLocaleString()}`,
        staff_name: staffName, user_id: userId,
      });
      toast.success("Day closed"); setCloseSheetOpen(false); onRefresh();
    }
  };

  const addManualEntry = async (type: "income" | "expense") => {
    if (!todayRecord || todayRecord.status !== "open") { toast.error("Open the day first"); return; }
    const amt = parseFloat(type === "income" ? manualIncome : manualExpense) || 0;
    const ref = type === "income" ? incomeRef : expenseRef;
    if (amt <= 0) { toast.error("Enter valid amount"); return; }
    const field = type === "income" ? "manual_income" : "manual_expense";
    const current = type === "income" ? (todayRecord.manual_income || 0) : (todayRecord.manual_expense || 0);
    const { error } = await supabase.from("daily_cash_control").update({
      [field]: current + amt,
    }).eq("id", todayRecord.id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("finance_audit_log").insert({
        action: `MANUAL_${type.toUpperCase()}`, entity_type: "cash_control",
        details: `Manual ${type}: ₹${amt.toLocaleString()} | Ref: ${ref || "N/A"}`,
        staff_name: staffName, user_id: userId,
      });
      toast.success(`${type === "income" ? "Income" : "Expense"} recorded`);
      if (type === "income") { setManualIncome(""); setIncomeRef(""); setIncomeSheetOpen(false); }
      else { setManualExpense(""); setExpenseRef(""); setExpenseSheetOpen(false); }
      onRefresh();
    }
  };

  // Filter records by date
  const filteredRecords = records.filter(r => {
    if (dateRange === "today") return r.date === today;
    if (dateRange === "week") {
      const d = new Date(); d.setDate(d.getDate() - 7);
      return new Date(r.date) >= d;
    }
    if (dateRange === "month") {
      const d = new Date(); d.setDate(1);
      return new Date(r.date) >= d;
    }
    return r.date === dateFilter;
  });

  const DenomGrid = ({ denoms, onChange }: { denoms: Record<number, string>; onChange: (d: Record<number, string>) => void }) => (
    <div className="grid grid-cols-5 gap-2">
      {DENOMINATIONS.map(d => (
        <div key={d} className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">₹{d}</label>
          <Input className="h-8 text-xs text-center" type="number" min="0"
            value={denoms[d] || ""} onChange={e => onChange({ ...denoms, [d]: e.target.value })} placeholder="0" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Today's Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge className={cn(
              isDayClosed ? "bg-success/10 text-success" :
              isDayOpen ? "bg-warning/10 text-warning" :
              "bg-muted text-muted-foreground"
            )}>
              {isDayClosed ? "Closed" : isDayOpen ? "Open" : "Not Started"}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(), "dd MMM yyyy")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Opening Cash</p>
            <p className="text-xl font-bold">₹{(todayRecord?.opening_cash || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Expected Closing</p>
            <p className="text-xl font-bold">
              ₹{todayRecord ? ((todayRecord.opening_cash || 0) + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)).toLocaleString() : "0"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Variance</p>
            <p className={cn("text-xl font-bold",
              todayRecord?.difference != null && todayRecord.difference < 0 ? "text-destructive" :
              todayRecord?.difference != null && todayRecord.difference > 0 ? "text-success" : ""
            )}>
              {todayRecord?.difference != null ? `₹${todayRecord.difference.toLocaleString()}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {!isDayOpen && !isDayClosed && (
          <Button onClick={() => { setOpenDenoms({}); setOpeningCash(""); setOpenSheetOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Open Day
          </Button>
        )}
        {isDayOpen && (
          <>
            <Button variant="outline" onClick={() => { setManualIncome(""); setIncomeRef(""); setIncomeSheetOpen(true); }}>
              <TrendingUp className="h-4 w-4 mr-2" />Record Income
            </Button>
            <Button variant="outline" onClick={() => { setManualExpense(""); setExpenseRef(""); setExpenseSheetOpen(true); }}>
              <TrendingDown className="h-4 w-4 mr-2" />Record Expense
            </Button>
            <Button className="bg-destructive hover:bg-destructive/90" onClick={() => { setCloseDenoms({}); setClosingCash(""); setClosingNotes(""); setCloseSheetOpen(true); }}>
              Close Day
            </Button>
          </>
        )}
      </div>

      {/* Date Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(["today", "week", "month", "custom"] as const).map(v => (
          <Button key={v} size="sm" variant={dateRange === v ? "default" : "outline"} onClick={() => setDateRange(v)} className="capitalize">
            {v === "custom" ? "Custom" : v === "today" ? "Today" : v === "week" ? "7 Days" : "This Month"}
          </Button>
        ))}
        {dateRange === "custom" && (
          <Input type="date" className="w-auto h-9" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        )}
      </div>

      {/* History Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No records for this period</TableCell></TableRow>
            ) : filteredRecords.map(r => {
              const expected = (r.opening_cash || 0) + (r.manual_income || 0) + (r.pos_total || 0) - (r.manual_expense || 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      r.status === "closed" ? "text-success border-success/30" : "text-warning border-warning/30"
                    )}>{r.status || "open"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">₹{r.opening_cash.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-success">₹{((r.manual_income || 0) + (r.pos_total || 0)).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">₹{(r.manual_expense || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">₹{expected.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.closing_cash != null ? `₹${r.closing_cash.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className={cn("text-right font-medium",
                    r.difference != null && r.difference < 0 ? "text-destructive" :
                    r.difference != null && r.difference > 0 ? "text-success" : ""
                  )}>
                    {r.difference != null ? `₹${r.difference.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.staff_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">{r.notes || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Open Day Sheet */}
      <Sheet open={openSheetOpen} onOpenChange={setOpenSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Open Day — {format(new Date(), "dd MMM yyyy")}</SheetTitle>
            <SheetDescription>Enter opening cash or count denominations</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Opening Cash Amount</Label>
              <Input type="number" value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="Or use denominations below" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Denomination Count (optional)</Label>
              <DenomGrid denoms={openDenoms} onChange={setOpenDenoms} />
              {denomTotal(openDenoms) > 0 && (
                <p className="text-sm font-medium text-right">Denomination Total: ₹{denomTotal(openDenoms).toLocaleString()}</p>
              )}
            </div>
            <Button className="w-full" onClick={handleOpenDay}>Open Day</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Close Day Sheet */}
      <Sheet open={closeSheetOpen} onOpenChange={setCloseSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Close Day</SheetTitle>
            <SheetDescription>
              Expected: ₹{todayRecord ? ((todayRecord.opening_cash || 0) + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)).toLocaleString() : "0"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Actual Closing Cash</Label>
              <Input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Or use denominations below" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Denomination Count (optional)</Label>
              <DenomGrid denoms={closeDenoms} onChange={setCloseDenoms} />
              {denomTotal(closeDenoms) > 0 && (
                <p className="text-sm font-medium text-right">Denomination Total: ₹{denomTotal(closeDenoms).toLocaleString()}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Notes {(() => {
                const cc = denomTotal(closeDenoms) || parseFloat(closingCash) || 0;
                const exp = todayRecord ? (todayRecord.opening_cash + (todayRecord.manual_income || 0) + (todayRecord.pos_total || 0) - (todayRecord.manual_expense || 0)) : 0;
                return Math.abs(cc - exp) > 100 ? "(required — variance > ₹100)" : "(optional)";
              })()}</Label>
              <Textarea value={closingNotes} onChange={e => setClosingNotes(e.target.value)} rows={2} placeholder="Explain any variance" />
            </div>
            <Button className="w-full" onClick={handleCloseDay}>Close Day</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Income Sheet */}
      <Sheet open={incomeSheetOpen} onOpenChange={setIncomeSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record Manual Income</SheetTitle>
            <SheetDescription>Link to invoice, job sheet, quotation, or other</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={manualIncome} onChange={e => setManualIncome(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Reference (Invoice/Job Sheet/Quote #)</Label>
              <Input value={incomeRef} onChange={e => setIncomeRef(e.target.value)} placeholder="INV-00001 / JOB-2026-00001 / QT-00001" />
            </div>
            <Button className="w-full" onClick={() => addManualEntry("income")}>Record Income</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manual Expense Sheet */}
      <Sheet open={expenseSheetOpen} onOpenChange={setExpenseSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record Manual Expense</SheetTitle>
            <SheetDescription>Link to repair, invoice, or other reference</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={manualExpense} onChange={e => setManualExpense(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Reference (Repair/Invoice/Other)</Label>
              <Input value={expenseRef} onChange={e => setExpenseRef(e.target.value)} placeholder="JOB-2026-00001 / Parts purchase / Other" />
            </div>
            <Button className="w-full" onClick={() => addManualEntry("expense")}>Record Expense</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────
function AuditLogTab({ entries }: { entries: AuditEntry[] }) {
  const [search, setSearch] = useState("");
  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.action.toLowerCase().includes(q) ||
      e.details?.toLowerCase().includes(q) ||
      e.staff_name?.toLowerCase().includes(q) ||
      e.user_role?.toLowerCase().includes(q) ||
      e.entity_type?.toLowerCase().includes(q) ||
      format(new Date(e.created_at), "dd MMM yyyy HH:mm").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search actions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead><TableHead>Staff</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit entries</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell><Badge variant="outline">{e.action}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">{e.details || "—"}</TableCell>
                <TableCell>{e.staff_name || "—"}</TableCell>
                <TableCell className="capitalize">{e.user_role || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
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
    if (n === 0) return "Zero";
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
    if (n < 1000) return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " and " + numberToWords(n%100) : "");
    if (n < 100000) return numberToWords(Math.floor(n/1000)) + " Thousand" + (n%1000 ? " " + numberToWords(n%1000) : "");
    if (n < 10000000) return numberToWords(Math.floor(n/100000)) + " Lakh" + (n%100000 ? " " + numberToWords(n%100000) : "");
    return numberToWords(Math.floor(n/10000000)) + " Crore" + (n%10000000 ? " " + numberToWords(n%10000000) : "");
  };

  return (
    <div className="space-y-4 print:p-6" id="receipt-slip">
      <div className="text-center border-b border-dashed border-border pb-3">
        <h3 className="text-lg font-bold text-foreground">
          {transaction.type === "income" ? "RECEIPT" : "PAYMENT VOUCHER"}
        </h3>
        <p className="text-xs text-muted-foreground">#{transaction.transaction_id}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Date</p>
          <p className="font-medium">{format(new Date(transaction.date), "dd MMM yyyy")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Payment Mode</p>
          <p className="font-medium capitalize">{transaction.payment_mode || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Account</p>
          <p className="font-medium">{acctName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Category</p>
          <p className="font-medium">{catName}</p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 text-center">
        <p className="text-xs text-muted-foreground mb-1">Amount</p>
        <p className="text-3xl font-bold text-foreground">₹{transaction.amount.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1 italic">
          {numberToWords(Math.floor(transaction.amount))} Rupees Only
        </p>
      </div>

      {transaction.reference && (
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Reference</p>
          <p className="font-medium">{transaction.reference}</p>
        </div>
      )}
      {transaction.description && (
        <div className="text-sm">
          <p className="text-xs text-muted-foreground">Description</p>
          <p>{transaction.description}</p>
        </div>
      )}
      <div className="text-sm">
        <p className="text-xs text-muted-foreground">Recorded By</p>
        <p className="font-medium">{transaction.staff_name || "—"}</p>
      </div>

      <div className="flex justify-between pt-8 border-t border-dashed border-border mt-4">
        <div className="text-center">
          <div className="w-32 border-t border-foreground/30 mt-8"></div>
          <p className="text-xs text-muted-foreground mt-1">{transaction.type === "income" ? "Received By" : "Paid By"}</p>
        </div>
        <div className="text-center">
          <div className="w-32 border-t border-foreground/30 mt-8"></div>
          <p className="text-xs text-muted-foreground mt-1">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}
