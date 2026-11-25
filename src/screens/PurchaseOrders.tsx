"use client";

import { Box, Button, FormLabel, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, ShoppingCart, FileText, Trash2, Package } from "lucide-react";
interface PO {
    id: string;
    po_number: string;
    supplier_id: string | null;
    status: string;
    subtotal: number;
    gst_amount: number;
    total: number;
    notes: string | null;
    expected_date: string | null;
    created_at: string;
    suppliers?: {
        name: string;
    } | null;
}
interface POItem {
    id?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    gst_percentage: number;
    total: number;
    product_id?: string | null;
}
const statusColors = {
    draft: "secondary", sent: "default", approved: "default",
    partially_received: "outline", completed: "default", cancelled: "destructive",
};
export default function PurchaseOrders() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState<PO[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ supplier_id: "", notes: "", expected_date: "" });
    const [items, setItems] = useState<POItem[]>([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
    const fetchOrders = async () => {
        setLoading(true);
        let q = supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
        if (search)
            q = q.ilike("po_number", `%${search}%`);
        const { data } = await q;
        setOrders((data || []) as PO[]);
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
    useEffect(() => { fetchOrders(); fetchMasters(); }, [search]);
    const calcItem = (item: POItem): POItem => {
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
    const selectProduct = (idx: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setItems(prev => {
                const updated = [...prev];
                updated[idx] = calcItem({
                    ...updated[idx],
                    product_name: product.name,
                    product_id: product.id,
                    unit_price: product.selling_price || 0,
                    gst_percentage: product.gst_percentage || 18,
                });
                return updated;
            });
        }
    };
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
        const { data: po, error } = await supabase.from("purchase_orders").insert({
            supplier_id: form.supplier_id, notes: form.notes || null,
            expected_date: form.expected_date || null,
            subtotal, gst_amount, total: subtotal + gst_amount,
            created_by: user?.id,
        } as any).select().single();
        if (error || !po) {
            toast.error(error?.message || "Failed");
            setSaving(false);
            return;
        }
        await supabase.from("purchase_order_items").insert(items.map(i => ({
            po_id: po.id, product_name: i.product_name, product_id: i.product_id || null,
            quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
            total: i.total,
        } as any)));
        toast.success(`PO created`);
        setSaving(false);
        setSheetOpen(false);
        setForm({ supplier_id: "", notes: "", expected_date: "" });
        setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
        fetchOrders();
    };
    const updateStatus = async (id: string, status: string) => {
        const { error } = await supabase.from("purchase_orders").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Status updated");
            fetchOrders();
        }
    };
    const convertToBill = async (po: PO) => {
        const { data: poItems } = await supabase.from("purchase_order_items").select("*").eq("po_id", po.id);
        // Navigate to purchase bills with PO data in state
        navigate("/purchase-bills", { state: { fromPO: po, items: poItems } });
    };
    const stats = {
        total: orders.length,
        draft: orders.filter(o => o.status === "draft").length,
        pending: orders.filter(o => ["sent", "approved"].includes(o.status)).length,
        value: orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0),
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Purchase Orders"} subtitle={"Create and manage purchase orders for suppliers"} actions={<><Button onClick={() => { setForm({ supplier_id: "", notes: "", expected_date: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New PO
        </Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total POs"} value={stats.total} icon={<Box component={FileText} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Drafts"} value={stats.draft} icon={<Box component={ShoppingCart} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Pending"} value={stats.pending} icon={<Box component={Package} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
        <StatCard label={"Total Value"} value={stats.value} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={ShoppingCart} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search PO number..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={6} empty={orders.length === 0} emptyMessage={"No purchase orders"}>
            <TableHead><TableRow>
              <TableCell>PO #</TableCell><TableCell>Supplier</TableCell><TableCell>Date</TableCell>
              <TableCell>Total</TableCell><TableCell>Status</TableCell><TableCell sx={{ width: "8rem" }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{orders.map(o => (<TableRow key={o.id}>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{o.po_number}</TableCell>
                  <TableCell>{o.suppliers?.name || "—"}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(o.total || 0).toLocaleString()}</TableCell>
                  <TableCell><StatusChip label={o.status.replace(/_/g, " ")}/></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: "0.25rem" }}>
                      {o.status === "draft" && (<Button onClick={() => updateStatus(o.id, "sent")} variant="outlined" size="small">Send</Button>)}
                      {o.status === "approved" && (<Button onClick={() => convertToBill(o)} variant="outlined" size="small">→ Bill</Button>)}
                      {o.status === "sent" && (<Button onClick={() => updateStatus(o.id, "approved")} variant="outlined" size="small">Approve</Button>)}
                    </Box>
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      {/* Create PO Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={"New Purchase Order"}
        description={"Create a purchase order for a supplier"}
        width={680}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>{saving ? "Creating..." : "Create Purchase Order"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.supplier_id} label={"Supplier *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, supplier_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select supplier"}</MenuItem>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.expected_date} onChange={e => setForm(p => ({ ...p, expected_date: e.target.value }))} label={"Expected Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/></Box>
            </Box>

            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Items</FormLabel>
                <Button onClick={addItem} variant="outlined" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Add</Button>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                {items.map((item, idx) => (<Box key={idx} sx={{ padding: "0.75rem", borderRadius: "var(--radius)", borderWidth: "1px", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    <Box sx={{ display: "flex", gap: "0.5rem" }}>
                      <TextField select size="small" fullWidth value="" onChange={event => (v => selectProduct(idx, v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: "1 1 0%" }}><MenuItem value="" disabled>{"Select product"}</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField>
                      {items.length > 1 && <IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"}><Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/></IconButton>}
                    </Box>
                    <TextField placeholder="Item name" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Item name" } }}/>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <Box><TextField type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} label={"Qty"} size="small" fullWidth slotProps={{ htmlInput: { min: 1 } }}/></Box>
                      <Box><TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} label={"Price"} size="small" fullWidth/></Box>
                      <Box><TextField type="number" value={item.gst_percentage} onChange={e => updateItem(idx, "gst_percentage", parseFloat(e.target.value) || 0)} label={"GST %"} size="small" fullWidth/></Box>
                      <Box><TextField value={`₹${item.total.toFixed(2)}`} label={"Total"} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true } }} sx={{ backgroundColor: "hsl(var(--muted))" }}/></Box>
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
