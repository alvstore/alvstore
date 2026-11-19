"use client";

import { Box, Button, Card, CardContent, Divider, IconButton, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer, Receipt, Truck, Pencil, Car, User } from "lucide-react";
import { format } from "date-fns";
interface ChallanData {
    id: string;
    challan_number: string;
    status: string;
    notes: string | null;
    invoice_id: string | null;
    created_at: string;
    delivery_person: string | null;
    vehicle_number: string | null;
    receiver_signature: string | null;
    gst_inclusive: boolean;
    subtotal: number;
    gst_amount: number;
    total: number;
    customers?: {
        name: string;
        phone: string | null;
        address: string | null;
        gst_number: string | null;
    } | null;
}
interface ChallanItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    hsn_code: string | null;
    gst_percentage: number;
    gst_amount: number;
}
const statusColors = {
    draft: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }, sent: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    delivered: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, invoiced: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
};
export default function DeliveryChallanPreview() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [challan, setChallan] = useState<ChallanData | null>(null);
    const [items, setItems] = useState<ChallanItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!id)
            return;
        (async () => {
            const { data: ch } = await (supabase as any).from("delivery_challans").select("*, customers(name, phone, address, gst_number)").eq("id", id).single();
            setChallan(ch as any);
            const { data: itms } = await (supabase as any).from("delivery_challan_items").select("*").eq("challan_id", id);
            setItems((itms || []) as any);
            setLoading(false);
        })();
    }, [id]);
    const updateStatus = async (status: string) => {
        if (!id)
            return;
        await (supabase as any).from("delivery_challans").update({ status }).eq("id", id);
        setChallan(prev => prev ? { ...prev, status } : prev);
        toast.success(`Status updated to ${status}`);
    };
    const convertToInvoice = async () => {
        if (!challan)
            return;
        try {
            const { data: inv, error } = await supabase.from("invoices").insert({
                customer_id: (challan as any).customer_id || null,
                subtotal: challan.subtotal || items.reduce((s, i) => s + i.total, 0),
                gst_amount: challan.gst_amount || 0,
                total: challan.total || items.reduce((s, i) => s + i.total, 0),
                gst_inclusive: challan.gst_inclusive,
                notes: `Converted from ${challan.challan_number}`,
            } as any).select().single();
            if (error)
                throw error;
            const invItems = items.map(i => ({
                invoice_id: inv.id, product_name: i.product_name,
                quantity: i.quantity, unit_price: i.unit_price, total: i.total,
                hsn_code: i.hsn_code || null, gst_percentage: i.gst_percentage,
            }));
            await supabase.from("invoice_items").insert(invItems);
            await (supabase as any).from("delivery_challans").update({ status: "invoiced", invoice_id: inv.id }).eq("id", id);
            toast.success("Invoice created — " + (inv as any).invoice_number);
            navigate(`/invoices/${inv.id}`);
        }
        catch (err: any) {
            toast.error(err.message);
        }
    };
    if (loading)
        return <AnimatedPage><Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography></AnimatedPage>;
    if (!challan)
        return <AnimatedPage><Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Challan not found</Typography></AnimatedPage>;
    const subtotal = challan.subtotal || items.reduce((s, i) => s + i.total, 0);
    const totalGst = challan.gst_amount || items.reduce((s, i) => s + (i.gst_amount || 0), 0);
    const grandTotal = challan.total || (challan.gst_inclusive ? subtotal : subtotal + totalGst);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={challan.challan_number} subtitle={"Delivery Challan"} actions={<><IconButton onClick={() => navigate("/challans")} aria-label={"Arrow Left"}><Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }}/></IconButton><StatusChip label={challan.status} sx={statusColors[challan.status] || { backgroundColor: "hsl(var(--muted))" }}/></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        <Box data-print-area sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" } }}>
          <Card>
            <CardContent sx={{ padding: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {/* Header */}
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700" }}>{challan.challan_number}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{format(new Date(challan.created_at), "dd MMM yyyy")}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{(challan.customers as any)?.name || "—"}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{(challan.customers as any)?.phone}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{(challan.customers as any)?.address}</Typography>
                  {(challan.customers as any)?.gst_number && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontFamily: "JetBrains Mono, monospace", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>GST: {(challan.customers as any).gst_number}</Typography>)}
                </Box>
              </Box>

              {/* Delivery Info */}
              {(challan.delivery_person || challan.vehicle_number) && (<>
                  <Divider />
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
                    {challan.delivery_person && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Box component={User} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
                        <Box>
                          <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Delivery Person</Typography>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{challan.delivery_person}</Typography>
                        </Box>
                      </Box>)}
                    {challan.vehicle_number && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Box component={Car} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
                        <Box>
                          <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Vehicle Number</Typography>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{challan.vehicle_number}</Typography>
                        </Box>
                      </Box>)}
                  </Box>
                </>)}

              <Divider />

              {/* Items Table */}
              <DataTable columnsCount={6} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                <TableHead><TableRow sx={{ borderBottomWidth: "1px" }}>
                  <TableCell sx={{ textAlign: "left", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Item</TableCell>
                  <TableCell sx={{ textAlign: "left", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "5rem" }}>HSN</TableCell>
                  <TableCell sx={{ textAlign: "right", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "5rem" }}>Rate</TableCell>
                  <TableCell sx={{ textAlign: "right", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "4rem" }}>Qty</TableCell>
                  <TableCell sx={{ textAlign: "right", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "4rem" }}>GST%</TableCell>
                  <TableCell sx={{ textAlign: "right", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", width: "6rem" }}>Total</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {items.map(i => (<TableRow key={i.id} sx={{ borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 30%, transparent)" }}>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", fontWeight: "500" }}>{i.product_name}</TableCell>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{i.hsn_code || "—"}</TableCell>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", textAlign: "right" }}>₹{i.unit_price}</TableCell>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", textAlign: "right" }}>{i.quantity}</TableCell>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", textAlign: "right" }}>{i.gst_percentage}%</TableCell>
                      <TableCell sx={{ paddingTop: "0.625rem", paddingBottom: "0.625rem", textAlign: "right", fontWeight: "600" }}>₹{i.total.toFixed(2)}</TableCell>
                    </TableRow>))}
                </TableBody>
              </DataTable>

              {/* Totals */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "14rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                  <Divider sx={{ marginBottom: "0.5rem" }}/>
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

              {/* Receiver Signature */}
              {challan.receiver_signature && (<>
                  <Divider />
                  <Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontWeight: "500", marginBottom: "0.5rem" }}>Receiver Signature</Typography>
                    <Box src={challan.receiver_signature} alt="Signature" component="img" sx={{ maxHeight: "5rem", borderWidth: "1px", borderRadius: "0.25rem" }}/>
                  </Box>
                </>)}

              {challan.notes && (<>
                  <Divider />
                  <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontWeight: "500", marginBottom: "0.25rem" }}>Notes</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{challan.notes}</Typography></Box>
                </>)}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, "@media print": { display: "none" } }}>
          <Card>
            <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Button onClick={() => navigate(`/challans/${id}/edit`)} variant="outlined" sx={{ width: "100%" }}>
                <Box component={Pencil} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Edit
              </Button>
              <Button onClick={() => window.print()} variant="outlined" sx={{ width: "100%" }}>
                <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Print
              </Button>
              {challan.status === "draft" && (<Button onClick={() => updateStatus("sent")} variant="contained" sx={{ width: "100%" }}>
                  <Box component={Truck} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Mark as Sent
                </Button>)}
              {challan.status === "sent" && (<Button onClick={() => updateStatus("delivered")} variant="contained" sx={{ width: "100%", backgroundColor: "hsl(var(--success))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 90%, transparent)" } }}>
                  <Box component={Truck} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Mark Delivered
                </Button>)}
              {(challan.status === "delivered" || challan.status === "sent") && !challan.invoice_id && (<Button onClick={convertToInvoice} variant="contained" sx={{ width: "100%" }}>
                  <Box component={Receipt} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Convert to Invoice
                </Button>)}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
