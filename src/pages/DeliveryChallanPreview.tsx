import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Receipt, Truck, Pencil, Car, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChallanData {
  id: string; challan_number: string; status: string; notes: string | null;
  invoice_id: string | null; created_at: string;
  delivery_person: string | null; vehicle_number: string | null;
  receiver_signature: string | null; gst_inclusive: boolean;
  subtotal: number; gst_amount: number; total: number;
  customers?: { name: string; phone: string | null; address: string | null; gst_number: string | null } | null;
}

interface ChallanItem {
  id: string; product_name: string; quantity: number; unit_price: number;
  total: number; hsn_code: string | null; gst_percentage: number; gst_amount: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", sent: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success", invoiced: "bg-primary/10 text-primary",
};

export default function DeliveryChallanPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challan, setChallan] = useState<ChallanData | null>(null);
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: ch } = await (supabase as any).from("delivery_challans").select("*, customers(name, phone, address, gst_number)").eq("id", id).single();
      setChallan(ch as any);
      const { data: itms } = await (supabase as any).from("delivery_challan_items").select("*").eq("challan_id", id);
      setItems((itms || []) as any);
      setLoading(false);
    })();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    await (supabase as any).from("delivery_challans").update({ status }).eq("id", id);
    setChallan(prev => prev ? { ...prev, status } : prev);
    toast.success(`Status updated to ${status}`);
  };

  const convertToInvoice = async () => {
    if (!challan) return;
    try {
      const { data: inv, error } = await supabase.from("invoices").insert({
        customer_id: (challan as any).customer_id || null,
        subtotal: challan.subtotal || items.reduce((s, i) => s + i.total, 0),
        gst_amount: challan.gst_amount || 0,
        total: challan.total || items.reduce((s, i) => s + i.total, 0),
        gst_inclusive: challan.gst_inclusive,
        notes: `Converted from ${challan.challan_number}`,
      } as any).select().single();
      if (error) throw error;
      const invItems = items.map(i => ({
        invoice_id: inv.id, product_name: i.product_name,
        quantity: i.quantity, unit_price: i.unit_price, total: i.total,
        hsn_code: i.hsn_code || null, gst_percentage: i.gst_percentage,
      }));
      await supabase.from("invoice_items").insert(invItems);
      await (supabase as any).from("delivery_challans").update({ status: "invoiced", invoice_id: inv.id }).eq("id", id);
      toast.success("Invoice created — " + (inv as any).invoice_number);
      navigate(`/invoices/${inv.id}`);
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <p className="text-center text-muted-foreground py-12">Loading...</p>;
  if (!challan) return <p className="text-center text-muted-foreground py-12">Challan not found</p>;

  const subtotal = challan.subtotal || items.reduce((s, i) => s + i.total, 0);
  const totalGst = challan.gst_amount || items.reduce((s, i) => s + (i.gst_amount || 0), 0);
  const grandTotal = challan.total || (challan.gst_inclusive ? subtotal : subtotal + totalGst);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/challans")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{challan.challan_number}</h1>
          <p className="text-sm text-muted-foreground">Delivery Challan</p>
        </div>
        <Badge className={statusColors[challan.status] || "bg-muted"}>{challan.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 print-area">
          <Card>
            <CardContent className="p-6 space-y-6">
              {/* Header */}
              <div className="flex justify-between">
                <div>
                  <p className="text-lg font-bold">{challan.challan_number}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(challan.created_at), "dd MMM yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{(challan.customers as any)?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{(challan.customers as any)?.phone}</p>
                  <p className="text-xs text-muted-foreground">{(challan.customers as any)?.address}</p>
                  {(challan.customers as any)?.gst_number && (
                    <p className="text-xs font-mono text-muted-foreground mt-1">GST: {(challan.customers as any).gst_number}</p>
                  )}
                </div>
              </div>

              {/* Delivery Info */}
              {(challan.delivery_person || challan.vehicle_number) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {challan.delivery_person && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase">Delivery Person</p>
                          <p className="text-sm font-medium">{challan.delivery_person}</p>
                        </div>
                      </div>
                    )}
                    {challan.vehicle_number && (
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase">Vehicle Number</p>
                          <p className="text-sm font-medium">{challan.vehicle_number}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              {/* Items Table */}
              <table className="w-full text-sm">
                <thead><tr className="border-b">
                  <th className="text-left py-2 text-xs text-muted-foreground uppercase">Item</th>
                  <th className="text-left py-2 text-xs text-muted-foreground uppercase w-20">HSN</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase w-20">Rate</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase w-16">Qty</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase w-16">GST%</th>
                  <th className="text-right py-2 text-xs text-muted-foreground uppercase w-24">Total</th>
                </tr></thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} className="border-b border-border/30">
                      <td className="py-2.5 font-medium">{i.product_name}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{i.hsn_code || "—"}</td>
                      <td className="py-2.5 text-right">₹{i.unit_price}</td>
                      <td className="py-2.5 text-right">{i.quantity}</td>
                      <td className="py-2.5 text-right">{i.gst_percentage}%</td>
                      <td className="py-2.5 text-right font-semibold">₹{i.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-56 space-y-1.5">
                  <Separator className="mb-2" />
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">CGST</span><span>₹{(totalGst / 2).toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">SGST</span><span>₹{(totalGst / 2).toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">Grand Total</span>
                    <span className="text-xl font-bold">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Receiver Signature */}
              {challan.receiver_signature && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Receiver Signature</p>
                    <img src={challan.receiver_signature} alt="Signature" className="max-h-20 border rounded" />
                  </div>
                </>
              )}

              {challan.notes && (
                <>
                  <Separator />
                  <div><p className="text-xs text-muted-foreground font-medium mb-1">Notes</p><p className="text-sm">{challan.notes}</p></div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-4 no-print">
          <Card>
            <CardContent className="p-5 space-y-3">
              <Button variant="outline" className="w-full" onClick={() => navigate(`/challans/${id}/edit`)}>
                <Pencil className="h-4 w-4 mr-2" />Edit
              </Button>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />Print
              </Button>
              {challan.status === "draft" && (
                <Button className="w-full" onClick={() => updateStatus("sent")}>
                  <Truck className="h-4 w-4 mr-2" />Mark as Sent
                </Button>
              )}
              {challan.status === "sent" && (
                <Button className="w-full bg-success hover:bg-success/90" onClick={() => updateStatus("delivered")}>
                  <Truck className="h-4 w-4 mr-2" />Mark Delivered
                </Button>
              )}
              {(challan.status === "delivered" || challan.status === "sent") && !challan.invoice_id && (
                <Button className="w-full" variant="default" onClick={convertToInvoice}>
                  <Receipt className="h-4 w-4 mr-2" />Convert to Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
