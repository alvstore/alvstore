"use client";

import { Box, Button, Card, CardContent, Divider, FormLabel, IconButton, MenuItem, Switch, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Send, Trash2, Plus, Truck, Car } from "lucide-react";
interface Product {
    id: string;
    name: string;
    selling_price: number | null;
    gst_percentage: number | null;
}
interface Customer {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
}
interface ChallanItem {
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    hsn_code: string;
    gst_percentage: number;
    gst_amount: number;
}
export default function DeliveryChallanAdd() {
    const { user } = useAuth();
    const { id: editId } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [saving, setSaving] = useState(false);
    const isEditing = !!editId;
    const [customerId, setCustomerId] = useState("");
    const [notes, setNotes] = useState("");
    const [deliveryPerson, setDeliveryPerson] = useState("");
    const [vehicleNumber, setVehicleNumber] = useState("");
    const [gstInclusive, setGstInclusive] = useState(false);
    const [items, setItems] = useState<ChallanItem[]>([]);
    useEffect(() => {
        Promise.all([
            supabase.from("customers").select("id, name, phone, address, gst_number").order("name"),
            supabase.from("products").select("id, name, selling_price, gst_percentage").order("name"),
        ]).then(([c, p]) => {
            setCustomers(c.data || []);
            setProducts(p.data || []);
        });
    }, []);
    useEffect(() => {
        if (!editId)
            return;
        (async () => {
            const { data: ch } = await (supabase as any).from("delivery_challans").select("*").eq("id", editId).single();
            if (ch) {
                setCustomerId(ch.customer_id || "");
                setNotes(ch.notes || "");
                setDeliveryPerson(ch.delivery_person || "");
                setVehicleNumber(ch.vehicle_number || "");
                setGstInclusive(ch.gst_inclusive || false);
            }
            const { data: itms } = await (supabase as any).from("delivery_challan_items").select("*").eq("challan_id", editId);
            if (itms)
                setItems(itms.map((i: any) => ({
                    product_id: i.product_id, product_name: i.product_name,
                    quantity: i.quantity, unit_price: i.unit_price, total: i.total,
                    hsn_code: i.hsn_code || "", gst_percentage: i.gst_percentage ?? 18, gst_amount: i.gst_amount || 0,
                })));
        })();
    }, [editId]);
    const addItem = (productId: string) => {
        const p = products.find(pr => pr.id === productId);
        if (!p)
            return;
        const price = p.selling_price || 0;
        const gstPct = p.gst_percentage ?? 18;
        const gstAmt = gstInclusive ? (price * gstPct) / (100 + gstPct) : (price * gstPct) / 100;
        setItems([...items, {
                product_id: p.id, product_name: p.name, quantity: 1,
                unit_price: price, total: price, hsn_code: "", gst_percentage: gstPct, gst_amount: gstAmt,
            }]);
    };
    const recalcItem = (item: ChallanItem): ChallanItem => {
        const base = item.quantity * item.unit_price;
        const gstAmt = gstInclusive
            ? (base * item.gst_percentage) / (100 + item.gst_percentage)
            : (base * item.gst_percentage) / 100;
        return { ...item, total: base, gst_amount: Math.round(gstAmt * 100) / 100 };
    };
    const updateItem = (idx: number, updates: Partial<ChallanItem>) => {
        setItems(items.map((item, i) => i !== idx ? item : recalcItem({ ...item, ...updates })));
    };
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const totalGst = items.reduce((s, i) => s + i.gst_amount, 0);
    const grandTotal = gstInclusive ? subtotal : subtotal + totalGst;
    const handleSave = async () => {
        if (!customerId) {
            toast.error("Select a customer");
            return;
        }
        if (items.length === 0) {
            toast.error("Add at least one item");
            return;
        }
        setSaving(true);
        try {
            const challanPayload: any = {
                customer_id: customerId, notes: notes || null,
                delivery_person: deliveryPerson || null, vehicle_number: vehicleNumber || null,
                gst_inclusive: gstInclusive, subtotal, gst_amount: totalGst, total: grandTotal,
            };
            if (isEditing) {
                await (supabase as any).from("delivery_challans").update(challanPayload).eq("id", editId);
                await (supabase as any).from("delivery_challan_items").delete().eq("challan_id", editId);
                await (supabase as any).from("delivery_challan_items").insert(items.map(i => ({
                    challan_id: editId, product_id: i.product_id, product_name: i.product_name,
                    quantity: i.quantity, unit_price: i.unit_price, total: i.total,
                    hsn_code: i.hsn_code || null, gst_percentage: i.gst_percentage, gst_amount: i.gst_amount,
                })));
                toast.success("Challan updated");
                navigate(`/challans/${editId}`);
            }
            else {
                const { data: ch, error } = await (supabase as any).from("delivery_challans").insert({
                    challan_number: "", ...challanPayload, created_by: user?.id,
                }).select().single();
                if (error)
                    throw error;
                await (supabase as any).from("delivery_challan_items").insert(items.map(i => ({
                    challan_id: ch.id, product_id: i.product_id, product_name: i.product_name,
                    quantity: i.quantity, unit_price: i.unit_price, total: i.total,
                    hsn_code: i.hsn_code || null, gst_percentage: i.gst_percentage, gst_amount: i.gst_amount,
                })));
                toast.success("Challan created — " + ch.challan_number);
                navigate(`/challans/${ch.id}`);
            }
        }
        catch (err: any) {
            toast.error(err.message);
        }
        setSaving(false);
    };
    const selectedCustomer = customers.find(c => c.id === customerId);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={isEditing ? "Edit Delivery Challan" : "New Delivery Challan"} subtitle={"Items to be delivered before invoicing"} actions={<><IconButton onClick={() => navigate("/challans")} aria-label={"Arrow Left"}><Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }}/></IconButton></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          {/* Customer & Delivery Info */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            <CardContent sx={{ padding: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={customerId} label={"Customer *"} select size="small" fullWidth onChange={event => setCustomerId(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select customer"}</MenuItem>{customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField>
                </Box>
                {selectedCustomer && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{selectedCustomer.name}</Typography>
                    {selectedCustomer.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.phone}</Typography>}
                    {selectedCustomer.address && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.address}</Typography>}
                    {selectedCustomer.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontFamily: "JetBrains Mono, monospace", color: "hsl(var(--muted-foreground))" }}>GST: {selectedCustomer.gst_number}</Typography>}
                  </Box>)}
              </Box>

              <Divider />

              {/* Delivery Person & Vehicle */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={deliveryPerson} onChange={e => setDeliveryPerson(e.target.value)} placeholder="Driver / delivery person name" label={<><Box component={Truck} sx={{ height: "0.875rem", width: "0.875rem" }}/>Delivery Person</>} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="e.g. MH-12-AB-1234" label={<><Box component={Car} sx={{ height: "0.875rem", width: "0.875rem" }}/>Vehicle Number</>} size="small" fullWidth/>
                </Box>
              </Box>

              <Divider />

              {/* GST Toggle */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>GST Inclusive</FormLabel>
                <Switch checked={gstInclusive} onChange={(event, checked) => setGstInclusive(checked)}/>
              </Box>

              {/* Items */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                  <TextField label={"Items"} select size="small" fullWidth value="" onChange={event => addItem(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "200px", fontSize: "0.75rem", lineHeight: "1rem" }}><MenuItem value="" disabled>{"+ Add Item"}</MenuItem>{products.map(p => <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{p.name} — ₹{p.selling_price}</MenuItem>)}</TextField>
                </Box>

                {items.length === 0 ? (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "2px", borderStyle: "dashed", borderColor: "hsl(var(--border))", padding: "2rem", textAlign: "center" }}>
                    <Box component={Plus} sx={{ height: "2rem", width: "2rem", marginLeft: "auto", marginRight: "auto", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 40%, transparent)", marginBottom: "0.5rem" }}/>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>Add items to the delivery challan</Typography>
                  </Box>) : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", overflow: "hidden" }}>
                    <DataTable columnsCount={7} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      <TableHead><TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderBottomWidth: "1px" }}>
                        <TableCell sx={{ textAlign: "left", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Item</TableCell>
                        <TableCell sx={{ textAlign: "left", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "5rem" }}>HSN</TableCell>
                        <TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "6rem" }}>Rate</TableCell>
                        <TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "4rem" }}>Qty</TableCell>
                        <TableCell sx={{ textAlign: "right", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "4rem" }}>GST%</TableCell>
                        <TableCell sx={{ textAlign: "right", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "6rem" }}>Total</TableCell>
                        <TableCell sx={{ width: "2.5rem" }}/>
                      </TableRow></TableHead>
                      <TableBody>
                        {items.map((item, idx) => (<TableRow key={idx} sx={{ borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "&:last-child": { borderWidth: "0px" } }}>
                            <TableCell sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", fontWeight: "500" }}>{item.product_name}</TableCell>
                            <TableCell sx={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}><TextField value={item.hsn_code} onChange={e => updateItem(idx, { hsn_code: e.target.value })} placeholder="HSN" size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "HSN" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}/></TableCell>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}><TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", textAlign: "right" }}/></TableCell>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}><TextField type="number" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { min: "1", "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", textAlign: "right" }}/></TableCell>
                            <TableCell sx={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}><TextField type="number" value={item.gst_percentage} onChange={e => updateItem(idx, { gst_percentage: parseFloat(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", textAlign: "right" }}/></TableCell>
                            <TableCell sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", textAlign: "right", fontWeight: "600" }}>₹{item.total.toFixed(2)}</TableCell>
                            <TableCell sx={{ paddingRight: "0.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}><IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--destructive))" } }}><Box component={Trash2} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton></TableCell>
                          </TableRow>))}
                      </TableBody>
                    </DataTable>
                  </Box>)}
              </Box>

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Delivery instructions..." label={"Notes"} size="small" fullWidth multiline/>
              </Box>

              {/* Totals */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "100%", maxWidth: "20rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                  <Divider sx={{ marginBottom: "0.75rem" }}/>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box><Box component="span">₹{subtotal.toFixed(2)}</Box></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>CGST</Box><Box component="span">₹{(totalGst / 2).toFixed(2)}</Box></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>SGST</Box><Box component="span">₹{(totalGst / 2).toFixed(2)}</Box></Box>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Box component="span" sx={{ fontWeight: "600" }}>Grand Total</Box>
                    <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700" }}>₹{grandTotal.toFixed(2)}</Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", position: "sticky", top: "1.5rem" }}>
            <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ width: "100%" }}>
                <Box component={Send} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{saving ? "Saving..." : "Save Challan"}
              </Button>
              <Button onClick={() => navigate("/challans")} variant="outlined" sx={{ width: "100%" }}>Cancel</Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
