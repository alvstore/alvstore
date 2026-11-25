"use client";

import {
  Box, Button, ButtonBase, Card, CardContent, Chip, Collapse, Divider, FormLabel,
  IconButton, InputAdornment, LinearProgress, MenuItem, Switch, TextField, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AnimatedPage, ChartTooltipCard, ChartViewport, CountUp, MetricStrip, PageHeader,
  SearchToolbar, SegmentedControl, SideDrawer, StatusChip, toast,
} from "@/components/mui";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordSystemAudit } from "@/lib/audit";
import { compactAxisNumber } from "@/lib/chart-theme";
import {
  buildPosShiftTelemetry,
  computePosCartTotals,
  type PosCartItem,
  type PosProduct,
  type PosTxnRecord,
} from "@/lib/pos-metrics";
import {
  Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone,
  Package, Barcode, Printer, Mail, User, Phone, PauseCircle, PlayCircle,
  BarChart3, Sparkles, PlusCircle, Percent, IndianRupee, Activity,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface HeldBill {
  id: string;
  label: string;
  cart: PosCartItem[];
  discountType: "percentage" | "fixed";
  discountValue: number;
  customerName: string;
  heldAt: string;
}

const HELD_STORAGE_KEY = "alv_pos_held_bills_v1";

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function POS() {
  const navigate = useNavigate();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [recentTxns, setRecentTxns] = useState<PosTxnRecord[]>([]);
  const [businessName, setBusinessName] = useState("ALVStore");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi">("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [processing, setProcessing] = useState(false);

  // Telemetry & drawered workflows
  const [showTelemetry, setShowTelemetry] = useState(true);
  const [telemetryRange, setTelemetryRange] = useState<1 | 7 | 30>(1);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [customDrawerOpen, setCustomDrawerOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", price: "", gst: "18", qty: "1" });
  const [heldDrawerOpen, setHeldDrawerOpen] = useState(false);
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastSale, setLastSale] = useState<{
    items: PosCartItem[];
    subtotal: number;
    discount: number;
    gst: number;
    total: number;
    method: string;
    txnNumber: string;
    date: string;
    reference?: string;
  } | null>(null);

  // Customer selection
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmail, setWalkInEmail] = useState("");
  const [saveAsCustomer, setSaveAsCustomer] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HELD_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHeldBills(parsed);
      }
    } catch {
      // ignore corrupted local storage
    }
  }, []);

  const persistHeldBills = (next: HeldBill[]) => {
    setHeldBills(next);
    try {
      localStorage.setItem(HELD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  };

  const fetchProducts = useCallback(async () => {
    let query = supabase
      .from("products")
      .select("id,name,sku,barcode,category,image_url,selling_price,gst_percentage,stock_quantity,unit")
      .gt("stock_quantity", 0);
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%,category.ilike.%${search}%`);
    }
    const { data } = await query.order("name").limit(80);
    setProducts((data as PosProduct[]) || []);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    let query = supabase.from("customers").select("id, name, phone, email");
    if (customerSearch) {
      query = query.or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%`);
    }
    const { data } = await query.order("name").limit(20);
    setExistingCustomers(data || []);
  }, [customerSearch]);

  const fetchTelemetry = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [txnRes, bizRes] = await Promise.all([
      supabase
        .from("pos_transactions")
        .select("id,transaction_number,subtotal,gst_amount,total,payment_method,created_at,items")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("business_settings").select("company_name").limit(1).maybeSingle(),
    ]);
    setRecentTxns((txnRes.data as PosTxnRecord[]) || []);
    if (bizRes.data?.company_name) setBusinessName(bizRes.data.company_name);
  }, []);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);
  useEffect(() => { void fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { void fetchTelemetry(); }, [fetchTelemetry]);
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category && p.category.trim()) set.add(p.category.trim());
    }
    return Array.from(set).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (selectedCategory === "all") return products;
    return products.filter(p => (p.category || "").trim() === selectedCategory);
  }, [products, selectedCategory]);

  const cartTotals = useMemo(
    () => computePosCartTotals(cart, discountType, discountValue),
    [cart, discountType, discountValue]
  );

  const telemetry = useMemo(
    () => buildPosShiftTelemetry(recentTxns, telemetryRange),
    [recentTxns, telemetryRange]
  );

  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = paymentMethod === "cash" && tenderedNum > 0 ? tenderedNum - cartTotals.total : 0;

  const addToCart = (product: PosProduct) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (!product.isCustom && existing.quantity >= product.stock_quantity) {
          toast.error("Insufficient stock");
          return prev;
        }
        const nextQty = existing.quantity + 1;
        return prev.map(c =>
          c.product.id === product.id
            ? {
                ...c,
                quantity: nextQty,
                lineTotal: nextQty * product.selling_price,
                lineGst: (nextQty * product.selling_price * product.gst_percentage) / 100,
              }
            : c
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          lineTotal: product.selling_price,
          lineGst: (product.selling_price * product.gst_percentage) / 100,
        },
      ];
    });
  };

  const addCustomToCart = () => {
    const price = parseFloat(customForm.price) || 0;
    const qty = Math.max(1, parseInt(customForm.qty, 10) || 1);
    const gst = Math.max(0, parseFloat(customForm.gst) || 0);
    if (!customForm.name.trim()) {
      toast.error("Enter item or service name");
      return;
    }
    if (price < 0) {
      toast.error("Price cannot be negative");
      return;
    }
    const customProduct: PosProduct = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: customForm.name.trim(),
      sku: "CUSTOM",
      barcode: null,
      category: "Custom",
      image_url: null,
      selling_price: price,
      gst_percentage: gst,
      stock_quantity: 9999,
      unit: "pcs",
      isCustom: true,
    };
    const lineTotal = price * qty;
    const lineGst = (lineTotal * gst) / 100;
    setCart(prev => [...prev, { product: customProduct, quantity: qty, lineTotal, lineGst }]);
    setCustomForm({ name: "", price: "", gst: "18", qty: "1" });
    setCustomDrawerOpen(false);
    toast.success(`${customProduct.name} added to cart`);
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(c => {
        if (c.product.id !== productId) return c;
        const newQty = c.quantity + delta;
        if (newQty <= 0) return c;
        if (!c.product.isCustom && newQty > c.product.stock_quantity) {
          toast.error("Insufficient stock");
          return c;
        }
        return {
          ...c,
          quantity: newQty,
          lineTotal: newQty * c.product.selling_price,
          lineGst: (newQty * c.product.selling_price * c.product.gst_percentage) / 100,
        };
      })
    );
  };

  const removeFromCart = (productId: string) =>
    setCart(prev => prev.filter(c => c.product.id !== productId));

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !barcodeInput.trim()) return;
    const code = barcodeInput.trim();
    const product = products.find(p => p.barcode === code || p.sku === code);
    if (product) {
      addToCart(product);
      setBarcodeInput("");
    } else {
      toast.error("Product not found for scanned code");
    }
  };

  const holdCurrentBill = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const custLabel = isWalkIn
      ? walkInName.trim() || "Walk-in"
      : existingCustomers.find(c => c.id === selectedCustomerId)?.name || "Customer";
    const held: HeldBill = {
      id: `hold-${Date.now()}`,
      label: `${custLabel} · ${cartTotals.itemCount} items`,
      cart,
      discountType,
      discountValue,
      customerName: custLabel,
      heldAt: new Date().toISOString(),
    };
    persistHeldBills([held, ...heldBills]);
    setCart([]);
    setDiscountValue(0);
    setCashTendered("");
    toast.success("Bill put on hold");
  };

  const resumeHeldBill = (held: HeldBill) => {
    setCart(held.cart);
    setDiscountType(held.discountType);
    setDiscountValue(held.discountValue);
    persistHeldBills(heldBills.filter(h => h.id !== held.id));
    setHeldDrawerOpen(false);
    toast.success(`Resumed bill (${held.customerName})`);
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (paymentMethod === "cash" && cashTendered && tenderedNum < cartTotals.total) {
      toast.error("Cash tendered is less than bill total");
      return;
    }
    setProcessing(true);
    try {
      let customerId: string | null = null;
      if (!isWalkIn && selectedCustomerId) {
        customerId = selectedCustomerId;
      } else if (isWalkIn && saveAsCustomer && walkInName.trim()) {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({
            name: walkInName.trim(),
            phone: walkInPhone || null,
            email: walkInEmail || null,
            created_by: user?.id,
          })
          .select("id")
          .single();
        if (!custErr && newCust) customerId = newCust.id;
      }

      const items = cart.map(c => ({
        product_id: c.product.isCustom ? null : c.product.id,
        name: c.product.name,
        qty: c.quantity,
        price: c.product.selling_price,
        gst: c.product.gst_percentage,
        total: c.lineTotal + c.lineGst,
        custom: Boolean(c.product.isCustom),
      }));

      const { data: txn, error: txnError } = await supabase
        .from("pos_transactions")
        .insert({
          items,
          subtotal: cartTotals.subtotal,
          gst_amount: cartTotals.gstAmount,
          total: cartTotals.total,
          payment_method: paymentMethod,
          created_by: user?.id,
          customer_id: customerId,
        })
        .select("id, transaction_number, created_at")
        .single();
      if (txnError) throw txnError;

      for (const c of cart) {
        if (c.product.isCustom) continue;
        await supabase.from("stock_movements").insert({
          product_id: c.product.id,
          type: "out" as const,
          quantity: c.quantity,
          reference: `POS ${txn?.transaction_number || "Sale"}`,
          created_by: user?.id,
        });
      }

      await recordSystemAudit({
        action: "pos_sale_completed",
        module: "sales",
        entityType: "pos_transaction",
        entityId: txn?.id,
        details: `POS ${txn?.transaction_number || ""} — ₹${cartTotals.total.toFixed(2)} via ${paymentMethod.toUpperCase()} (${cartTotals.itemCount} items)`,
      });

      setLastSale({
        items: [...cart],
        subtotal: cartTotals.subtotal,
        discount: cartTotals.discountAmount,
        gst: cartTotals.gstAmount,
        total: cartTotals.total,
        method: paymentMethod,
        txnNumber: txn?.transaction_number || "",
        date: txn?.created_at || new Date().toISOString(),
        reference: paymentRef.trim() || undefined,
      });
      setReceiptOpen(true);
      toast.success(`Sale completed — ₹${cartTotals.total.toFixed(2)}`);
      setCart([]);
      setDiscountValue(0);
      setCashTendered("");
      setPaymentRef("");
      setWalkInName("");
      setWalkInPhone("");
      setWalkInEmail("");
      setSaveAsCustomer(false);
      setSelectedCustomerId("");
      void fetchProducts();
      void fetchTelemetry();
    } catch (err: any) {
      toast.error(err.message || "Sale failed");
    }
    setProcessing(false);
  };

  const printReceipt = () => {
    const printWindow = window.open("", "_blank", "width=320,height=640");
    if (!printWindow || !lastSale) return;
    const html = `<!DOCTYPE html><html><head><title>Receipt ${lastSale.txnNumber}</title><style>
      body{font-family:monospace;font-size:12px;padding:12px;max-width:290px;margin:0 auto;color:#111}
      .center{text-align:center} .bold{font-weight:bold} .line{border-top:1px dashed #222;margin:8px 0}
      table{width:100%;border-collapse:collapse} td{padding:3px 0}
    </style></head><body>
      <div class="center bold" style="font-size:16px">${businessName}</div>
      <div class="center">${lastSale.txnNumber}</div>
      <div class="center">${new Date(lastSale.date).toLocaleString("en-IN")}</div>
      <div class="line"></div>
      <table>${lastSale.items.map(c => `<tr><td>${c.product.name} x${c.quantity}</td><td style="text-align:right">₹${(c.lineTotal + c.lineGst).toFixed(0)}</td></tr>`).join("")}</table>
      <div class="line"></div>
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">₹${lastSale.subtotal.toFixed(2)}</td></tr>
        ${lastSale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-₹${lastSale.discount.toFixed(2)}</td></tr>` : ""}
        <tr><td>GST</td><td style="text-align:right">₹${lastSale.gst.toFixed(2)}</td></tr>
        <tr class="bold"><td>TOTAL</td><td style="text-align:right">₹${lastSale.total.toFixed(2)}</td></tr>
      </table>
      <div class="line"></div>
      <div class="center">Paid via ${lastSale.method.toUpperCase()}${lastSale.reference ? ` · Ref: ${lastSale.reference}` : ""}</div>
      <div class="center" style="margin-top:10px">Thank you for choosing ${businessName}!</div>
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
    if (!lastSale) return;
    try {
      await supabase.functions.invoke("send-whatsapp", {
        body: {
          to: phone,
          message: `${businessName} Receipt ${lastSale.txnNumber}\nTotal: ₹${lastSale.total.toFixed(2)}\nPayment: ${lastSale.method.toUpperCase()}\nThank you!`,
        },
      });
      toast.success("WhatsApp receipt sent");
    } catch {
      toast.error("Failed to send WhatsApp");
    }
  };

  const sendEmailReceipt = async () => {
    const email = isWalkIn ? walkInEmail : existingCustomers.find(c => c.id === selectedCustomerId)?.email;
    if (!email) {
      toast.error("No email available");
      return;
    }
    if (!lastSale) return;
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: email,
          subject: `${businessName} Receipt — ${lastSale.txnNumber}`,
          body: `<p>Thank you for your purchase at <strong>${businessName}</strong>.</p><p>Receipt: <strong>${lastSale.txnNumber}</strong></p><p>Total Paid: <strong>₹${lastSale.total.toFixed(2)}</strong> via ${lastSale.method.toUpperCase()}</p>`,
        },
      });
      if (error || !data?.success) {
        toast.info("Configure SMTP in Settings → Integrations to enable email receipts");
      } else {
        toast.success("Email receipt sent");
      }
    } catch {
      toast.info("Configure SMTP in Settings → Integrations to enable email receipts");
    }
  };

  const primaryColor = theme.palette.primary.main;
  const chartData = telemetryRange === 1 ? telemetry.hourlyBuckets : telemetry.dailyBuckets;
  const chartXKey = telemetryRange === 1 ? "hour" : "label";
  const maxChartVal = Math.max(...chartData.map(d => d.revenue), 0);

  return (
    <AnimatedPage>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <PageHeader
          title="POS Terminal"
          subtitle="High-speed counter checkout, custom line items & live shift telemetry"
          actions={
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              <Button
                type="button"
                variant={showTelemetry ? "contained" : "outlined"}
                size="small"
                onClick={() => setShowTelemetry(v => !v)}
                startIcon={<Box component={BarChart3} sx={{ width: 14, height: 14 }} />}
              >
                {showTelemetry ? "Hide Telemetry" : "Shift Telemetry"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => setHeldDrawerOpen(true)}
                startIcon={<Box component={PauseCircle} sx={{ width: 14, height: 14 }} />}
              >
                Held Bills ({heldBills.length})
              </Button>
              <Button
                type="button"
                variant="contained"
                size="small"
                onClick={() => setCustomDrawerOpen(true)}
                startIcon={<Box component={PlusCircle} sx={{ width: 14, height: 14 }} />}
              >
                Custom Item
              </Button>
            </Box>
          }
        />

        {/* Top Live Shift KPI Strip */}
        <MetricStrip
          items={[
            { label: "Today's Revenue", value: telemetry.todayRevenue, isCurrency: true, accent: "primary", caption: `${telemetry.todayOrders} completed orders`, icon: <Box component={IndianRupee} sx={{ width: 18, height: 18 }} /> },
            { label: `${telemetryRange === 1 ? "24h" : `${telemetryRange}d`} Orders`, value: telemetry.periodOrders, accent: "info", caption: `Avg ${formatINR(telemetry.avgTicket)}`, icon: <Box component={Activity} sx={{ width: 18, height: 18 }} /> },
            { label: "Catalog Ready", value: products.length, accent: "success", caption: categories.length > 0 ? `${categories.length} categories` : "Use Custom Item anytime", icon: <Box component={Package} sx={{ width: 18, height: 18 }} /> },
            { label: "Active Cart", value: cartTotals.total, isCurrency: true, accent: "warning", caption: `${cartTotals.itemCount} items · ${heldBills.length} held`, icon: <Box component={ShoppingCart} sx={{ width: 18, height: 18 }} /> },
          ]}
        />

        {/* Collapsible 2026 Bento Telemetry Deck (inspired by halsa/kavora/skerry reels) */}
        <Collapse in={showTelemetry} unmountOnExit={false}>
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.55fr) minmax(0, 1fr)" },
              gap: 2,
            }}
          >
            {/* Left Telemetry Chart Card */}
            <Card sx={{ borderRadius: "20px", border: 1, borderColor: "divider" }}>
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                      {telemetryRange === 1 ? "Hourly Register Cadence" : `Register Sales (${telemetryRange} Days)`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Live revenue stream across completed POS transactions
                    </Typography>
                  </Box>
                  <SegmentedControl<1 | 7 | 30>
                    value={telemetryRange}
                    onChange={setTelemetryRange}
                    label="POS analytics timeframe"
                    options={[
                      { value: 1, label: "Today" },
                      { value: 7, label: "7D" },
                      { value: 30, label: "30D" },
                    ]}
                  />
                </Box>
                <ChartViewport height={180} label="POS register trend chart">
                  {animate => (
                    <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                      {telemetryRange === 1 ? (
                        <BarChart data={chartData} margin={{ top: 8, right: 6, left: -12, bottom: 0 }} barCategoryGap="28%">
                          <CartesianGrid vertical={false} stroke={alpha(theme.palette.divider, 0.7)} strokeDasharray="3 5" />
                          <XAxis dataKey={chartXKey} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: theme.palette.text.secondary }} interval={1} />
                          <YAxis width={46} axisLine={false} tickLine={false} tickFormatter={compactAxisNumber} tick={{ fontSize: 10.5, fill: theme.palette.text.secondary }} tickCount={4} />
                          <Tooltip
                            cursor={{ fill: alpha(primaryColor, 0.06) }}
                            content={({ active, payload }) => {
                              const pt = payload?.[0]?.payload as { hour?: string; revenue?: number; orders?: number } | undefined;
                              return (
                                <ChartTooltipCard
                                  active={active}
                                  title={pt?.hour}
                                  entries={[{ name: "Revenue", value: Number(pt?.revenue || 0), color: primaryColor }]}
                                  formatter={v => formatINR(v)}
                                  hint={pt?.orders ? `${pt.orders} orders` : "No orders in hour"}
                                />
                              );
                            }}
                          />
                          <Bar
                            dataKey="revenue"
                            radius={[8, 8, 3, 3]}
                            maxBarSize={32}
                            isAnimationActive={animate}
                            onMouseEnter={(_d, i) => setHoveredBar(i)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {chartData.map((d, idx) => (
                              <Cell
                                key={idx}
                                fill={
                                  hoveredBar === idx || (maxChartVal > 0 && d.revenue === maxChartVal)
                                    ? primaryColor
                                    : alpha(primaryColor, theme.palette.mode === "dark" ? 0.55 : 0.36)
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : (
                        <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
                          <defs>
                            <linearGradient id="posShiftGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={primaryColor} stopOpacity={0.28} />
                              <stop offset="100%" stopColor={primaryColor} stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke={alpha(theme.palette.divider, 0.7)} strokeDasharray="3 5" />
                          <XAxis dataKey={chartXKey} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: theme.palette.text.secondary }} interval={telemetryRange === 30 ? 4 : 0} />
                          <YAxis width={46} axisLine={false} tickLine={false} tickFormatter={compactAxisNumber} tick={{ fontSize: 10.5, fill: theme.palette.text.secondary }} tickCount={4} />
                          <Tooltip
                            content={({ active, payload }) => {
                              const pt = payload?.[0]?.payload as { label?: string; revenue?: number; orders?: number } | undefined;
                              return (
                                <ChartTooltipCard
                                  active={active}
                                  title={pt?.label}
                                  entries={[{ name: "Sales", value: Number(pt?.revenue || 0), color: primaryColor }]}
                                  formatter={v => formatINR(v)}
                                  hint={pt?.orders ? `${pt.orders} transactions` : "No transactions"}
                                />
                              );
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke={primaryColor}
                            strokeWidth={2.5}
                            fill="url(#posShiftGrad)"
                            isAnimationActive={animate}
                          />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </ChartViewport>
              </CardContent>
            </Card>

            {/* Right High-Contrast Obsidian Live Shift Pulse Card */}
            <Card
              sx={{
                borderRadius: "20px",
                bgcolor: "#111318",
                color: "#F8FAFC",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 16px 36px -16px rgba(17,19,24,0.45)",
              }}
            >
              <CardContent sx={{ p: 2.25, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      component={motion.span}
                      animate={reduced ? undefined : { opacity: [0.45, 1, 0.45], scale: [0.95, 1.15, 0.95] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#10B981", display: "inline-block" }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,250,252,0.72)" }}>
                      Live Shift Pulse
                    </Typography>
                  </Box>
                  <Box component={Activity} sx={{ width: 16, height: 16, color: "#10B981" }} />
                </Box>

                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 750, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
                    <CountUp value={telemetry.periodRevenue} formatter={formatINR} />
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(248,250,252,0.65)" }}>
                    {telemetry.periodOrders} orders · Avg ticket {formatINR(telemetry.avgTicket)}
                  </Typography>
                </Box>

                <Box sx={{ display: "grid", gap: 1 }}>
                  {telemetry.methodBreakdown.map(m => (
                    <Box key={m.method}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, mb: 0.4 }}>
                        <Box component="span" sx={{ color: "rgba(248,250,252,0.82)", fontWeight: 500 }}>{m.label} ({m.count})</Box>
                        <Box component="span" sx={{ fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>
                          {formatINR(m.amount)} · {m.pct}%
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={m.pct}
                        sx={{
                          height: 6,
                          borderRadius: 99,
                          bgcolor: "rgba(255,255,255,0.10)",
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 99,
                            bgcolor: m.method === "upi" ? "#10B981" : m.method === "card" ? "#3B82F6" : "#F59E0B",
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Collapse>

        {/* Main POS Terminal Grid */}
        <Box sx={{ display: "flex", flexDirection: { xs: "column", lg: "row" }, gap: 2, alignItems: "stretch" }}>
          {/* Left: Product Picker + Category Chips + Catalog Grid */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Card sx={{ borderRadius: "20px", border: 1, borderColor: "divider" }}>
              <CardContent sx={{ p: 2, display: "grid", gap: 1.25 }}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1 }}>
                  <TextField
                    placeholder="Scan barcode / SKU..."
                    value={barcodeInput}
                    onChange={e => setBarcodeInput(e.target.value)}
                    onKeyDown={handleBarcodeScan}
                    size="small"
                    fullWidth
                    inputRef={barcodeRef}
                    slotProps={{
                      htmlInput: { "aria-label": "Scan barcode" },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Box component={Barcode} sx={{ width: 16, height: 16, color: "text.secondary" }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ flex: 1 }}
                  />
                  <SearchToolbar onSearch={setSearch} value={search} placeholder="Search name, SKU, category..." sx={{ flex: 1.25 }} />
                </Box>

                {/* Category Pill Filter Bar */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, overflowX: "auto", pb: 0.25 }}>
                  <Chip
                    label={`All (${products.length})`}
                    size="small"
                    clickable
                    color={selectedCategory === "all" ? "primary" : "default"}
                    variant={selectedCategory === "all" ? "filled" : "outlined"}
                    onClick={() => setSelectedCategory("all")}
                  />
                  {categories.map(cat => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="small"
                      clickable
                      color={selectedCategory === cat ? "primary" : "default"}
                      variant={selectedCategory === cat ? "filled" : "outlined"}
                      onClick={() => setSelectedCategory(cat)}
                    />
                  ))}
                  <Chip
                    icon={<Box component={Plus} sx={{ width: 14, height: 14 }} />}
                    label="Add Custom Item"
                    size="small"
                    clickable
                    color="secondary"
                    variant="outlined"
                    onClick={() => setCustomDrawerOpen(true)}
                  />
                </Box>
              </CardContent>
            </Card>

            {/* Product Bento Grid or Actionable Empty Catalog State */}
            {visibleProducts.length === 0 ? (
              <Card sx={{ borderRadius: "20px", borderStyle: "dashed", borderWidth: 1, borderColor: "divider" }}>
                <CardContent sx={{ py: 6, px: 3, textAlign: "center", display: "grid", gap: 1.5, justifyItems: "center" }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: "16px", bgcolor: alpha(primaryColor, 0.1), color: "primary.main", display: "grid", placeItems: "center" }}>
                    <Box component={Sparkles} sx={{ width: 24, height: 24 }} />
                  </Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {search ? "No matching catalog products" : "Inventory catalog has 0 in-stock products"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                    Bill any custom item or service immediately at the counter, or add stock items to your catalog.
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                    <Button variant="contained" size="small" onClick={() => setCustomDrawerOpen(true)} startIcon={<Box component={PlusCircle} sx={{ width: 15, height: 15 }} />}>
                      Bill Custom Item Now
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => navigate("/inventory/add")}>
                      Add Product to Inventory
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
                  gap: 1.25,
                }}
              >
                {visibleProducts.map((p, idx) => (
                  <Box
                    key={p.id}
                    component={motion.div}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : Math.min(idx * 0.02, 0.24) }}
                  >
                    <ButtonBase
                      type="button"
                      onClick={() => addToCart(p)}
                      sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        p: 1.5,
                        borderRadius: "18px",
                        border: 1,
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        textAlign: "left",
                        transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                        "&:hover": {
                          borderColor: "primary.main",
                          transform: "translateY(-2px)",
                          boxShadow: `0 12px 24px -14px ${alpha(primaryColor, 0.35)}`,
                        },
                      }}
                    >
                      <Box sx={{ height: 84, borderRadius: "12px", bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", mb: 1.25 }}>
                        {p.image_url ? (
                          <Box component="img" src={p.image_url} alt={p.name} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Box component={Package} sx={{ width: 28, height: 28, color: "text.disabled" }} />
                        )}
                      </Box>
                      <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 650, mb: 0.25 }}>
                        {p.name}
                      </Typography>
                      <Typography noWrap variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                        {p.category || p.sku || "Ready"} · GST {p.gst_percentage}%
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: "auto" }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 750, fontVariantNumeric: "tabular-nums" }}>
                          ₹{Number(p.selling_price || 0).toLocaleString("en-IN")}
                        </Typography>
                        <StatusChip
                          label={`${p.stock_quantity} left`}
                          variant="outlined"
                          sx={{ fontSize: 10 }}
                        />
                      </Box>
                    </ButtonBase>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          {/* Right: Sticky Counter Cart & Settlement */}
          <Card
            sx={{
              width: { xs: "100%", lg: "400px" },
              flexShrink: 0,
              borderRadius: "20px",
              border: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
              position: { lg: "sticky" },
              top: { lg: 84 },
            }}
          >
            <CardContent sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25, flex: 1, overflow: "hidden" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 750, display: "flex", alignItems: "center", gap: 1 }}>
                  <Box component={ShoppingCart} sx={{ width: 18, height: 18, color: "primary.main" }} />
                  Active Bill
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  {cart.length > 0 && (
                    <Button size="small" variant="text" onClick={holdCurrentBill} startIcon={<Box component={PauseCircle} sx={{ width: 14, height: 14 }} />}>
                      Hold
                    </Button>
                  )}
                  <StatusChip label={`${cartTotals.itemCount} items`} />
                </Box>
              </Box>

              {/* Compact Customer Bar */}
              <Box sx={{ pb: 1.25, borderBottom: 1, borderColor: "divider", display: "grid", gap: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box component={User} sx={{ width: 14, height: 14 }} />
                    Customer
                  </FormLabel>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary">Walk-in</Typography>
                    <Switch
                      size="small"
                      checked={isWalkIn}
                      onChange={(_e, checked) => {
                        setIsWalkIn(checked);
                        setSelectedCustomerId("");
                      }}
                    />
                  </Box>
                </Box>
                {isWalkIn ? (
                  <Box sx={{ display: "grid", gap: 0.75 }}>
                    <TextField placeholder="Customer name (optional)" value={walkInName} onChange={e => setWalkInName(e.target.value)} size="small" fullWidth />
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.75 }}>
                      <TextField placeholder="Phone" value={walkInPhone} onChange={e => setWalkInPhone(e.target.value)} size="small" fullWidth />
                      <TextField placeholder="Email" value={walkInEmail} onChange={e => setWalkInEmail(e.target.value)} size="small" fullWidth />
                    </Box>
                    {walkInName.trim() && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <Switch size="small" checked={saveAsCustomer} onChange={(_e, checked) => setSaveAsCustomer(checked)} />
                        <Typography variant="caption" color="text.secondary">Save customer to CRM</Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ display: "grid", gap: 0.75 }}>
                    <TextField placeholder="Filter customers..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} size="small" fullWidth />
                    <TextField
                      value={selectedCustomerId}
                      select
                      size="small"
                      fullWidth
                      label="Select Customer"
                      onChange={e => setSelectedCustomerId(e.target.value)}
                      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                    >
                      <MenuItem value="" disabled>Choose registered customer</MenuItem>
                      {existingCustomers.map(c => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name} {c.phone ? `· ${c.phone}` : ""}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                )}
              </Box>

              {/* Animated Cart Items List */}
              {cart.length === 0 ? (
                <Box sx={{ flex: 1, minHeight: 140, display: "grid", placeItems: "center", textAlign: "center", py: 3 }}>
                  <Box sx={{ display: "grid", gap: 1, justifyItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      Scan a barcode, tap a product, or add a custom item
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => setCustomDrawerOpen(true)} startIcon={<Box component={Plus} sx={{ width: 14, height: 14 }} />}>
                      Add Custom Item
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 280, overflowY: "auto", display: "grid", gap: 0.75, alignContent: "start", pr: 0.25 }}>
                  <AnimatePresence initial={false}>
                    {cart.map(c => (
                      <Box
                        key={c.product.id}
                        component={motion.div}
                        layout={!reduced}
                        initial={reduced ? false : { opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={reduced ? undefined : { opacity: 0, x: -12 }}
                        transition={{ duration: reduced ? 0 : 0.16 }}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 1,
                          borderRadius: "12px",
                          bgcolor: "action.hover",
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                            {c.product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                            ₹{c.product.selling_price} × {c.quantity} ({c.product.gst_percentage}% GST)
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                          <IconButton size="small" onClick={() => updateQty(c.product.id, -1)} aria-label="Decrease quantity">
                            <Box component={Minus} sx={{ width: 13, height: 13 }} />
                          </IconButton>
                          <Typography sx={{ width: 22, textAlign: "center", fontSize: 13, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>
                            {c.quantity}
                          </Typography>
                          <IconButton size="small" onClick={() => updateQty(c.product.id, 1)} aria-label="Increase quantity">
                            <Box component={Plus} sx={{ width: 13, height: 13 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => removeFromCart(c.product.id)} aria-label="Remove item">
                            <Box component={Trash2} sx={{ width: 13, height: 13, color: "error.main" }} />
                          </IconButton>
                        </Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          ₹{(c.lineTotal + c.lineGst).toFixed(0)}
                        </Typography>
                      </Box>
                    ))}
                  </AnimatePresence>
                </Box>
              )}

              {/* Settlement Section */}
              {cart.length > 0 && (
                <Box sx={{ pt: 1.25, borderTop: 1, borderColor: "divider", display: "grid", gap: 1 }}>
                  {/* Discount Controls */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      type="number"
                      size="small"
                      label="Discount"
                      value={discountValue || ""}
                      placeholder="0"
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                size="small"
                                aria-label="Toggle discount type"
                                onClick={() => setDiscountType(t => (t === "percentage" ? "fixed" : "percentage"))}
                              >
                                <Box component={discountType === "percentage" ? Percent : IndianRupee} sx={{ width: 14, height: 14 }} />
                              </IconButton>
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      select
                      size="small"
                      label="Payment Mode"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value as "cash" | "card" | "upi")}
                      slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                      sx={{ flex: 1 }}
                    >
                      <MenuItem value="cash">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Box component={Banknote} sx={{ width: 15, height: 15 }} /> Cash</Box>
                      </MenuItem>
                      <MenuItem value="upi">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Box component={Smartphone} sx={{ width: 15, height: 15 }} /> UPI</Box>
                      </MenuItem>
                      <MenuItem value="card">
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Box component={CreditCard} sx={{ width: 15, height: 15 }} /> Card</Box>
                      </MenuItem>
                    </TextField>
                  </Box>

                  {paymentMethod === "cash" ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        type="number"
                        size="small"
                        label="Cash Tendered (₹)"
                        placeholder={cartTotals.total.toFixed(0)}
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <Button size="small" variant="outlined" onClick={() => setCashTendered(cartTotals.total.toFixed(0))}>
                        Exact
                      </Button>
                    </Box>
                  ) : (
                    <TextField
                      size="small"
                      label={`${paymentMethod.toUpperCase()} Ref / Last 4 (optional)`}
                      value={paymentRef}
                      onChange={e => setPaymentRef(e.target.value)}
                      fullWidth
                    />
                  )}

                  {paymentMethod === "cash" && tenderedNum >= cartTotals.total && tenderedNum > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, px: 1, py: 0.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main", fontWeight: 650 }}>
                      <Box component="span">Change Due</Box>
                      <Box component="span">₹{changeDue.toFixed(2)}</Box>
                    </Box>
                  )}

                  <Box sx={{ display: "grid", gap: 0.35, fontSize: 13 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Box component="span" sx={{ color: "text.secondary" }}>Subtotal</Box>
                      <Box component="span">₹{cartTotals.subtotal.toFixed(2)}</Box>
                    </Box>
                    {cartTotals.discountAmount > 0 && (
                      <Box sx={{ display: "flex", justifyContent: "space-between", color: "error.main" }}>
                        <Box component="span">Discount</Box>
                        <Box component="span">-₹{cartTotals.discountAmount.toFixed(2)}</Box>
                      </Box>
                    )}
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Box component="span" sx={{ color: "text.secondary" }}>GST</Box>
                      <Box component="span">₹{cartTotals.gstAmount.toFixed(2)}</Box>
                    </Box>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 750, fontSize: 16 }}>
                      <Box component="span">Payable Total</Box>
                      <Box component="span" sx={{ color: "primary.main", fontVariantNumeric: "tabular-nums" }}>₹{cartTotals.total.toFixed(2)}</Box>
                    </Box>
                  </Box>

                  <Button onClick={completeSale} disabled={processing} variant="contained" size="large" fullWidth>
                    {processing ? "Completing Sale..." : `Complete Sale — ₹${cartTotals.total.toFixed(2)}`}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Custom Item SideDrawer */}
        <SideDrawer
          open={customDrawerOpen}
          onClose={() => setCustomDrawerOpen(false)}
          title="Add Custom Item"
          description="Instant ad-hoc product, installation fee, or service charge"
          width={400}
          footer={
            <>
              <Button variant="outlined" onClick={() => setCustomDrawerOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
              <Button variant="contained" onClick={addCustomToCart} sx={{ minHeight: 36 }}>Add to Cart</Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              label="Item / Service Name *"
              placeholder="e.g. HDMI Cable 10m / Room Calibration"
              value={customForm.name}
              onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              type="number"
              label="Unit Price (₹) *"
              value={customForm.price}
              onChange={e => setCustomForm(f => ({ ...f, price: e.target.value }))}
              size="small"
              fullWidth
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                type="number"
                label="Quantity"
                value={customForm.qty}
                onChange={e => setCustomForm(f => ({ ...f, qty: e.target.value }))}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 1 } }}
              />
              <TextField
                type="number"
                label="GST %"
                value={customForm.gst}
                onChange={e => setCustomForm(f => ({ ...f, gst: e.target.value }))}
                size="small"
                fullWidth
              />
            </Box>
          </Box>
        </SideDrawer>

        {/* Held Bills SideDrawer */}
        <SideDrawer
          open={heldDrawerOpen}
          onClose={() => setHeldDrawerOpen(false)}
          title="Held Bills"
          description="Pause and resume walk-in customer carts without losing items"
          width={420}
        >
          {heldBills.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No held bills right now. Use Hold on an active cart to park a bill.
            </Typography>
          ) : (
            <Box sx={{ display: "grid", gap: 1.25 }}>
              {heldBills.map(hb => {
                const hbTotal = computePosCartTotals(hb.cart, hb.discountType, hb.discountValue);
                return (
                  <Card key={hb.id} variant="outlined" sx={{ borderRadius: "14px" }}>
                    <CardContent sx={{ p: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 650, fontSize: 13.5 }}>{hb.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatINR(hbTotal.total)} · {new Date(hb.heldAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 0.75 }}>
                        <Button size="small" variant="contained" onClick={() => resumeHeldBill(hb)} startIcon={<Box component={PlayCircle} sx={{ width: 14, height: 14 }} />}>
                          Resume
                        </Button>
                        <IconButton size="small" aria-label="Delete held bill" onClick={() => persistHeldBills(heldBills.filter(h => h.id !== hb.id))}>
                          <Box component={Trash2} sx={{ width: 14, height: 14, color: "error.main" }} />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </SideDrawer>

        {/* Receipt SideDrawer */}
        <SideDrawer
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          title="Sale Complete"
          description={businessName}
          width={400}
          footer={
            <>
              <Button onClick={printReceipt} variant="outlined" sx={{ flex: 1, minHeight: 36 }}>
                <Box component={Printer} sx={{ height: 16, width: 16, mr: 0.75 }} /> Print
              </Button>
              <Button onClick={sendWhatsAppReceipt} variant="outlined" sx={{ flex: 1, minHeight: 36 }}>
                <Box component={Phone} sx={{ height: 16, width: 16, mr: 0.75 }} /> WhatsApp
              </Button>
              <Button onClick={sendEmailReceipt} variant="outlined" sx={{ flex: 1, minHeight: 36 }}>
                <Box component={Mail} sx={{ height: 16, width: 16, mr: 0.75 }} /> Email
              </Button>
            </>
          }
        >
          {lastSale && (
            <Box sx={{ display: "grid", gap: 1.5, fontSize: 14 }}>
              <Box sx={{ textAlign: "center", p: 2, borderRadius: "14px", bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                <Typography sx={{ fontWeight: 750, fontSize: 16 }}>{businessName}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mt: 0.5 }}>{lastSale.txnNumber || "POS RECEIPT"}</Typography>
                <Typography variant="caption" color="text.secondary">{new Date(lastSale.date).toLocaleString("en-IN")}</Typography>
              </Box>
              <Divider />
              {lastSale.items.map(c => (
                <Box key={c.product.id} sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box component="span">{c.product.name} ×{c.quantity}</Box>
                  <Box component="span" sx={{ fontWeight: 600 }}>₹{(c.lineTotal + c.lineGst).toFixed(0)}</Box>
                </Box>
              ))}
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span">Subtotal</Box><Box component="span">₹{lastSale.subtotal.toFixed(2)}</Box></Box>
              {lastSale.discount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", color: "error.main" }}><Box component="span">Discount</Box><Box component="span">-₹{lastSale.discount.toFixed(2)}</Box></Box>}
              <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span">GST</Box><Box component="span">₹{lastSale.gst.toFixed(2)}</Box></Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: 750, fontSize: 16 }}><Box component="span">Total Paid</Box><Box component="span">₹{lastSale.total.toFixed(2)}</Box></Box>
              <StatusChip label={`Paid via ${lastSale.method.toUpperCase()}${lastSale.reference ? ` · Ref: ${lastSale.reference}` : ""}`} sx={{ justifySelf: "center" }} />
            </Box>
          )}
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
