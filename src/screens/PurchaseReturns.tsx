"use client";

import { Box, Button, FormLabel, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, SearchToolbar, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, RotateCcw, Trash2, CheckCircle } from "lucide-react";
interface ReturnItem {
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    product_id?: string | null;
}
export default function PurchaseReturns() {
    const { user } = useAuth();
    const [returns, setReturns] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ supplier_id: "", reason: "", notes: "", bill_id: "" });
    const [items, setItems] = useState<ReturnItem[]>([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
    const fetchReturns = async () => {
        setLoading(true);
        let q = supabase.from("purchase_returns").select("*, suppliers(name)").order("created_at", { ascending: false });
        if (search)
            q = q.ilike("return_number", `%${search}%`);
        const { data } = await q;
        setReturns(data || []);
        setLoading(false);
    };
    useEffect(() => {
        fetchReturns();
        (async () => {
            const [{ data: s }, { data: p }] = await Promise.all([
                supabase.from("suppliers").select("id, name").eq("status", "active"),
                supabase.from("products").select("id, name, selling_price"),
            ]);
            setSuppliers(s || []);
            setProducts(p || []);
        })();
    }, [search]);
    const updateItem = (idx: number, field: string, value: any) => {
        setItems(prev => {
            const u = [...prev];
            u[idx] = { ...u[idx], [field]: value };
            u[idx].total = u[idx].quantity * u[idx].unit_price;
            return u;
        });
    };
    const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
    const handleSave = async () => {
        if (!form.supplier_id) {
            toast.error("Select a supplier");
            return;
        }
        setSaving(true);
        const subtotal = items.reduce((s, i) => s + i.total, 0);
        const { data: ret, error } = await supabase.from("purchase_returns").insert({
            supplier_id: form.supplier_id, bill_id: form.bill_id || null,
            reason: form.reason || null, notes: form.notes || null,
            subtotal, total: subtotal, created_by: user?.id,
        } as any).select().single();
        if (error || !ret) {
            toast.error(error?.message || "Failed");
            setSaving(false);
            return;
        }
        await supabase.from("purchase_return_items").insert(items.map(i => ({
            return_id: ret.id, product_name: i.product_name, product_id: i.product_id || null,
            quantity: i.quantity, unit_price: i.unit_price, total: i.total,
        } as any)));
        toast.success("Return created");
        setSaving(false);
        setSheetOpen(false);
        setForm({ supplier_id: "", reason: "", notes: "", bill_id: "" });
        setItems([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
        fetchReturns();
    };
    const confirmReturn = async (ret: any) => {
        await supabase.from("purchase_returns").update({ status: "confirmed" } as any).eq("id", ret.id);
        const { data: retItems } = await supabase.from("purchase_return_items").select("*").eq("return_id", ret.id);
        if (retItems) {
            for (const item of retItems) {
                if (item.product_id) {
                    await supabase.from("stock_movements").insert({
                        product_id: item.product_id, quantity: item.quantity, type: "out",
                        reference: `PR: ${ret.return_number}`, notes: `Purchase return ${ret.return_number}`,
                        created_by: user?.id,
                    } as any);
                }
            }
        }
        // Reduce supplier outstanding
        if (ret.supplier_id) {
            const { data: supplier } = await supabase.from("suppliers").select("outstanding_balance").eq("id", ret.supplier_id).single();
            if (supplier) {
                await supabase.from("suppliers").update({
                    outstanding_balance: Math.max(0, (supplier.outstanding_balance || 0) - (ret.total || 0)),
                    updated_at: new Date().toISOString(),
                } as any).eq("id", ret.supplier_id);
            }
        }
        toast.success("Return confirmed, stock adjusted");
        fetchReturns();
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Purchase Returns"} subtitle={"Return items to suppliers and adjust inventory"} actions={<><Button onClick={() => { setForm({ supplier_id: "", reason: "", notes: "", bill_id: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]); setSheetOpen(true); }} variant="contained">
          <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Return
        </Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total Returns"} value={returns.length} icon={<Box component={RotateCcw} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Pending"} value={returns.filter(r => r.status === "draft").length} icon={<Box component={RotateCcw} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Credited"} value={returns.filter(r => r.status === "confirmed").reduce((s, r) => s + (r.total || 0), 0)} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search return number..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={7} empty={returns.length === 0} emptyMessage={"No purchase returns"}>
            <TableHead><TableRow>
              <TableCell>Return #</TableCell><TableCell>Supplier</TableCell><TableCell>Date</TableCell>
              <TableCell>Total</TableCell><TableCell>Reason</TableCell><TableCell>Status</TableCell><TableCell sx={{ width: "7rem" }}>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{returns.map(r => (<TableRow key={r.id}>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{r.return_number}</TableCell>
                  <TableCell>{r.suppliers?.name || "—"}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>₹{(r.total || 0).toLocaleString()}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "—"}</TableCell>
                  <TableCell><StatusChip label={r.status}/></TableCell>
                  <TableCell>
                    {r.status === "draft" && (<Button onClick={() => confirmReturn(r)} variant="outlined" size="small">Confirm</Button>)}
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={"New Purchase Return"} description={"Return items to supplier"} paperSx={{ overflowY: "auto", "@media (min-width: 640px)": { maxWidth: "36rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.supplier_id} label={"Supplier *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, supplier_id: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select supplier"}</MenuItem>{suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Defective, Wrong item, etc." label={"Reason"} size="small" fullWidth/></Box>

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
            if (prod) {
                setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], product_id: v, product_name: prod.name, unit_price: prod.selling_price || 0, total: (u[idx].quantity) * (prod.selling_price || 0) }; return u; });
            }
        })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: "1 1 0%" }}><MenuItem value="" disabled>{"Select product"}</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField>
                      {items.length > 1 && <IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"}><Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/></IconButton>}
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.5rem" }}>
                      <Box><TextField type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} label={"Qty"} size="small" fullWidth slotProps={{ htmlInput: { min: 1 } }}/></Box>
                      <Box><TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} label={"Price"} size="small" fullWidth/></Box>
                      <Box><TextField value={`₹${item.total.toFixed(2)}`} label={"Total"} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true } }} sx={{ backgroundColor: "hsl(var(--muted))" }}/></Box>
                    </Box>
                  </Box>))}
              </Box>
              <Box sx={{ marginTop: "0.75rem", textAlign: "right" }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700" }}>Total: ₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</Typography>
              </Box>
            </Box>

            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} label={"Notes"} size="small" fullWidth multiline/></Box>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ width: "100%" }}>{saving ? "Creating..." : "Create Return"}</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
