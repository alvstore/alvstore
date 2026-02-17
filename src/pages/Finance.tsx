import { useState, useEffect, useMemo } from "react";
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
  staff_name: string | null;
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Cash Balance", value: cashBalance, icon: Wallet, color: "bg-success/10 text-success" },
              { label: "Bank Balance", value: bankBalance, icon: Landmark, color: "bg-primary/10 text-primary" },
              { label: "Today Income", value: todayIncome, icon: TrendingUp, color: "bg-info/10 text-info" },
              { label: "Today Expense", value: todayExpense, icon: TrendingDown, color: "bg-destructive/10 text-destructive" },
              { label: "Monthly Income", value: monthlyIncome, icon: TrendingUp, color: "bg-success/10 text-success" },
              { label: "Monthly Expense", value: monthlyExpense, icon: TrendingDown, color: "bg-warning/10 text-warning" },
              { label: "Net Balance", value: netBalance, icon: DollarSign, color: "bg-accent/10 text-accent" },
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
  const [search, setSearch] = useState("");
  const filtered = transactions.filter(t => t.type === type && (!search || t.transaction_id.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())));

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setForm({ date: format(new Date(), "yyyy-MM-dd"), amount: "", payment_mode: "cash", account_id: "", category_id: "", customer_name: "", reference: "", description: "" }); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add {type === "income" ? "Income" : "Expense"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Staff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No {type} entries</TableCell></TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.transaction_id}</TableCell>
                <TableCell>{format(new Date(t.date), "dd MMM yyyy")}</TableCell>
                <TableCell className="capitalize">{t.payment_mode}</TableCell>
                <TableCell className="text-right font-medium">₹{t.amount.toLocaleString()}</TableCell>
                <TableCell className="text-muted-foreground">{t.reference || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{t.staff_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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

// ─── Cash Control Tab ─────────────────────────
function CashControlTab({ records, staffName, userId, onRefresh }: {
  records: CashControl[]; staffName: string; userId?: string; onRefresh: () => void;
}) {
  const [form, setForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), opening_cash: "", closing_cash: "" });

  const handleSave = async () => {
    const oc = parseFloat(form.opening_cash) || 0;
    const cc = form.closing_cash ? parseFloat(form.closing_cash) : null;
    const diff = cc != null ? cc - oc : null;
    const { error } = await supabase.from("daily_cash_control").insert({
      date: form.date, opening_cash: oc, closing_cash: cc, difference: diff,
      staff_name: staffName, created_by: userId,
    });
    if (error) {
      if (error.code === "23505") toast.error("Record for this date already exists");
      else toast.error(error.message);
    } else { toast.success("Cash record saved"); onRefresh(); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Cash Entry</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Opening Cash</Label><Input type="number" value={form.opening_cash} onChange={e => setForm(p => ({ ...p, opening_cash: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Closing Cash</Label><Input type="number" value={form.closing_cash} onChange={e => setForm(p => ({ ...p, closing_cash: e.target.value }))} /></div>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Closing</TableHead><TableHead className="text-right">Difference</TableHead><TableHead>Staff</TableHead></TableRow></TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records</TableCell></TableRow>
            ) : records.map(r => (
              <TableRow key={r.id}>
                <TableCell>{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-right">₹{r.opening_cash.toLocaleString()}</TableCell>
                <TableCell className="text-right">{r.closing_cash != null ? `₹${r.closing_cash.toLocaleString()}` : "—"}</TableCell>
                <TableCell className={`text-right font-medium ${r.difference != null && r.difference < 0 ? "text-destructive" : r.difference != null && r.difference > 0 ? "text-success" : ""}`}>
                  {r.difference != null ? `₹${r.difference.toLocaleString()}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.staff_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────
function AuditLogTab({ entries }: { entries: AuditEntry[] }) {
  const [search, setSearch] = useState("");
  const filtered = entries.filter(e => !search || e.action.toLowerCase().includes(search.toLowerCase()) || e.details?.toLowerCase().includes(search.toLowerCase()));

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
