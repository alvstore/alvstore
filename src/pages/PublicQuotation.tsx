import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, X, FileText, Download } from "lucide-react";
import { toast } from "sonner";

interface QuotationData {
  id: string;
  quotation_number: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  created_at: string;
  customers: { name: string; email: string | null; phone: string | null } | null;
}

interface QuotationItemData {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  gst_percentage: number;
  total: number;
}

export default function PublicQuotation() {
  const { token } = useParams<{ token: string }>();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [items, setItems] = useState<QuotationItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!token) return;
      const { data: q } = await supabase
        .from("quotations")
        .select("*, customers(name, email, phone)")
        .eq("public_token", token)
        .single();
      if (q) {
        setQuotation(q);
        const { data: items } = await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", q.id);
        setItems(items || []);
      }
      setLoading(false);
    };
    fetch();
  }, [token]);

  const respond = async (status: "accepted" | "rejected") => {
    if (!quotation) return;
    setResponding(true);
    const { error } = await supabase.from("quotations").update({ status }).eq("id", quotation.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Quotation ${status}`);
      setQuotation(prev => prev ? { ...prev, status } : null);
    }
    setResponding(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!quotation) return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><p>Quotation not found.</p></div>;

  const canRespond = quotation.status === "sent" || quotation.status === "draft";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{quotation.quotation_number}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Created {new Date(quotation.created_at).toLocaleDateString("en-IN")}
                {quotation.valid_until && ` · Valid until ${new Date(quotation.valid_until).toLocaleDateString("en-IN")}`}
              </p>
            </div>
            <Badge className="capitalize">{quotation.status}</Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            {quotation.customers && (
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{quotation.customers.name}</p>
                {quotation.customers.email && <p className="text-sm text-muted-foreground">{quotation.customers.email}</p>}
              </div>
            )}

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">GST %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{i.product_name}</TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="text-right">₹{i.unit_price}</TableCell>
                    <TableCell className="text-right">{i.gst_percentage}%</TableCell>
                    <TableCell className="text-right">₹{i.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="text-right space-y-1 text-sm">
              <p>Subtotal: ₹{quotation.subtotal}</p>
              <p>GST: ₹{quotation.gst_amount}</p>
              <Separator className="my-2" />
              <p className="text-lg font-bold">Total: ₹{quotation.total}</p>
            </div>

            {quotation.notes && (
              <div>
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{quotation.notes}</p>
              </div>
            )}

            {quotation.terms && (
              <div>
                <p className="text-sm font-medium mb-1">Terms & Conditions</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{quotation.terms}</p>
              </div>
            )}

            {canRespond && (
              <div className="flex gap-3 pt-4">
                <Button className="flex-1" onClick={() => respond("accepted")} disabled={responding}>
                  <Check className="h-4 w-4 mr-2" /> Accept
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => respond("rejected")} disabled={responding}>
                  <X className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            )}

            <div className="pt-2">
              <Button variant="secondary" className="w-full" onClick={() => window.print()}>
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
