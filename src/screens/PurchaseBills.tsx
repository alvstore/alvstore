"use client";

import { Box, Button, FormLabel, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useLocation } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Receipt, Trash2, CheckCircle, IndianRupee } from "lucide-react";
interface BillItem {
    product_name: string;
    quantity: number;
    unit_price: number;
    gst_percentage: number;
    total: number;
    product_id?: string | null;
    serial_numbers?: string;
    batch_number?: string;
    expiry_date?: string;
}
export default function PurchaseBills() {
    const { user } = useAuth();
    const location = useLocation();
    const [bills, setBills] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" });
    const [items, setItems] = useState<BillItem[]>([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
    const fetchBills = async () => {
        setLoading(true);
        let q = supabase.from("purchase_bills").select("*, suppliers(name)").order("created_at", { ascending: false });
        if (search)
            q = q.ilike("bill_number", `%${search}%`);
        const { data } = await q;
        setBills(data || []);
        setLoading(false);
    };
    const fetchMasters = async () => {
        const [{ data: s }, { data: p }] = await Promise.all([
            supabase.from("suppliers").select("id, name").eq("status", "active"),
            supabase.from("products").select("id, name, selling_price, gst_percentage"),
        ]);
        setSuppliers(s || []);
        setProducts(p || []);
    };
    useEffect(() => { fetchBills(); fetchMasters(); }, [search]);
    // Handle PO conversion
    useEffect(() => {
        const state = location.state as any;
        if (state?.fromPO) {
            setForm(f => ({ ...f, supplier_id: state.fromPO.supplier_id || "", po_id: state.fromPO.id }));
            if (state.items) {
                setItems(state.items.map((i: any) => ({
                    product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price,
                    gst_percentage: i.gst_percentage, total: i.total, product_id: i.product_id,
                })));
            }
            setSheetOpen(true);
        }
    }, [location.state]);
    const calcItem = (item: BillItem): BillItem => {
        const base = item.quantity * item.unit_price;
        const gst = base * (item.gst_percentage / 100);
        return { ...item, total: base + gst };
    };
    const updateItem = (idx: number, field: string, value: any) => {
        setItems(prev => {
            const updated = [...prev];
            updated[idx] = calcItem({ ...updated[idx], [field]: value });
            return updated;
        });
    };
    const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
    const handleSave = async () => {
        if (!form.supplier_id) {
            toast.error("Select a supplier");
            return;
        }
        if (items.some(i => !i.product_name)) {
            toast.error("All items need a name");
            return;
        }
        setSaving(true);
        const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
        const gst_amount = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.gst_percentage / 100), 0);
        const { data: bill, error } = await supabase.from("purchase_bills").insert({
            supplier_id: form.supplier_id, po_id: form.po_id || null,
            notes: form.notes || null, bill_date: form.bill_date, due_date: form.due_date || null,
            subtotal, gst_amount, total: subtotal + gst_amount, created_by: user?.id,
        } as any).select().single();
        if (error || !bill) {
            toast.error(error?.message || "Failed");
            setSaving(false);
            return;
        }
        await supabase.from("purchase_bill_items").insert(items.map(i => ({
            bill_id: bill.id, product_name: i.product_name, product_id: i.product_id || null,
            quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
            total: i.total, serial_numbers: i.serial_numbers ? i.serial_numbers.split(",").map(s => s.trim()) : null,
            batch_number: i.batch_number || null, expiry_date: i.expiry_date || null,
        } as any)));
        // Update PO status if from PO
        if (form.po_id) {
            await supabase.from("purchase_orders").update({ status: "completed", updated_at: new Date().toISOString() } as any).eq("id", form.po_id);
        }
        toast.success("Purchase bill created");
        setSaving(false);
        setSheetOpen(false);
        setForm({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" });
        setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
        fetchBills();
    };
    const confirmBill = async (bill: any) => {
        // 1. Update bill status
        await supabase.from("purchase_bills").update({ status: "confirmed" } as any).eq("id", bill.id);
        // 2. Get bill items and create stock movements
        const { data: billItems } = await supabase.from("purchase_bill_items").select("*").eq("bill_id", bill.id);
        if (billItems) {
            for (const item of billItems) {
                if (item.product_id) {
                    await supabase.from("stock_movements").insert({
                        product_id: item.product_id, quantity: item.quantity, type: "in",
                        reference: `PB: ${bill.bill_number}`, notes: `Purchase bill ${bill.bill_number}`,
                        created_by: user?.id,
                    } as any);
                }
            }
        }
        // 3. Update supplier outstanding balance
        await supabase.from("suppliers").update({
            outstanding_balance: (bill.suppliers?.outstanding_balance || 0) + (bill.total || 0),
            updated_at: new Date().toISOString(),
        } as any).eq("id", bill.supplier_id);
        // 4. Create finance expense transaction
        const { data: accounts } = await supabase.from("finance_accounts").select("id").limit(1);
        if (accounts && accounts.length > 0) {
            await supabase.from("finance_transactions").insert({
                type: "expense", amount: bill.total || 0, account_id: accounts[0].id,
                description: `Purchase Bill: ${bill.bill_number}`, reference: bill.bill_number,
                date: bill.bill_date, created_by: user?.id,
            } as any);
        }
        toast.success("Bill confirmed, stock updated");
        fetchBills();
    };
    const totalValue = bills.filter(b => b.status !== "cancelled").reduce((s, b) => s + (b.total || 0), 0);
    const totalUnpaid = bills.filter(b => b.payment_status === "unpaid" && b.status !== "cancelled").reduce((s, b) => s + ((b.total || 0) - (b.paid_amount || 0)), 0);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Purchase Bills"} subtitle={"Manage purchase bills and stock entries"} actions={<><Button onClick={() => { setForm({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Bill
        </Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total Bills"} value={bills.length} icon={<Box component={Receipt} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Confirmed"} value={bills.filter(b => b.status === "confirmed").length} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Total Value"} value={totalValue} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
        <StatCard label={"Unpaid"} value={totalUnpaid} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search bill number..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={7} empty={bills.length === 0} emptyMessage={"No purchase bills"}>
            <TableHead><TableRow>
              <TableCell>Bill #</TableCell><TableCell>Supplier</TableCell><TableCell>Date</TableCell>
              <TableCell>Total</TableCell><TableCell>Payment</TableCell><TableCell>Status</TableCell><TableCell sx={{ width: "7rem" }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{bills.map(b => (<TableRow key={b.id}>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{b.bill_number}</TableCell>
                  <TableCell>{b.suppliers?.name || "—"}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{b.bill_date}</TableCell>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(b.total || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusChip label={b.payment_status}/></TableCell>
                  <TableCell><StatusChip label={b.status}/></TableCell>
                  <TableCell>
                    {b.status === "draft" && (<Button onClick={() => confirmBill(b)} variant="outlined" size="small">Confirm</Button>)}
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      {/* Create Bill Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={"New Purchase Bill"}
        description={"Record a purchase bill and update stock"}
        width={680}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>{saving ? "Creating..." : "Create Purchase Bill"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.supplier_id} label={"Supplier *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, supplier_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select supplier"}</MenuItem>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.bill_date} onChange={e => setForm(p => ({ ...p, bill_date: e.target.value }))} label={"Bill Date"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} label={"Due Date"} size="small" fullWidth/></Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Items</FormLabel>
                <Button onClick={addItem} variant="outlined" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Add</Button>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                {items.map((item, idx) => (<Box key={idx} sx={{ padding: "0.75rem", borderRadius: "var(--radius)", borderWidth: "1px", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    <Box sx={{ display: "flex", gap: "0.5rem" }}>
                      <TextField select size="small" fullWidth value="" onChange={event => (v => {
            const prod = products.find(p => p.id === v);
            if (prod)
                updateItem(idx, "product_name", prod.name);
            setItems(prev => { const u = [...prev]; u[idx] = calcItem({ ...u[idx], product_id: v, product_name: prod?.name || "", unit_price: prod?.selling_price || 0, gst_percentage: prod?.gst_percentage || 18 }); return u; });
        })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: "1 1 0%" }}><MenuItem value="" disabled>{"Select product"}</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField>
                      {items.length > 1 && <IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"}><Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/></IconButton>}
                    </Box>
                    <TextField placeholder="Item name" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Item name" } }}/>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <Box><TextField type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} label={"Qty"} size="small" fullWidth slotProps={{ htmlInput: { min: 1 } }}/></Box>
                      <Box><TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} label={"Price"} size="small" fullWidth/></Box>
                      <Box><TextField type="number" value={item.gst_percentage} onChange={e => updateItem(idx, "gst_percentage", parseFloat(e.target.value) || 0)} label={"GST %"} size="small" fullWidth/></Box>
                      <Box><TextField value={`₹${item.total.toFixed(2)}`} label={"Total"} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true } }} sx={{ backgroundColor: "hsl(var(--muted))" }}/></Box>
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <Box><TextField placeholder="Comma separated" value={item.serial_numbers || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], serial_numbers: e.target.value }; return u; })} label={"Serial #s"} size="small" fullWidth/></Box>
                      <Box><TextField value={item.batch_number || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], batch_number: e.target.value }; return u; })} label={"Batch"} size="small" fullWidth/></Box>
                      <Box><TextField type="date" value={item.expiry_date || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], expiry_date: e.target.value }; return u; })} label={"Expiry"} size="small" fullWidth/></Box>
                    </Box>
                  </Box>))}
              </Box>
              <Box sx={{ marginTop: "0.75rem", textAlign: "right" }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700" }}>Total: ₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</Typography>
              </Box>
            </Box>

            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} label={"Notes"} size="small" fullWidth multiline/></Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
