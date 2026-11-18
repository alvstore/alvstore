import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Download } from "lucide-react";
import { toast } from "sonner";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { CustomerCard } from "@/components/documents/CustomerCard";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { SignaturePad } from "@/components/documents/SignaturePad";
import { createNotification } from "@/lib/notifications";

interface QuotationData {
  id: string; quotation_number: string; status: string; subtotal: number; gst_amount: number;
  total: number; notes: string | null; terms: string | null; valid_until: string | null;
  created_at: string; discount_type: string | null; discount_value: number | null;
  gst_inclusive: boolean | null; signature_data: string | null; signature_name: string | null;
  customers: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

export default function PublicQuotation() {
  const { token } = useParams<{ token: string }>();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [signatureData, setSignatureData] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [bankDetails, setBankDetails] = useState<{ bank_name?: string; bank_account_number?: string; bank_ifsc?: string; bank_branch?: string; bank_upi_id?: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data: q } = await supabase.from("quotations").select("*, customers(name, email, phone, address, gst_number)").eq("public_token", token).single();
      if (q) {
        setQuotation(q as any);
        // Track view
        await supabase.from("quotations").update({ view_count: (q.view_count || 0) + 1, last_viewed_at: new Date().toISOString() } as any).eq("id", q.id);
        const { data: itemsData } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id);
        setItems((itemsData || []).map((i: any) => ({
          product_id: i.product_id, product_name: i.product_name,
          description: i.description || "", hsn_code: i.hsn_code || "",
          quantity: i.quantity, unit_price: i.unit_price,
          discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
          gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
          image_url: i.image_url || null,
        })));
        // Fetch bank details
        const { data: bs } = await supabase.from("business_settings").select("bank_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id").limit(1).single();
        if (bs) setBankDetails(bs as any);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const respond = async (status: "accepted" | "rejected") => {
    if (!quotation) return;
    setResponding(true);
    const updates: any = { status };
    if (status === "accepted" && signatureData) {
      updates.signature_data = signatureData;
      updates.signature_name = signatureName;
      updates.signed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("quotations").update(updates).eq("id", quotation.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Quotation ${status}`);
      setQuotation(prev => prev ? { ...prev, ...updates } : null);
      // Notify creator
      if ((quotation as any).created_by) {
        createNotification(
          (quotation as any).created_by,
          `Quotation ${status === "accepted" ? "Accepted" : "Rejected"}`,
          `${quotation.quotation_number} was ${status} by ${quotation.customers?.name || "customer"}`,
          status === "accepted" ? "success" : "warning",
          `/sales/${quotation.id}`
        );
      }
    }
    setResponding(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!quotation) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground"><p>Quotation not found.</p></div>;

  const canRespond = quotation.status === "sent" || quotation.status === "draft";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="border-border shadow-sm print-area">
          <CardContent className="p-6 md:p-8 space-y-6">
            <BusinessHeader />
            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{quotation.quotation_number}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(quotation.created_at).toLocaleDateString("en-IN")}
                  {quotation.valid_until && ` · Valid until ${new Date(quotation.valid_until).toLocaleDateString("en-IN")}`}
                </p>
              </div>
              <StatusBadge status={quotation.status} />
            </div>

            {quotation.customers && (
              <>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bill To</p>
                  <CustomerCard name={quotation.customers.name} email={quotation.customers.email} phone={quotation.customers.phone} address={quotation.customers.address} gstNumber={quotation.customers.gst_number} />
                </div>
                <Separator />
              </>
            )}

            <ItemsTable items={items} onItemsChange={() => {}} products={[]} readOnly />

            <TotalsPanel
              items={items}
              gstInclusive={quotation.gst_inclusive || false}
              globalDiscountType={(quotation.discount_type as any) || "percentage"}
              globalDiscountValue={quotation.discount_value || 0}
              readOnly
            />

            {quotation.notes && (
              <div><p className="text-xs font-semibold mb-1">Notes</p><p className="text-xs text-muted-foreground whitespace-pre-line">{quotation.notes}</p></div>
            )}
            {quotation.terms && (
              <div><p className="text-xs font-semibold mb-1">Terms & Conditions</p><p className="text-xs text-muted-foreground whitespace-pre-line">{quotation.terms}</p></div>
            )}

            {bankDetails?.bank_name && (
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bank Details for Payment</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Bank</span><span className="font-medium text-foreground">{bankDetails.bank_name}</span>
                  {bankDetails.bank_account_number && <><span className="text-muted-foreground">Account No.</span><span className="font-medium text-foreground">{bankDetails.bank_account_number}</span></>}
                  {bankDetails.bank_ifsc && <><span className="text-muted-foreground">IFSC</span><span className="font-medium text-foreground">{bankDetails.bank_ifsc}</span></>}
                  {bankDetails.bank_branch && <><span className="text-muted-foreground">Branch</span><span className="font-medium text-foreground">{bankDetails.bank_branch}</span></>}
                  {bankDetails.bank_upi_id && <><span className="text-muted-foreground">UPI ID</span><span className="font-medium text-foreground">{bankDetails.bank_upi_id}</span></>}
                </div>
              </div>
            )}
            {quotation.signature_data && (
              <div className="rounded-lg border border-border p-4 text-center bg-muted/20">
                <img src={quotation.signature_data} alt="Signature" className="h-16 mx-auto" />
                {quotation.signature_name && <p className="text-sm font-medium mt-1">{quotation.signature_name}</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">Customer Signature</p>
              </div>
            )}

            {canRespond && (
              <>
                <Separator />
                <SignaturePad
                  onSignature={(data, name) => { setSignatureData(data); setSignatureName(name); }}
                  existingSignature={quotation.signature_data}
                  existingName={quotation.signature_name}
                />
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => respond("accepted")} disabled={responding}>
                    <Check className="h-4 w-4 mr-2" /> Accept Quotation
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => respond("rejected")} disabled={responding}>
                    <X className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              </>
            )}

            <Button variant="secondary" className="w-full" onClick={() => window.print()}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">Powered by ERPMaster</p>
      </div>
    </div>
  );
}
