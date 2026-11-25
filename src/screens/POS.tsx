"use client";

import { Box, Button, ButtonBase, Card, CardContent, Divider, FormLabel, IconButton, InputAdornment, MenuItem, Switch, TextField, Typography } from "@mui/material";
import { AnimatedPage, SearchToolbar, SideDrawer, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, Package, Barcode, Printer, Mail, MessageSquare, User, Phone } from "lucide-react";
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
interface Customer {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
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
    const [lastSale, setLastSale] = useState<{
        items: CartItem[];
        subtotal: number;
        gst: number;
        total: number;
        method: string;
        txnNumber: string;
        date: string;
    } | null>(null);
    // Walk-in customer
    const [isWalkIn, setIsWalkIn] = useState(true);
    const [walkInName, setWalkInName] = useState("");
    const [walkInPhone, setWalkInPhone] = useState("");
    const [walkInEmail, setWalkInEmail] = useState("");
    const [saveAsCustomer, setSaveAsCustomer] = useState(false);
    const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [customerSearch, setCustomerSearch] = useState("");
    const fetchProducts = useCallback(async () => {
        let query = supabase.from("products").select("id,name,sku,barcode,image_url,selling_price,gst_percentage,stock_quantity,unit").gt("stock_quantity", 0);
        if (search) {
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
        }
        const { data } = await query.order("name").limit(50);
        setProducts(data || []);
    }, [search]);
    const fetchCustomers = useCallback(async () => {
        let query = supabase.from("customers").select("id, name, phone, email");
        if (customerSearch) {
            query = query.or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`);
        }
        const { data } = await query.order("name").limit(20);
        setExistingCustomers(data || []);
    }, [customerSearch]);
    useEffect(() => { fetchProducts(); }, [fetchProducts]);
    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
    useEffect(() => { barcodeRef.current?.focus(); }, []);
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(c => c.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock_quantity) {
                    toast.error("Insufficient stock");
                    return prev;
                }
                return prev.map(c => c.product.id === product.id
                    ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * product.selling_price, lineGst: (c.quantity + 1) * product.selling_price * product.gst_percentage / 100 }
                    : c);
            }
            return [...prev, { product, quantity: 1, lineTotal: product.selling_price, lineGst: product.selling_price * product.gst_percentage / 100 }];
        });
    };
    const updateQty = (productId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.product.id !== productId)
                return c;
            const newQty = c.quantity + delta;
            if (newQty <= 0)
                return c;
            if (newQty > c.product.stock_quantity) {
                toast.error("Insufficient stock");
                return c;
            }
            return { ...c, quantity: newQty, lineTotal: newQty * c.product.selling_price, lineGst: newQty * c.product.selling_price * c.product.gst_percentage / 100 };
        }));
    };
    const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product.id !== productId));
    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter" || !barcodeInput.trim())
            return;
        const product = products.find(p => p.barcode === barcodeInput.trim());
        if (product) {
            addToCart(product);
            setBarcodeInput("");
        }
        else
            toast.error("Product not found");
    };
    const subtotal = cart.reduce((s, c) => s + c.lineTotal, 0);
    const gstAmount = cart.reduce((s, c) => s + c.lineGst, 0);
    const total = subtotal + gstAmount;
    const completeSale = async () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        setProcessing(true);
        try {
            let customerId: string | null = null;
            // Handle customer
            if (!isWalkIn && selectedCustomerId) {
                customerId = selectedCustomerId;
            }
            else if (isWalkIn && saveAsCustomer && walkInName.trim()) {
                const { data: newCust, error: custErr } = await supabase.from("customers").insert({
                    name: walkInName.trim(),
                    phone: walkInPhone || null,
                    email: walkInEmail || null,
                    created_by: user?.id,
                }).select("id").single();
                if (!custErr && newCust)
                    customerId = newCust.id;
            }
            const items = cart.map(c => ({
                product_id: c.product.id, name: c.product.name,
                qty: c.quantity, price: c.product.selling_price,
                gst: c.product.gst_percentage, total: c.lineTotal + c.lineGst,
            }));
            const { data: txn, error: txnError } = await supabase.from("pos_transactions").insert({
                items, subtotal, gst_amount: gstAmount, total,
                payment_method: paymentMethod, created_by: user?.id,
                customer_id: customerId,
            }).select("transaction_number, created_at").single();
            if (txnError)
                throw txnError;
            for (const c of cart) {
                await supabase.from("stock_movements").insert({
                    product_id: c.product.id, type: "out" as const,
                    quantity: c.quantity, reference: "POS Sale", created_by: user?.id,
                });
            }
            setLastSale({
                items: [...cart], subtotal, gst: gstAmount, total,
                method: paymentMethod, txnNumber: txn?.transaction_number || "",
                date: txn?.created_at || new Date().toISOString(),
            });
            setReceiptOpen(true);
            toast.success(`Sale completed — ₹${total.toFixed(2)}`);
            setCart([]);
            setWalkInName("");
            setWalkInPhone("");
            setWalkInEmail("");
            setSaveAsCustomer(false);
            setSelectedCustomerId("");
            fetchProducts();
        }
        catch (err: any) {
            toast.error(err.message || "Sale failed");
        }
        setProcessing(false);
    };
    const printReceipt = () => {
        const printWindow = window.open("", "_blank", "width=300,height=600");
        if (!printWindow || !lastSale)
            return;
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
    const sendWhatsAppReceipt = async () => {
        const phone = isWalkIn ? walkInPhone : existingCustomers.find(c => c.id === selectedCustomerId)?.phone;
        if (!phone) {
            toast.error("No phone number available");
            return;
        }
        if (!lastSale)
            return;
        try {
            await supabase.functions.invoke("send-whatsapp", {
                body: { to: phone, message: `Receipt: ${lastSale.txnNumber}\nTotal: ₹${lastSale.total.toFixed(2)}\nPayment: ${lastSale.method}\nThank you!` },
            });
            toast.success("WhatsApp receipt sent");
        }
        catch {
            toast.error("Failed to send WhatsApp");
        }
    };
    const sendEmailReceipt = async () => {
        const email = isWalkIn ? walkInEmail : existingCustomers.find(c => c.id === selectedCustomerId)?.email;
        if (!email) {
            toast.error("No email available");
            return;
        }
        toast.info("Configure SMTP in Settings → Integrations to enable email receipts");
    };
    return <AnimatedPage><Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 1024px)": { flexDirection: "row" }, gap: "1rem", height: "calc(100vh - 5rem)" }}>
      {/* Left: Product Panel */}
      <Box sx={{ flex: "1 1 0%", display: "flex", flexDirection: "column", minWidth: "0px" }}>
        <Box sx={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          <TextField
            placeholder="Scan barcode..."
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeScan}
            size="small"
            fullWidth
            inputRef={barcodeRef}
            slotProps={{
              htmlInput: { "aria-label": "Scan barcode..." },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Box component={Barcode} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: "1 1 0%" }}
          />
          <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search products..." sx={{ flex: "1 1 0%" }}/>
        </Box>
        <Box sx={{ flex: "1 1 0%", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent", "&::-webkit-scrollbar": { width: "5px", height: "5px" }, "&::-webkit-scrollbar-track": { background: "transparent" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "99px" } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, "@media (min-width: 768px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
            {products.map(p => (<ButtonBase key={p.id} onClick={() => addToCart(p)} type="button" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", padding: "0.75rem", textAlign: "left", "&:hover": { "--alv-ring-offset-shadow": "var(--alv-ring-inset) 0 0 0 var(--alv-ring-offset-width) var(--alv-ring-offset-color)", "--alv-ring-shadow": "var(--alv-ring-inset) 0 0 0 calc(2px + var(--alv-ring-offset-width)) var(--alv-ring-color)", boxShadow: "var(--alv-ring-offset-shadow), var(--alv-ring-shadow), var(--alv-shadow, 0 0 #0000)", "--alv-ring-color": "hsl(var(--primary))" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "&:active": { "--alv-scale-x": "0.98", "--alv-scale-y": "0.98", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }}>
                <Box sx={{ height: "5rem", backgroundColor: "hsl(var(--muted))", borderRadius: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
                  {p.image_url ? <Box src={p.image_url} alt={p.name} component="img" sx={{ height: "100%", width: "100%", objectFit: "cover", borderRadius: "0.25rem" }}/> : <Box component={Package} sx={{ height: "2rem", width: "2rem", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 30%, transparent)" }}/>}
                </Box>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                  <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "700" }}>₹{p.selling_price}</Box>
                  <StatusChip label={p.stock_quantity} variant="outlined" sx={{ fontSize: "10px" }}/>
                </Box>
              </ButtonBase>))}
          </Box>
        </Box>
      </Box>

      {/* Right: Cart Panel */}
      <Card sx={{ "@media (min-width: 1024px)": { width: "24rem" }, display: "flex", flexDirection: "column" }}>
        <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.75rem" })}>
          <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}>
            <Box component={ShoppingCart} sx={{ height: "1rem", width: "1rem" }}/> Cart
            {cart.length > 0 && <StatusChip label={cart.length} sx={{ marginLeft: "auto" }}/>}
          </Typography>
        </Box>
        <CardContent sx={{ flex: "1 1 0%", display: "flex", flexDirection: "column", overflow: "hidden", padding: "1rem", paddingTop: "0px" }}>
          {/* Customer Section */}
          <Box sx={{ marginBottom: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, paddingBottom: "0.75rem", borderBottomWidth: "1px", borderColor: "hsl(var(--border))" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", display: "flex", alignItems: "center", gap: "0.375rem" }}><Box component={User} sx={{ height: "0.875rem", width: "0.875rem" }}/> Customer</FormLabel>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>Walk-in</Box>
                <Switch checked={isWalkIn} onChange={(event, checked) => (v => { setIsWalkIn(v); setSelectedCustomerId(""); })(checked)} sx={{ height: "1rem", width: "1.75rem" }}/>
              </Box>
            </Box>
            {isWalkIn ? (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                <TextField placeholder="Name" value={walkInName} onChange={e => setWalkInName(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Name" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.375rem" }}>
                  <TextField placeholder="Phone" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Phone" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                  <TextField placeholder="Email" value={walkInEmail} onChange={e => setWalkInEmail(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Email" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                </Box>
                {walkInName.trim() && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Switch checked={saveAsCustomer} onChange={(event, checked) => setSaveAsCustomer(checked)} sx={{ height: "0.875rem", width: "1.5rem" }}/>
                    <Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>Save as customer</Box>
                  </Box>)}
              </Box>) : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                <TextField placeholder="Search customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Search customers..." } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                <TextField value={selectedCustomerId} select size="small" fullWidth onChange={event => setSelectedCustomerId(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}><MenuItem value="" disabled>{"Select customer"}</MenuItem>
                    {existingCustomers.map(c => (<MenuItem key={c.id} value={c.id} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{c.name} {c.phone ? `· ${c.phone}` : ""}</MenuItem>))}
                  </TextField>
              </Box>)}
          </Box>

          {cart.length === 0 ? (<Box sx={{ flex: "1 1 0%", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
              Scan or select products to add
            </Box>) : (<Box sx={{ flex: "1 1 0%", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent", "&::-webkit-scrollbar": { width: "5px", height: "5px" }, "&::-webkit-scrollbar-track": { background: "transparent" }, "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "99px" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              {cart.map(c => (<Box key={c.product.id} sx={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }}>
                  <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.product.name}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>₹{c.product.selling_price} × {c.quantity}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <IconButton onClick={() => updateQty(c.product.id, -1)} aria-label={"Minus"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Minus} sx={{ height: "0.75rem", width: "0.75rem" }}/></IconButton>
                    <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", width: "1.5rem", textAlign: "center", fontWeight: "500" }}>{c.quantity}</Box>
                    <IconButton onClick={() => updateQty(c.product.id, 1)} aria-label={"Plus"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem" }}/></IconButton>
                    <IconButton onClick={() => removeFromCart(c.product.id)} aria-label={"Trash2"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Trash2} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--destructive))" }}/></IconButton>
                  </Box>
                  <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", width: "4rem", textAlign: "right" }}>₹{(c.lineTotal + c.lineGst).toFixed(0)}</Box>
                </Box>))}
            </Box>)}

          {cart.length > 0 && (<Box sx={{ paddingTop: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" }, borderTopWidth: "1px", marginTop: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box><Box component="span">₹{subtotal.toFixed(2)}</Box></Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GST</Box><Box component="span">₹{gstAmount.toFixed(2)}</Box></Box>
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}><Box component="span">Total</Box><Box component="span">₹{total.toFixed(2)}</Box></Box>
              </Box>

              <TextField value={paymentMethod} select size="small" fullWidth onChange={event => ((v: any) => setPaymentMethod(v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="cash"><Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Box component={Banknote} sx={{ height: "1rem", width: "1rem" }}/>Cash</Box></MenuItem>
                  <MenuItem value="card"><Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Box component={CreditCard} sx={{ height: "1rem", width: "1rem" }}/>Card</Box></MenuItem>
                  <MenuItem value="upi"><Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/>UPI</Box></MenuItem>
                </TextField>

              <Button onClick={completeSale} disabled={processing} variant="contained" size="large" sx={{ width: "100%" }}>
                {processing ? "Processing..." : `Complete Sale — ₹${total.toFixed(2)}`}
              </Button>
            </Box>)}
        </CardContent>
      </Card>

      {/* Receipt Drawer */}
      <SideDrawer open={receiptOpen} onClose={() => setReceiptOpen(false)} title={"Sale Complete"} width={400} footer={<>
            <Button onClick={printReceipt} variant="outlined" sx={{ flex: "1 1 0%", minHeight: 36 }}>
              <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Print
            </Button>
            <Button onClick={sendWhatsAppReceipt} variant="outlined" sx={{ flex: "1 1 0%", minHeight: 36 }}>
              <Box component={Phone} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>WhatsApp
            </Button>
            <Button onClick={sendEmailReceipt} variant="outlined" sx={{ flex: "1 1 0%", minHeight: 36 }}>
              <Box component={Mail} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Email
            </Button>
          </>}>

          {lastSale && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
              <Box sx={{ textAlign: "center" }}>
                <Typography component="p" variant="body1" sx={{ fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>{lastSale.txnNumber}</Typography>
                <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{new Date(lastSale.date).toLocaleString("en-IN")}</Typography>
              </Box>
              <Divider />
              {lastSale.items.map(c => (<Box key={c.product.id} sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box component="span">{c.product.name} ×{c.quantity}</Box>
                  <Box component="span">₹{(c.lineTotal + c.lineGst).toFixed(0)}</Box>
                </Box>))}
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span">Subtotal</Box><Box component="span">₹{lastSale.subtotal.toFixed(2)}</Box></Box>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span">GST</Box><Box component="span">₹{lastSale.gst.toFixed(2)}</Box></Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", lineHeight: "1.5rem" }}><Box component="span">Total</Box><Box component="span">₹{lastSale.total.toFixed(2)}</Box></Box>
              <Box sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", textTransform: "capitalize" }}>Paid via {lastSale.method}</Box>
            </Box>)}

        </SideDrawer>
    </Box></AnimatedPage>;
}
