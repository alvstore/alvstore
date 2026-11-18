import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Download, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { CustomerCard } from "@/components/documents/CustomerCard";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { StatusBadge } from "@/components/documents/StatusBadge";

interface InvoiceData {
  id: string; invoice_number: string; status: string; payment_status: string;
  subtotal: number; gst_amount: number; total: number; paid_amount: number;
  notes: string | null; due_date: string | null; created_at: string;
  discount_type: string | null; discount_value: number | null; gst_inclusive: boolean | null;
  signature_data: string | null; signature_name: string | null;
  customers: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

export default function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data: inv } = await supabase.from("invoices").select("*, customers(name, email, phone, address, gst_number)").eq("public_token", token).single();
      if (inv) {
        setInvoice(inv as any);
        const { data: itemsData } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
        setItems((itemsData || []).map((i: any) => ({
          product_id: i.product_id, product_name: i.product_name,
          description: i.description || "", hsn_code: i.hsn_code || "",
          quantity: i.quantity, unit_price: i.unit_price,
          discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
          gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
        })));
      }
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!invoice) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground"><p>Invoice not found.</p></div>;

  const balance = invoice.total - invoice.paid_amount;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-border shadow-sm print-area">
          <CardContent className="p-6 md:p-8 space-y-6">
            <BusinessHeader />
            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  {invoice.due_date && ` · Due: ${new Date(invoice.due_date).toLocaleDateString("en-IN")}`}
                </p>
              </div>
              <div className="flex gap-1.5">
                <StatusBadge status={invoice.status} />
                <StatusBadge status={invoice.payment_status} />
              </div>
            </div>

            {invoice.customers && (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bill To</p>
                  <CustomerCard name={invoice.customers.name} email={invoice.customers.email} phone={invoice.customers.phone} address={invoice.customers.address} gstNumber={invoice.customers.gst_number} />
                </div>
                <Separator />
              </>
            )}

            {/* Payment Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payment Progress</span>
                <span className="font-medium">₹{invoice.paid_amount.toLocaleString("en-IN")} / ₹{invoice.total.toLocaleString("en-IN")}</span>
              </div>
              <Progress value={(invoice.paid_amount / (invoice.total || 1)) * 100} className="h-2" />
              {balance > 0 && <p className="text-xs text-destructive font-medium">Balance Due: ₹{balance.toLocaleString("en-IN")}</p>}
            </div>

            <ItemsTable items={items} onItemsChange={() => {}} products={[]} readOnly />

            <TotalsPanel
              items={items}
              gstInclusive={invoice.gst_inclusive || false}
              globalDiscountType={(invoice.discount_type as any) || "percentage"}
              globalDiscountValue={invoice.discount_value || 0}
              readOnly
            />

            {invoice.notes && (
              <div><p className="text-xs font-semibold mb-1">Notes</p><p className="text-xs text-muted-foreground whitespace-pre-line">{invoice.notes}</p></div>
            )}

            {invoice.signature_data && (
              <div className="rounded-lg border border-border p-4 text-center bg-muted/20">
                <img src={invoice.signature_data} alt="Signature" className="h-16 mx-auto" />
                {invoice.signature_name && <p className="text-sm font-medium mt-1">{invoice.signature_name}</p>}
              </div>
            )}

            <div className="flex gap-3">
              {balance > 0 && (
                <Button className="flex-1" onClick={() => toast.info("Online payment coming soon")}>
                  <CreditCard className="h-4 w-4 mr-2" /> Pay Now
                </Button>
              )}
              <Button variant="secondary" className={balance > 0 ? "flex-1" : "w-full"} onClick={() => window.print()}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Powered by ERPMaster</p>
      </div>
    </div>
  );
}
