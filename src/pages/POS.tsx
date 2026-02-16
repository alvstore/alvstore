import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Package, Barcode, Printer, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  selling_price: number;
  gst_percentage: number;
  stock_quantity: number;
  unit: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  lineTotal: number;
  lineGst: number;
}

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi">("cash");
  const [processing, setProcessing] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{ items: CartItem[]; subtotal: number; gst: number; total: number; method: string; txnNumber: string; date: string } | null>(null);

  const fetchProducts = useCallback(async () => {
    let query = supabase.from("products").select("id,name,sku,barcode,image_url,selling_price,gst_percentage,stock_quantity,unit").gt("stock_quantity", 0);
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }
    const { data } = await query.order("name").limit(50);
    setProducts(data || []);
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error("Insufficient stock");
          return prev;
        }
        return prev.map(c =>
          c.product.id === product.id
            ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * product.selling_price, lineGst: (c.quantity + 1) * product.selling_price * product.gst_percentage / 100 }
            : c
        );
      }
      return [...prev, {
        product,
        quantity: 1,
        lineTotal: product.selling_price,
        lineGst: product.selling_price * product.gst_percentage / 100,
      }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0) return c;
      if (newQty > c.product.stock_quantity) { toast.error("Insufficient stock"); return c; }
      return {
        ...c, quantity: newQty,
        lineTotal: newQty * c.product.selling_price,
        lineGst: newQty * c.product.selling_price * c.product.gst_percentage / 100,
      };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !barcodeInput.trim()) return;
    const product = products.find(p => p.barcode === barcodeInput.trim());
    if (product) { addToCart(product); setBarcodeInput(""); }
    else { toast.error("Product not found"); }
  };

  const subtotal = cart.reduce((s, c) => s + c.lineTotal, 0);
  const gstAmount = cart.reduce((s, c) => s + c.lineGst, 0);
  const total = subtotal + gstAmount;

  const completeSale = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setProcessing(true);
    try {
      const items = cart.map(c => ({
        product_id: c.product.id, name: c.product.name,
        qty: c.quantity, price: c.product.selling_price,
        gst: c.product.gst_percentage, total: c.lineTotal + c.lineGst,
      }));

      const { data: txn, error: txnError } = await supabase.from("pos_transactions").insert({
        items, subtotal, gst_amount: gstAmount, total,
        payment_method: paymentMethod, created_by: user?.id,
      }).select("transaction_number, created_at").single();
      if (txnError) throw txnError;

      for (const c of cart) {
        const { error: mvError } = await supabase.from("stock_movements").insert({
          product_id: c.product.id, type: "out" as const,
          quantity: c.quantity, reference: "POS Sale",
          created_by: user?.id,
        });
        if (mvError) throw mvError;
      }

      setLastSale({
        items: [...cart],
        subtotal, gst: gstAmount, total,
        method: paymentMethod,
        txnNumber: txn?.transaction_number || "",
        date: txn?.created_at || new Date().toISOString(),
      });
      setReceiptOpen(true);
      toast.success(`Sale completed — ₹${total.toFixed(2)}`);
      setCart([]);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || "Sale failed");
    }
    setProcessing(false);
  };

  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow || !lastSale) return;
    const html = `<!DOCTYPE html><html><head><title>Receipt</title><style>
      body{font-family:monospace;font-size:12px;padding:10px;max-width:280px;margin:0 auto}
      .center{text-align:center} .bold{font-weight:bold} .line{border-top:1px dashed #000;margin:8px 0}
      table{width:100%;border-collapse:collapse} td{padding:2px 0}
    </style></head><body>
      <div class="center bold" style="font-size:16px">ERPMaster</div>
      <div class="center">${lastSale.txnNumber}</div>
      <div class="center">${new Date(lastSale.date).toLocaleString("en-IN")}</div>
      <div class="line"></div>
      <table>${lastSale.items.map(c => `<tr><td>${c.product.name} x${c.quantity}</td><td style="text-align:right">₹${(c.lineTotal + c.lineGst).toFixed(0)}</td></tr>`).join("")}</table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">₹${lastSale.subtotal.toFixed(2)}</td></tr>
        <tr><td>GST</td><td style="text-align:right">₹${lastSale.gst.toFixed(2)}</td></tr>
        <tr class="bold"><td>TOTAL</td><td style="text-align:right">₹${lastSale.total.toFixed(2)}</td></tr>
      </table>
      <div class="line"></div>
      <div class="center">Payment: ${lastSale.method.toUpperCase()}</div>
      <div class="center" style="margin-top:10px">Thank you!</div>
      <script>window.print();window.close();</script>
    </body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-5rem)]">
      {/* Left: Product Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barcode + Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeRef}
              placeholder="Scan barcode..."
              className="pl-9"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeScan}
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="rounded-lg border bg-card p-3 text-left hover:ring-2 hover:ring-primary transition-all active:scale-[0.98]"
              >
                <div className="h-20 bg-muted rounded flex items-center justify-center mb-2">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover rounded" /> : <Package className="h-8 w-8 text-muted-foreground/30" />}
                </div>
                <p className="text-sm font-medium truncate">{p.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm font-bold">₹{p.selling_price}</span>
                  <Badge variant="outline" className="text-[10px]">{p.stock_quantity}</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart Panel */}
      <Card className="lg:w-96 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Cart
            {cart.length > 0 && <Badge className="ml-auto">{cart.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden p-4 pt-0">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Scan or select products to add
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
              {cart.map(c => (
                <div key={c.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.product.name}</p>
                    <p className="text-xs text-muted-foreground">₹{c.product.selling_price} × {c.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm w-6 text-center font-medium">{c.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(c.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(c.product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                  <span className="text-sm font-semibold w-16 text-right">₹{(c.lineTotal + c.lineGst).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="pt-3 space-y-3 border-t mt-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{gstAmount.toFixed(2)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
              </div>

              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash"><div className="flex items-center gap-2"><Banknote className="h-4 w-4" />Cash</div></SelectItem>
                  <SelectItem value="card"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Card</div></SelectItem>
                  <SelectItem value="upi"><div className="flex items-center gap-2"><Smartphone className="h-4 w-4" />UPI</div></SelectItem>
                </SelectContent>
              </Select>

              <Button className="w-full" size="lg" onClick={completeSale} disabled={processing}>
                {processing ? "Processing..." : `Complete Sale — ₹${total.toFixed(2)}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sale Complete</DialogTitle>
          </DialogHeader>
          {lastSale && (
            <div className="space-y-3 text-sm">
              <div className="text-center">
                <p className="font-bold text-lg">{lastSale.txnNumber}</p>
                <p className="text-muted-foreground">{new Date(lastSale.date).toLocaleString("en-IN")}</p>
              </div>
              <Separator />
              {lastSale.items.map(c => (
                <div key={c.product.id} className="flex justify-between">
                  <span>{c.product.name} ×{c.quantity}</span>
                  <span>₹{(c.lineTotal + c.lineGst).toFixed(0)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between"><span>Subtotal</span><span>₹{lastSale.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>GST</span><span>₹{lastSale.gst.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-base"><span>Total</span><span>₹{lastSale.total.toFixed(2)}</span></div>
              <div className="text-center text-muted-foreground capitalize">Paid via {lastSale.method}</div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={printReceipt}>
              <Printer className="h-4 w-4 mr-1.5" />Print
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => toast.info("Configure SMTP in Settings → Integrations to enable email receipts")}>
              <Mail className="h-4 w-4 mr-1.5" />Email
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => toast.info("Configure SMS API in Settings → Integrations to enable SMS receipts")}>
              <MessageSquare className="h-4 w-4 mr-1.5" />SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
