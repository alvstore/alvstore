import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { ArrowLeft, Send, Download, Printer, Pencil, ArrowRightLeft, Copy, Eye, Link, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function QuotationPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotation, setQuotation] = useState<any>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: q } = await supabase
        .from("quotations")
        .select("*, customers(name, email, phone, address, gst_number)")
        .eq("id", id)
        .single();
      if (q) setQuotation(q);

      const { data: itms } = await supabase.from("quotation_items").select("*").eq("quotation_id", id);
      setItems(
        (itms || []).map((i: any) => ({
          id: i.id, product_id: i.product_id, product_name: i.product_name,
          description: i.description || "", hsn_code: i.hsn_code || "",
          quantity: i.quantity, unit_price: i.unit_price,
          discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
          gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
        }))
      );
      setLoading(false);
    };
    load();
  }, [id]);

  const copyPublicLink = () => {
    if (!quotation?.public_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/sales/public/${quotation.public_token}`);
    toast.success("Link copied");
  };

  const convertToInvoice = async () => {
    if (!quotation?.customer_id) { toast.error("No customer on quotation"); return; }
    const { data: qItems } = await supabase.from("quotation_items").select("*").eq("quotation_id", quotation.id);

    const { data: inv, error: invErr } = await supabase.from("invoices").insert({
      customer_id: quotation.customer_id, subtotal: quotation.subtotal,
      gst_amount: quotation.gst_amount, total: quotation.total,
      notes: quotation.notes, quotation_id: quotation.id,
      discount_type: quotation.discount_type, discount_value: quotation.discount_value,
      gst_inclusive: quotation.gst_inclusive, created_by: user?.id,
    }).select().single();

    if (invErr) { toast.error(invErr.message); return; }

    if (qItems && qItems.length > 0) {
      const invItems = qItems.map((i: any) => ({
        invoice_id: inv.id, product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
        description: i.description, hsn_code: i.hsn_code, discount_type: i.discount_type, discount_value: i.discount_value,
      }));
      await supabase.from("invoice_items").insert(invItems);
    }

    await supabase.from("quotations").update({ converted_invoice_id: inv.id, status: "accepted" as any }).eq("id", quotation.id);
    toast.success("Converted to Invoice — " + inv.invoice_number);
    navigate(`/invoices/${inv.id}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading quotation...</p></div>;
  }

  if (!quotation) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Quotation not found</p></div>;
  }

  const customer = quotation.customers;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/sales")} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Quotations
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document */}
        <div className="lg:col-span-8">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <BusinessHeader compact />
                <div className="text-right space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{quotation.quotation_number}</h2>
                  <p className="text-xs text-muted-foreground">
                    Date: {new Date(quotation.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  {quotation.valid_until && (
                    <p className="text-xs text-muted-foreground">
                      Valid Until: {new Date(quotation.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <StatusBadge status={quotation.status} />
                </div>
              </div>

              <Separator />

              {customer && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quotation To:</p>
                  <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                  {customer.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
                  {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                  {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                  {customer.gst_number && <p className="text-xs text-muted-foreground mt-1">GSTIN: {customer.gst_number}</p>}
                </div>
              )}

              <ItemsTable items={items} onItemsChange={() => {}} products={[]} readOnly />

              <div className="flex justify-end">
                <div className="w-full max-w-xs">
                  <TotalsPanel
                    items={items}
                    gstInclusive={quotation.gst_inclusive || false}
                    globalDiscountType={(quotation.discount_type as "percentage" | "fixed") || "percentage"}
                    globalDiscountValue={quotation.discount_value || 0}
                    readOnly
                  />
                </div>
              </div>

              {quotation.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}

              {quotation.terms && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Terms & Conditions</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{quotation.terms}</p>
                </div>
              )}

              {quotation.signature_data && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Signature</p>
                  <img src={quotation.signature_data} alt="Signature" className="h-16 border border-border rounded" />
                  {quotation.signature_name && <p className="text-xs text-muted-foreground mt-1">{quotation.signature_name}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Action Sidebar */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-5 space-y-3">
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={copyPublicLink}>
                  <Send className="h-4 w-4 mr-2" /> Send Quotation
                </Button>

                <Button variant="outline" className="w-full" onClick={() => window.print()}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/sales/${id}/edit`)}>
                    <Pencil className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>

            {quotation.status !== "accepted" && !quotation.converted_invoice_id && (
              <Card className="shadow-sm border-border/50">
                <CardContent className="p-5">
                  <Button className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" onClick={convertToInvoice}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Convert to Invoice
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm border-border/50">
              <CardContent className="p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={quotation.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Views</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{quotation.view_count || 0}</span>
                </div>
                {quotation.converted_invoice_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Converted</span>
                    <span className="text-success text-xs font-medium">Yes</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
