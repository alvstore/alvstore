import { useState, useMemo, useRef, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Package, Tag, Percent, TrendingUp, Gift, Search,
  Plus, Calculator, Download, ArrowUpDown, Star, X,
  IndianRupee, Layers, BarChart3, Upload, FileSpreadsheet,
  RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Info, Trash2, FileText, Pencil
} from "lucide-react";

type AppleProduct = {
  id: string; part_number: string; description: string; sap_description: string | null;
  category: string; subcategory: string | null; mrp: number; alp_ex_vat: number;
  gst_percentage: number; is_new: boolean; status: string; created_at: string;
};

type AppleOffer = {
  id: string; offer_type: string; bank_name: string | null; applicable_category: string;
  applicable_product: string | null; discount_amount: number; discount_description: string | null;
  start_date: string | null; end_date: string | null; status: string;
};

type PricingRule = {
  id: string; category: string; discount_percentage: number; discount_amount: number;
  rule_name: string | null; status: string; cash_discount_type: string | null;
  cash_discount_value: number | null; cash_discount_mode: string | null;
};

type FieldMapping = Record<string, string>;

const CATEGORIES = ["iPhone", "Mac", "iPad", "Watch", "AirPods", "HomePod", "Beats", "Accessories", "AppleCare"];
const SYSTEM_FIELDS = ["part_number", "description", "sap_description", "category", "subcategory", "mrp", "alp_ex_vat", "gst_percentage"];
const SYSTEM_FIELD_LABELS: Record<string, string> = {
  part_number: "Part Number", description: "Description", sap_description: "SAP Description",
  category: "Category", subcategory: "Subcategory", mrp: "MRP (Inc VAT)", alp_ex_vat: "ALP Ex VAT", gst_percentage: "GST %",
};
const OFFER_TYPES: Record<string, string> = {
  card_emi: "Card EMI", card_fs: "Card Full Swipe", loan: "Loan", trade_in: "Trade-in",
  iphone_for_life: "iPhone for Life", cashback: "Cashback", instant_discount: "Instant Discount", other: "Other",
};

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

const normCat = (cat: string) => (cat || "").trim().toLowerCase();

const CATEGORY_NORMALIZE_MAP: Record<string, string> = {
  iphone: "iPhone", mac: "Mac", ipad: "iPad", watch: "Watch", airpods: "AirPods",
  homepod: "HomePod", beats: "Beats", accessories: "Accessories", applecare: "AppleCare",
  macbook: "Mac", "macbook pro": "Mac", "macbook air": "Mac", imac: "Mac",
};

const normalizeCategory = (raw: string): string => {
  const key = normCat(raw);
  return CATEGORY_NORMALIZE_MAP[key] || raw;
};

// Extract color from description
const extractColor = (desc: string): string => {
  const colors = ["black", "white", "blue", "green", "red", "pink", "purple", "yellow", "orange",
    "silver", "gold", "space gray", "space grey", "midnight", "starlight", "natural titanium",
    "desert titanium", "blue titanium", "white titanium", "teal", "ultramarine"];
  const lower = desc.toLowerCase();
  for (const c of colors) {
    if (lower.includes(c)) return c.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  }
  return "";
};

// Extract storage from description
const extractStorage = (desc: string): string => {
  const match = desc.match(/(\d+)\s*(GB|TB)/i);
  return match ? `${match[1]}${match[2].toUpperCase()}` : "";
};

export default function ApplePricing() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [storageFilter, setStorageFilter] = useState<string>("all");
  const [offerFilter, setOfferFilter] = useState(false);
  const [sortBy, setSortBy] = useState<"mrp" | "margin" | "name">("name");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Calculator state
  const [calcProduct, setCalcProduct] = useState("");
  const [calcSellingPrice, setCalcSellingPrice] = useState("");
  const [calcSelectedOffers, setCalcSelectedOffers] = useState<string[]>([]);
  const [calcCashDiscountEnabled, setCalcCashDiscountEnabled] = useState(false);
  const [calcSearch, setCalcSearch] = useState("");

  // Dialog states
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [editingOffer, setEditingOffer] = useState<AppleOffer | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);

  // New rule form
  const [newRule, setNewRule] = useState({
    category: "", discount_percentage: "", rule_name: "",
    cash_discount_type: "on_base_price", cash_discount_value: "", cash_discount_mode: "percentage",
  });

  // New product form
  const [newProduct, setNewProduct] = useState({
    part_number: "", description: "", category: "", mrp: "", alp_ex_vat: "", gst_percentage: "18",
  });

  // New offer form
  const [newOffer, setNewOffer] = useState({
    offer_type: "", bank_name: "", applicable_category: "", applicable_product: "",
    discount_amount: "", discount_description: "", start_date: "", end_date: "",
  });

  // Import state
  const [importData, setImportData] = useState<string[][]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [importHistory, setImportHistory] = useState<Array<{ date: string; count: number }>>(() => {
    try { return JSON.parse(localStorage.getItem("apple_import_history") || "[]"); } catch { return []; }
  });

  // Queries
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["apple-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apple_products").select("*").eq("status", "active").order("category").order("mrp", { ascending: false });
      if (error) throw error;
      return data as AppleProduct[];
    },
  });

  const { data: offers = [] } = useQuery({
    queryKey: ["apple-offers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apple_offers").select("*");
      if (error) throw error;
      return data as AppleOffer[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["apple-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apple_pricing_rules").select("*").eq("status", "active");
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        cash_discount_type: r.cash_discount_type ?? "on_base_price",
        cash_discount_value: r.cash_discount_value ?? 0,
        cash_discount_mode: r.cash_discount_mode ?? "percentage",
      })) as PricingRule[];
    },
  });

  // Active (non-expired) offers only
  const activeOffersList = useMemo(() => {
    const now = new Date();
    return offers.filter((o) => {
      if (o.status !== "active") return false;
      if (o.end_date && new Date(o.end_date) < now) return false;
      return true;
    });
  }, [offers]);

  // Extract unique colors and storage values for filters
  const uniqueColors = useMemo(() => {
    const colors = new Set<string>();
    products.forEach(p => {
      const c = extractColor(p.description);
      if (c) colors.add(c);
    });
    return Array.from(colors).sort();
  }, [products]);

  const uniqueStorages = useMemo(() => {
    const storages = new Set<string>();
    products.forEach(p => {
      const s = extractStorage(p.description);
      if (s) storages.add(s);
    });
    return Array.from(storages).sort((a, b) => {
      const numA = parseInt(a); const numB = parseInt(b);
      if (a.includes("TB") && !b.includes("TB")) return 1;
      if (!a.includes("TB") && b.includes("TB")) return -1;
      return numA - numB;
    });
  }, [products]);

  // Mutations
  const addRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const { error } = await supabase.from("apple_pricing_rules").insert(rule);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] }); toast.success("Rule added"); setShowRuleDialog(false); },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apple_pricing_rules").update({ status: "inactive" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] }); toast.success("Rule removed"); },
  });

  const addProductMutation = useMutation({
    mutationFn: async (product: any) => {
      const { error } = await supabase.from("apple_products").upsert(product, { onConflict: "part_number" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-products"] }); toast.success("Product added"); setShowProductDialog(false); setNewProduct({ part_number: "", description: "", category: "", mrp: "", alp_ex_vat: "", gst_percentage: "18" }); },
  });

  const saveOfferMutation = useMutation({
    mutationFn: async (offer: any) => {
      if (offer.id) {
        const { id, ...rest } = offer;
        const { error } = await supabase.from("apple_offers").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("apple_offers").insert(offer);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apple-offers"] });
      toast.success(editingOffer ? "Offer updated" : "Offer added");
      setShowOfferDialog(false);
      setEditingOffer(null);
      setNewOffer({ offer_type: "", bank_name: "", applicable_category: "", applicable_product: "", discount_amount: "", discount_description: "", start_date: "", end_date: "" });
    },
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apple_offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-offers"] }); toast.success("Offer deleted"); },
  });

  // ===== CALCULATION ENGINE =====
  const ruleMap = useMemo(() => {
    const m: Record<string, PricingRule> = {};
    rules.forEach((r) => (m[normCat(r.category)] = r));
    return m;
  }, [rules]);

  const getRuleForProduct = (product: AppleProduct): PricingRule | undefined => ruleMap[normCat(product.category)];
  const getBasePrice = (product: AppleProduct) => product.mrp / (1 + (product.gst_percentage || 18) / 100);

  const getBaseDiscount = (product: AppleProduct) => {
    const rule = getRuleForProduct(product);
    if (!rule) return 0;
    if (rule.discount_percentage > 0) return (product.mrp * rule.discount_percentage) / 100;
    return rule.discount_amount;
  };

  const getOffersForProduct = useCallback((product: AppleProduct) => {
    return activeOffersList.filter(
      (o) => normCat(o.applicable_category) === normCat(product.category) &&
        (!o.applicable_product || product.description.toLowerCase().includes(o.applicable_product.toLowerCase()))
    );
  }, [activeOffersList]);

  const getBestOfferDiscount = (product: AppleProduct) => {
    const pOffers = getOffersForProduct(product);
    if (pOffers.length === 0) return 0;
    return Math.max(...pOffers.map((o) => o.discount_amount));
  };

  const getLandingCost = (product: AppleProduct) => product.mrp - getBaseDiscount(product) - getBestOfferDiscount(product);

  const getCashDiscount = (product: AppleProduct) => {
    const rule = getRuleForProduct(product);
    if (!rule || !rule.cash_discount_value) return 0;
    let base = 0;
    if (rule.cash_discount_type === "on_base_price") base = getBasePrice(product);
    else if (rule.cash_discount_type === "on_mrp") base = product.mrp;
    else if (rule.cash_discount_type === "on_landing_cost") base = getLandingCost(product);
    if (rule.cash_discount_mode === "percentage") return (base * (rule.cash_discount_value || 0)) / 100;
    return rule.cash_discount_value || 0;
  };

  const getFinalCost = (product: AppleProduct) => getLandingCost(product);

  // Filtered list
  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !search || p.description.toLowerCase().includes(q) || p.part_number.toLowerCase().includes(q) || normCat(p.category).includes(q);
      const matchCat = categoryFilter === "all" || normCat(p.category) === normCat(categoryFilter);
      const matchColor = colorFilter === "all" || extractColor(p.description).toLowerCase() === colorFilter.toLowerCase();
      const matchStorage = storageFilter === "all" || extractStorage(p.description) === storageFilter;
      const matchOffer = !offerFilter || getOffersForProduct(p).length > 0;
      return matchSearch && matchCat && matchColor && matchStorage && matchOffer;
    });
    list.sort((a, b) => {
      if (sortBy === "mrp") return b.mrp - a.mrp;
      if (sortBy === "margin") return getFinalCost(a) - getFinalCost(b);
      return a.description.localeCompare(b.description);
    });
    return list;
  }, [products, search, categoryFilter, colorFilter, storageFilter, offerFilter, sortBy, ruleMap, activeOffersList]);

  // KPIs
  const totalProducts = products.length;
  const totalActiveOffers = activeOffersList.length;
  const productsWithOffers = products.filter((p) => getOffersForProduct(p).length > 0).length;
  const avgDiscPct = products.length > 0
    ? products.reduce((s, p) => s + ((p.mrp - getFinalCost(p)) / p.mrp) * 100, 0) / products.length : 0;
  const bestMarginProduct = products.reduce(
    (best, p) => { const m = ((p.mrp - getFinalCost(p)) / p.mrp) * 100; return m > best.margin ? { product: p, margin: m } : best; },
    { product: null as AppleProduct | null, margin: 0 }
  );

  // Calculator
  const calcProductData = products.find((p) => p.id === calcProduct);
  const calcBaseDiscount = calcProductData ? getBaseDiscount(calcProductData) : 0;
  const calcOfferDiscount = calcSelectedOffers.reduce((s, id) => s + (activeOffersList.find((o) => o.id === id)?.discount_amount || 0), 0);
  const calcLandingCost = calcProductData ? calcProductData.mrp - calcBaseDiscount - calcOfferDiscount : 0;
  const calcCashDiscount = calcCashDiscountEnabled && calcProductData ? getCashDiscount(calcProductData) : 0;
  const calcFinalCost = calcLandingCost - calcCashDiscount;
  const calcSP = parseFloat(calcSellingPrice) || 0;
  const calcMargin = calcSP - calcFinalCost;
  const calcMarginPct = calcSP > 0 ? (calcMargin / calcSP) * 100 : 0;

  // Calculator search results
  const calcSearchResults = useMemo(() => {
    if (!calcSearch.trim()) return [];
    const q = calcSearch.toLowerCase();
    return products.filter((p) =>
      p.description.toLowerCase().includes(q) ||
      p.part_number.toLowerCase().includes(q) ||
      normCat(p.category).includes(q)
    ).slice(0, 10);
  }, [products, calcSearch]);

  // Excel import handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
      if (data.length < 2) { toast.error("File has no data rows"); return; }
      setImportHeaders(data[0].map(String));
      setImportData(data.slice(1).filter((row) => row.some(Boolean)));
      const autoMap: FieldMapping = {};
      const headers = data[0].map((h) => String(h).toLowerCase().trim());
      headers.forEach((h, i) => {
        const col = data[0][i] as string;
        if (h.includes("part") && h.includes("number")) autoMap["part_number"] = col;
        else if (h.includes("description") && !h.includes("sap")) autoMap["description"] = col;
        else if (h.includes("sap")) autoMap["sap_description"] = col;
        else if (h === "category" || h.includes("category")) autoMap["category"] = col;
        else if (h.includes("mrp") || h.includes("inc vat") || h.includes("alp inc")) autoMap["mrp"] = col;
        else if (h.includes("ex vat") || h.includes("alp ex")) autoMap["alp_ex_vat"] = col;
      });
      setFieldMapping(autoMap);
      const saved = localStorage.getItem("apple_field_mapping");
      if (saved) { try { setFieldMapping(JSON.parse(saved)); } catch {} }
    };
    reader.readAsBinaryString(file);
  };

  const runImport = async () => {
    if (!fieldMapping.part_number || !fieldMapping.description || !fieldMapping.mrp) {
      toast.error("Map at least Part Number, Description, and MRP"); return;
    }
    const headerIdx: Record<string, number> = {};
    importHeaders.forEach((h, i) => (headerIdx[h] = i));
    const rows = importData.map((row) => {
      const obj: any = { status: "active", gst_percentage: 18 };
      Object.entries(fieldMapping).forEach(([sysField, excelCol]) => {
        const idx = headerIdx[excelCol];
        if (idx !== undefined && row[idx] !== undefined) {
          const val = row[idx];
          if (["mrp", "alp_ex_vat", "gst_percentage"].includes(sysField)) obj[sysField] = parseFloat(String(val)) || 0;
          else obj[sysField] = String(val).trim();
        }
      });
      if (obj.category) obj.category = normalizeCategory(obj.category);
      if (!obj.category) obj.category = "Uncategorized";
      return obj;
    }).filter((r) => r.part_number && r.description && r.mrp > 0);

    if (rows.length === 0) { toast.error("No valid rows to import"); return; }

    let imported = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from("apple_products").upsert(chunk, { onConflict: "part_number" });
      if (error) { toast.error(`Import error: ${error.message}`); return; }
      imported += chunk.length;
    }

    localStorage.setItem("apple_field_mapping", JSON.stringify(fieldMapping));
    const newHistory = [{ date: new Date().toISOString(), count: imported }, ...importHistory.slice(0, 9)];
    setImportHistory(newHistory);
    localStorage.setItem("apple_import_history", JSON.stringify(newHistory));
    queryClient.invalidateQueries({ queryKey: ["apple-products"] });
    toast.success(`Imported ${imported} products`);
    setImportData([]);
  };

  const exportCSV = () => {
    const headers = ["Part Number", "Description", "Category", "MRP", "ALP Ex VAT", "Base Price", "Base Disc", "Offer Disc", "Landing Cost"];
    const rows = filtered.map((p) => [
      p.part_number, `"${p.description}"`, p.category, p.mrp, p.alp_ex_vat, getBasePrice(p).toFixed(0),
      getBaseDiscount(p), getBestOfferDiscount(p), getLandingCost(p),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "apple-pricing-export.csv"; a.click();
  };

  const openEditOffer = (offer: AppleOffer) => {
    setEditingOffer(offer);
    setNewOffer({
      offer_type: offer.offer_type, bank_name: offer.bank_name || "",
      applicable_category: offer.applicable_category, applicable_product: offer.applicable_product || "",
      discount_amount: String(offer.discount_amount), discount_description: offer.discount_description || "",
      start_date: offer.start_date || "", end_date: offer.end_date || "",
    });
    setShowOfferDialog(true);
  };

  const handleSaveOffer = () => {
    if (!newOffer.offer_type || !newOffer.applicable_category || !newOffer.discount_amount) { toast.error("Fill required fields"); return; }
    const payload: any = {
      offer_type: newOffer.offer_type, bank_name: newOffer.bank_name || null, applicable_category: newOffer.applicable_category,
      applicable_product: newOffer.applicable_product || null, discount_amount: parseFloat(newOffer.discount_amount),
      discount_description: newOffer.discount_description || null, start_date: newOffer.start_date || null, end_date: newOffer.end_date || null,
    };
    if (editingOffer) payload.id = editingOffer.id;
    else payload.status = "active";
    saveOfferMutation.mutate(payload);
  };

  // Offer category filter for offers tab
  const [offerCategoryFilter, setOfferCategoryFilter] = useState("all");
  const [offerStatusFilter, setOfferStatusFilter] = useState<"all" | "active" | "expired">("all");

  const filteredOffers = useMemo(() => {
    const now = new Date();
    return offers.filter(o => {
      if (offerCategoryFilter !== "all" && normCat(o.applicable_category) !== normCat(offerCategoryFilter)) return false;
      const expired = o.end_date && new Date(o.end_date) < now;
      if (offerStatusFilter === "active" && (expired || o.status !== "active")) return false;
      if (offerStatusFilter === "expired" && !expired) return false;
      return true;
    });
  }, [offers, offerCategoryFilter, offerStatusFilter]);

  const compareList: string[] = [];

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Apple Pricing Engine</h1>
          <p className="text-sm text-muted-foreground">Dynamic pricing, offers & margin calculator</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={() => setShowProductDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditingOffer(null); setNewOffer({ offer_type: "", bank_name: "", applicable_category: "", applicable_product: "", discount_amount: "", discount_description: "", start_date: "", end_date: "" }); setShowOfferDialog(true); }}>
            <Gift className="h-4 w-4 mr-1" /> Add Offer
          </Button>
          <Button variant="outline" size="sm" onClick={() => { queryClient.invalidateQueries(); toast.success("Recalculated"); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Recalculate
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Delete All
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Delete All Products?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This will permanently delete all Apple products. Use before importing a fresh price list.</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="destructive" onClick={async () => {
                  const { error } = await supabase.from("apple_products").update({ status: "inactive" } as any).neq("id", "00000000-0000-0000-0000-000000000000");
                  if (error) { toast.error(error.message); return; }
                  queryClient.invalidateQueries({ queryKey: ["apple-products"] });
                  toast.success("All products marked inactive");
                }}>Delete All</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Package, color: "text-primary", bg: "bg-primary/10", value: totalProducts, label: "Products" },
          { icon: Gift, color: "text-green-500", bg: "bg-green-500/10", value: totalActiveOffers, label: "Active Offers" },
          { icon: Percent, color: "text-blue-500", bg: "bg-blue-500/10", value: `${avgDiscPct.toFixed(1)}%`, label: "Avg Discount" },
          { icon: Star, color: "text-amber-500", bg: "bg-amber-500/10", value: bestMarginProduct.product?.description?.split(" ").slice(0, 3).join(" ") || "—", label: "Best Discount", small: true },
          { icon: Tag, color: "text-purple-500", bg: "bg-purple-500/10", value: productsWithOffers, label: "With Offers" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className={`font-bold ${kpi.small ? "text-sm truncate" : "text-2xl"}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="catalog"><Layers className="h-4 w-4 mr-1" /> Catalog</TabsTrigger>
          <TabsTrigger value="rules"><Percent className="h-4 w-4 mr-1" /> Pricing Rules</TabsTrigger>
          <TabsTrigger value="offers"><Gift className="h-4 w-4 mr-1" /> Offers</TabsTrigger>
          <TabsTrigger value="calculator"><Calculator className="h-4 w-4 mr-1" /> Calculator</TabsTrigger>
          <TabsTrigger value="import"><FileSpreadsheet className="h-4 w-4 mr-1" /> Import</TabsTrigger>
        </TabsList>

        {/* CATALOG TAB */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search product, part number, or category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                {uniqueColors.length > 0 && (
                  <Select value={colorFilter} onValueChange={setColorFilter}>
                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="Color" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Colors</SelectItem>
                      {uniqueColors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {uniqueStorages.length > 0 && (
                  <Select value={storageFilter} onValueChange={setStorageFilter}>
                    <SelectTrigger className="w-[120px]"><SelectValue placeholder="Storage" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Storage</SelectItem>
                      {uniqueStorages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Button variant={offerFilter ? "default" : "outline"} size="sm" onClick={() => setOfferFilter(!offerFilter)}>
                  <Gift className="h-4 w-4 mr-1" /> Offers Only
                </Button>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="mrp">Price ↓</SelectItem>
                    <SelectItem value="margin">Best Margin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Part Number</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">Base Disc.</TableHead>
                      <TableHead className="text-right">Offer Disc.</TableHead>
                      <TableHead className="text-right">Landing Cost</TableHead>
                      <TableHead>Offers</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No products found. Import data to get started.</TableCell></TableRow>
                    ) : (
                      filtered.slice(0, 100).map((p) => {
                        const rule = getRuleForProduct(p);
                        const baseDisc = getBaseDiscount(p);
                        const offerDisc = getBestOfferDiscount(p);
                        const landingCost = getLandingCost(p);
                        const cashDisc = getCashDiscount(p);
                        const pOffers = getOffersForProduct(p);
                        const isExpanded = expandedRow === p.id;

                        return (
                          <Fragment key={p.id}>
                            <TableRow className="group cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : p.id)}>
                              <TableCell>
                                <span className="font-medium text-sm">{p.description}</span>
                                {p.is_new && <Badge variant="secondary" className="ml-2 text-[10px] bg-green-500/10 text-green-600">NEW</Badge>}
                              </TableCell>
                              <TableCell><span className="font-mono text-xs text-muted-foreground">{p.part_number}</span></TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{p.category}</Badge></TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatINR(p.mrp)}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{baseDisc > 0 ? <span className="text-green-600">-{formatINR(baseDisc)}</span> : "—"}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{offerDisc > 0 ? <span className="text-blue-600">-{formatINR(offerDisc)}</span> : "—"}</TableCell>
                              <TableCell className="text-right font-mono text-sm font-semibold">{formatINR(landingCost)}</TableCell>
                              <TableCell>
                                {pOffers.length > 0 ? (
                                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">{pOffers.length} offer{pOffers.length > 1 ? "s" : ""}</Badge>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={9} className="bg-muted/30 p-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
                                    {[
                                      { label: "MRP (incl GST)", value: formatINR(p.mrp) },
                                      { label: `Base Price (ex ${p.gst_percentage || 18}% GST)`, value: formatINR(getBasePrice(p)) },
                                      { label: `Base Discount (${rule?.discount_percentage || 0}% on MRP)`, value: baseDisc > 0 ? `-${formatINR(baseDisc)}` : "—", color: "text-green-600" },
                                      { label: "Best Offer Discount", value: offerDisc > 0 ? `-${formatINR(offerDisc)}` : "—", color: "text-blue-600" },
                                      { label: "Landing Cost", value: formatINR(landingCost), bold: true },
                                      { label: `Cash Disc. (${rule?.cash_discount_value || 0}% on Base Price)`, value: cashDisc > 0 ? `-${formatINR(cashDisc)}` : "—", color: "text-purple-600", note: "Optional — advance payment" },
                                      { label: "Final Cost (with cash disc.)", value: cashDisc > 0 ? formatINR(landingCost - cashDisc) : "—", bold: true, note: "If advance paid" },
                                    ].map((item, i) => (
                                      <div key={i} className="p-2 rounded-lg bg-background border">
                                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                                        <p className={`font-mono ${item.bold ? "font-bold" : ""} ${item.color || ""}`}>{item.value}</p>
                                        {item.note && <p className="text-[9px] text-muted-foreground italic mt-0.5">{item.note}</p>}
                                      </div>
                                    ))}
                                  </div>
                                  {pOffers.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {pOffers.map(o => (
                                        <Badge key={o.id} variant="outline" className="text-xs">
                                          {OFFER_TYPES[o.offer_type] || o.offer_type} — {o.bank_name} — {formatINR(o.discount_amount)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {rule && (
                                    <div className="mt-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                                      <Info className="h-3 w-3" />
                                      <span>Matched Rule: <strong>{rule.rule_name || rule.category}</strong> — {rule.discount_percentage}% base discount
                                        {(rule.cash_discount_value ?? 0) > 0 && ` + ${rule.cash_discount_value}% cash discount on ${rule.cash_discount_type === "on_base_price" ? "Base Price" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}`}
                                      </span>
                                    </div>
                                  )}
                                  {!rule && (
                                    <div className="mt-3 p-2 rounded bg-amber-500/10 text-xs text-amber-700 flex items-center gap-2">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span>No pricing rule found for category "{p.category}". Add a rule to enable discounts.</span>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Showing 100 of {filtered.length} products</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRICING RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Category-wise Pricing Rules</h2>
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Pricing Rule</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={newRule.category} onValueChange={(v) => setNewRule({ ...newRule, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Base Discount % (on MRP incl GST)</Label><Input type="number" placeholder="e.g. 5.5" value={newRule.discount_percentage} onChange={(e) => setNewRule({ ...newRule, discount_percentage: e.target.value })} /></div>
                  <div><Label>Rule Name</Label><Input placeholder="e.g. Standard iPhone Discount" value={newRule.rule_name} onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })} /></div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-1">Cash Discount (Optional — advance payment)</p>
                    <p className="text-xs text-muted-foreground mb-3">Only applied when customer opts for advance cash billing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Applied On</Label>
                        <Select value={newRule.cash_discount_type} onValueChange={(v) => setNewRule({ ...newRule, cash_discount_type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_base_price">Base Price (ex GST)</SelectItem>
                            <SelectItem value="on_mrp">MRP</SelectItem>
                            <SelectItem value="on_landing_cost">Landing Cost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Mode</Label>
                        <Select value={newRule.cash_discount_mode} onValueChange={(v) => setNewRule({ ...newRule, cash_discount_mode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-2"><Label className="text-xs">Value</Label><Input type="number" placeholder="e.g. 0.5" value={newRule.cash_discount_value} onChange={(e) => setNewRule({ ...newRule, cash_discount_value: e.target.value })} /></div>
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!newRule.category || !newRule.discount_percentage) { toast.error("Fill required fields"); return; }
                    addRuleMutation.mutate({
                      category: newRule.category, discount_percentage: parseFloat(newRule.discount_percentage), rule_name: newRule.rule_name,
                      cash_discount_type: newRule.cash_discount_type, cash_discount_value: parseFloat(newRule.cash_discount_value) || 0, cash_discount_mode: newRule.cash_discount_mode,
                    });
                  }}>Save Rule</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.length === 0 ? (
              <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No pricing rules configured.</CardContent></Card>
            ) : rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{rule.category}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRuleMutation.mutate(rule.id)}><X className="h-3 w-3" /></Button>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{rule.discount_percentage}%</p>
                  <p className="text-xs text-muted-foreground">{rule.rule_name || "Base discount on MRP (incl GST)"}</p>
                  {(rule.cash_discount_value ?? 0) > 0 && (
                    <div className="mt-2 p-2 rounded bg-purple-500/5 border border-purple-500/10">
                      <p className="text-xs text-purple-600">
                        Cash: {rule.cash_discount_value}{rule.cash_discount_mode === "percentage" ? "%" : " flat"} on{" "}
                        {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Optional — requires advance payment</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* OFFERS TAB */}
        <TabsContent value="offers" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Offers & Schemes</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPdfUploading(true)}><FileText className="h-4 w-4 mr-1" /> AI Parse PDF</Button>
              <Button size="sm" onClick={() => { setEditingOffer(null); setNewOffer({ offer_type: "", bank_name: "", applicable_category: "", applicable_product: "", discount_amount: "", discount_description: "", start_date: "", end_date: "" }); setShowOfferDialog(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Offer
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete All Offers
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Delete All Offers?</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground">This will permanently delete all offers. Use before importing fresh offer data.</p>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="destructive" onClick={async () => {
                      const { error } = await supabase.from("apple_offers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
                      if (error) { toast.error(error.message); return; }
                      queryClient.invalidateQueries({ queryKey: ["apple-offers"] });
                      toast.success("All offers deleted");
                    }}>Delete All</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Offer Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={offerCategoryFilter} onValueChange={setOfferCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={offerStatusFilter} onValueChange={(v) => setOfferStatusFilter(v as any)}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filteredOffers.length} offer{filteredOffers.length !== 1 ? "s" : ""}</p>
          </div>

          {pdfUploading && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-medium">Paste offer PDF text content below for AI extraction:</p>
                <textarea
                  id="pdf-text-input"
                  className="w-full h-32 text-xs border border-border rounded-lg p-3 bg-background resize-y"
                  placeholder="Copy & paste all text from your Apple offers PDF here..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={async () => {
                    const text = (document.getElementById("pdf-text-input") as HTMLTextAreaElement)?.value;
                    if (!text || text.length < 20) { toast.error("Paste PDF text first"); return; }
                    toast.loading("AI is parsing offers...");
                    try {
                      const { data, error } = await supabase.functions.invoke("parse-offer-pdf", { body: { pdfText: text } });
                      toast.dismiss();
                      if (error) throw error;
                      if (data?.offers?.length) {
                        let inserted = 0;
                        for (const o of data.offers) {
                          const { error: ie } = await supabase.from("apple_offers").insert({
                            offer_type: o.offer_type || "other", bank_name: o.bank_name || null,
                            applicable_category: normalizeCategory(o.applicable_category || "All"),
                            applicable_product: o.applicable_product || null,
                            discount_amount: o.discount_amount || 0,
                            discount_description: o.discount_description || null,
                            start_date: o.start_date || null, end_date: o.end_date || null, status: "active",
                          });
                          if (!ie) inserted++;
                        }
                        queryClient.invalidateQueries({ queryKey: ["apple-offers"] });
                        toast.success(`Imported ${inserted} offers from PDF`);
                        setPdfUploading(false);
                      } else { toast.error("No offers found in text"); }
                    } catch (e: any) { toast.dismiss(); toast.error(e.message || "Parse failed"); }
                  }}>
                    <Upload className="h-4 w-4 mr-1" /> Parse & Import
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPdfUploading(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOffers.length === 0 ? (
              <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No offers found.</CardContent></Card>
            ) : filteredOffers.map((offer) => {
              const expired = offer.end_date && new Date(offer.end_date) < new Date();
              return (
                <Card key={offer.id} className={`hover:border-primary/30 transition-colors ${expired ? "opacity-60" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">{OFFER_TYPES[offer.offer_type] || offer.offer_type}</Badge>
                      <span className="text-lg font-bold text-green-600">{formatINR(offer.discount_amount)}</span>
                    </div>
                    <p className="font-medium text-sm">{offer.applicable_product || offer.applicable_category}</p>
                    <p className="text-xs text-muted-foreground mt-1">{offer.bank_name}</p>
                    {offer.discount_description && <p className="text-xs text-muted-foreground mt-1">{offer.discount_description}</p>}
                    {offer.start_date && <p className="text-[10px] text-muted-foreground mt-2">{offer.start_date} — {offer.end_date || "No end"}</p>}
                    {expired && <Badge variant="destructive" className="mt-2 text-[10px]">EXPIRED</Badge>}
                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditOffer(offer)}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => {
                        if (confirm("Delete this offer?")) deleteOfferMutation.mutate(offer.id);
                      }}>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* CALCULATOR TAB */}
        <TabsContent value="calculator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" /> Price Calculator</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Search & Select Product</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Type product name, part number, or category..." value={calcSearch} onChange={(e) => setCalcSearch(e.target.value)} className="pl-9" />
                  </div>
                  {calcSearch.trim() && calcSearchResults.length > 0 && (
                    <div className="mt-1 border rounded-lg max-h-[200px] overflow-y-auto bg-background shadow-sm">
                      {calcSearchResults.map((p) => (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex justify-between items-center ${calcProduct === p.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                          onClick={() => { setCalcProduct(p.id); setCalcSearch(p.description); setCalcSelectedOffers([]); setCalcCashDiscountEnabled(false); }}
                        >
                          <div>
                            <p className="font-medium">{p.description}</p>
                            <p className="text-xs text-muted-foreground">{p.part_number} · {p.category}</p>
                          </div>
                          <span className="font-mono text-sm">{formatINR(p.mrp)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {calcSearch.trim() && calcSearchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No products found</p>
                  )}
                </div>

                {calcProductData && (() => {
                  const rule = getRuleForProduct(calcProductData);
                  return (
                    <>
                      <div className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-sm">{calcProductData.description}</p>
                            <p className="text-xs text-muted-foreground">{calcProductData.part_number} · {calcProductData.category}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCalcProduct(""); setCalcSearch(""); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">MRP (incl GST)</p><p className="font-bold text-lg">{formatINR(calcProductData.mrp)}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">Base Price (ex {calcProductData.gst_percentage || 18}% GST)</p><p className="font-bold text-lg">{formatINR(getBasePrice(calcProductData))}</p></div>
                        <div className="p-3 rounded-lg bg-muted/50"><p className="text-muted-foreground text-xs">ALP Ex VAT</p><p className="font-bold text-lg">{formatINR(calcProductData.alp_ex_vat)}</p></div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <p className="text-xs text-muted-foreground">Base Discount on MRP ({rule?.discount_percentage || 0}%)</p>
                        <p className="font-semibold text-green-600">-{formatINR(calcBaseDiscount)}</p>
                      </div>

                      {getOffersForProduct(calcProductData).length > 0 && (
                        <div>
                          <Label className="text-xs">Select Offers to Apply</Label>
                          <div className="space-y-2 mt-1">
                            {getOffersForProduct(calcProductData).map((o) => (
                              <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-muted/30">
                                <input type="checkbox" checked={calcSelectedOffers.includes(o.id)}
                                  onChange={(e) => setCalcSelectedOffers(e.target.checked ? [...calcSelectedOffers, o.id] : calcSelectedOffers.filter((id) => id !== o.id))}
                                  className="rounded" />
                                <span className="flex-1">{OFFER_TYPES[o.offer_type] || o.offer_type} — {o.bank_name} — <strong>{formatINR(o.discount_amount)}</strong></span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {rule && (rule.cash_discount_value ?? 0) > 0 && (
                        <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <div>
                              <p className="text-xs font-medium">Apply Cash Discount</p>
                              <p className="text-[10px] text-muted-foreground">
                                {rule.cash_discount_value}{rule.cash_discount_mode === "percentage" ? "%" : " flat"} on{" "}
                                {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}
                              </p>
                            </div>
                            <Switch checked={calcCashDiscountEnabled} onCheckedChange={setCalcCashDiscountEnabled} />
                          </div>
                          {calcCashDiscountEnabled && (
                            <p className="font-semibold text-purple-600">-{formatINR(getCashDiscount(calcProductData))}</p>
                          )}
                          <p className="text-[9px] text-muted-foreground mt-1 italic flex items-center gap-1">
                            <Info className="h-2.5 w-2.5" /> Requires advance cash billing / payment
                          </p>
                        </div>
                      )}

                      <div><Label>Your Selling Price</Label>
                        <div className="relative"><IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input type="number" placeholder="Enter selling price" value={calcSellingPrice} onChange={(e) => setCalcSellingPrice(e.target.value)} className="pl-9" /></div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {calcProductData && (() => {
              const rule = getRuleForProduct(calcProductData);
              return (
                <Card>
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Calculation Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                      {[
                        { label: "MRP (incl GST)", value: formatINR(calcProductData.mrp) },
                        { label: `Base Price (ex ${calcProductData.gst_percentage || 18}% GST)`, value: formatINR(getBasePrice(calcProductData)), muted: true },
                        { label: `Base Discount (${rule?.discount_percentage || 0}% on MRP)`, value: `-${formatINR(calcBaseDiscount)}`, color: "text-green-600" },
                        { label: "Offer Discount", value: calcOfferDiscount > 0 ? `-${formatINR(calcOfferDiscount)}` : "—", color: "text-blue-600" },
                        { label: "Landing Cost", value: formatINR(calcLandingCost), bold: true, border: true },
                        ...(calcCashDiscountEnabled ? [{ label: `Cash Discount (${rule?.cash_discount_value || 0}% on Base Price ex GST)`, value: `-${formatINR(calcCashDiscount)}`, color: "text-purple-600" }] : []),
                        { label: "Final Cost", value: formatINR(calcFinalCost), bold: true, border: true },
                      ].map((row, i) => (
                        <div key={i} className={`flex justify-between text-sm ${row.border ? "border-t border-border pt-2" : ""} ${row.muted ? "text-muted-foreground" : ""}`}>
                          <span className={row.bold ? "font-bold" : ""}>{row.label}</span>
                          <span className={`font-mono ${row.bold ? "font-bold" : ""} ${row.color || ""}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>

                    {!calcCashDiscountEnabled && rule && (rule.cash_discount_value ?? 0) > 0 && (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex items-center gap-1.5">
                        <Info className="h-3 w-3" />
                        Cash discount available ({rule.cash_discount_value}% on Base Price) — enable toggle to apply
                      </div>
                    )}

                    {rule && (
                      <div className="p-3 rounded-lg border text-xs space-y-1">
                        <p className="font-semibold text-sm">Matched Rule</p>
                        <p><span className="text-muted-foreground">Category:</span> {rule.category}</p>
                        <p><span className="text-muted-foreground">Base Rule:</span> {rule.discount_percentage}% discount on MRP</p>
                        {(rule.cash_discount_value ?? 0) > 0 && (
                          <p><span className="text-muted-foreground">Cash Rule:</span> {rule.cash_discount_value}% on {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}</p>
                        )}
                      </div>
                    )}

                    {calcSP > 0 && (
                      <div className={`p-4 rounded-xl border-2 ${calcMargin > 0 ? "bg-green-500/5 border-green-500/20" : calcMargin < 0 ? "bg-red-500/5 border-red-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                        <div className="flex justify-between text-sm mb-2"><span>Selling Price</span><span className="font-mono">{formatINR(calcSP)}</span></div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">Margin</span>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${calcMargin > 0 ? "text-green-600" : calcMargin < 0 ? "text-red-600" : "text-amber-600"}`}>{formatINR(Math.abs(calcMargin))}</p>
                            <Badge className={calcMargin > 0 ? "bg-green-500/10 text-green-600" : calcMargin < 0 ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600"}>
                              {calcMarginPct.toFixed(1)}% {calcMargin > 0 ? "PROFIT" : calcMargin < 0 ? "LOSS" : "BREAK-EVEN"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </TabsContent>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Import Center</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Upload Apple Price List (.xlsx)</Label>
                <div className="mt-2 border-2 border-dashed rounded-xl p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Drag & drop or click to select an Excel file</p>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" id="import-file" />
                  <Button variant="outline" onClick={() => document.getElementById("import-file")?.click()}><Upload className="h-4 w-4 mr-1" /> Select File</Button>
                </div>
              </div>

              {importData.length > 0 && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Field Mapping</h3>
                      <Button variant="ghost" size="sm" onClick={() => { localStorage.setItem("apple_field_mapping", JSON.stringify(fieldMapping)); toast.success("Mapping saved"); }}>
                        Save Mapping
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {SYSTEM_FIELDS.map((sf) => (
                        <div key={sf}>
                          <Label className="text-xs">{SYSTEM_FIELD_LABELS[sf]}</Label>
                          <Select value={fieldMapping[sf] || ""} onValueChange={(v) => setFieldMapping({ ...fieldMapping, [sf]: v })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Select column" /></SelectTrigger>
                            <SelectContent>{importHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="h-3 w-3" /> Categories will be auto-normalized during import (e.g. IPHONE → iPhone)
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Preview (first 5 rows)</h3>
                    <div className="overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>{importHeaders.map((h) => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}</TableRow>
                        </TableHeader>
                        <TableBody>
                          {importData.slice(0, 5).map((row, i) => (
                            <TableRow key={i}>{importHeaders.map((_, j) => <TableCell key={j} className="text-xs">{String(row[j] ?? "")}</TableCell>)}</TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{importData.length} rows found</p>
                  </div>

                  <Button className="w-full" onClick={runImport}><Upload className="h-4 w-4 mr-1" /> Import {importData.length} Products</Button>
                </>
              )}

              {importHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Import History</h3>
                  <div className="space-y-2">
                    {importHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                        <span>{new Date(h.date).toLocaleString()}</span>
                        <Badge variant="outline">{h.count} products</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ADD PRODUCT DIALOG */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Part Number *</Label><Input value={newProduct.part_number} onChange={(e) => setNewProduct({ ...newProduct, part_number: e.target.value })} placeholder="e.g. MYE73HN/A" /></div>
            <div><Label>Description *</Label><Input value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="e.g. iPhone 16 Pro Max 256GB" /></div>
            <div>
              <Label>Category *</Label>
              <Select value={newProduct.category} onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>MRP *</Label><Input type="number" value={newProduct.mrp} onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })} /></div>
              <div><Label>ALP Ex VAT</Label><Input type="number" value={newProduct.alp_ex_vat} onChange={(e) => setNewProduct({ ...newProduct, alp_ex_vat: e.target.value })} /></div>
              <div><Label>GST %</Label><Input type="number" value={newProduct.gst_percentage} onChange={(e) => setNewProduct({ ...newProduct, gst_percentage: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={() => {
              if (!newProduct.part_number || !newProduct.description || !newProduct.category || !newProduct.mrp) { toast.error("Fill required fields"); return; }
              addProductMutation.mutate({
                part_number: newProduct.part_number, description: newProduct.description, category: newProduct.category,
                mrp: parseFloat(newProduct.mrp), alp_ex_vat: parseFloat(newProduct.alp_ex_vat) || 0, gst_percentage: parseFloat(newProduct.gst_percentage) || 18,
              });
            }}>Save Product</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD/EDIT OFFER DIALOG */}
      <Dialog open={showOfferDialog} onOpenChange={(open) => { setShowOfferDialog(open); if (!open) setEditingOffer(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingOffer ? "Edit Offer" : "Add Offer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Offer Type *</Label>
              <Select value={newOffer.offer_type} onValueChange={(v) => setNewOffer({ ...newOffer, offer_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{Object.entries(OFFER_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Bank Name</Label><Input value={newOffer.bank_name} onChange={(e) => setNewOffer({ ...newOffer, bank_name: e.target.value })} placeholder="e.g. HDFC Bank" /></div>
            <div>
              <Label>Applicable Category *</Label>
              <Select value={newOffer.applicable_category} onValueChange={(v) => setNewOffer({ ...newOffer, applicable_category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Applicable Product (optional keyword)</Label><Input value={newOffer.applicable_product} onChange={(e) => setNewOffer({ ...newOffer, applicable_product: e.target.value })} placeholder="e.g. iPhone 16 Pro" /></div>
            <div><Label>Discount Amount (₹) *</Label><Input type="number" value={newOffer.discount_amount} onChange={(e) => setNewOffer({ ...newOffer, discount_amount: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={newOffer.discount_description} onChange={(e) => setNewOffer({ ...newOffer, discount_description: e.target.value })} placeholder="e.g. 6/9 month EMI cashback" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Date</Label><Input type="date" value={newOffer.start_date} onChange={(e) => setNewOffer({ ...newOffer, start_date: e.target.value })} /></div>
              <div><Label>End Date</Label><Input type="date" value={newOffer.end_date} onChange={(e) => setNewOffer({ ...newOffer, end_date: e.target.value })} /></div>
            </div>
            <Button className="w-full" onClick={handleSaveOffer}>{editingOffer ? "Update Offer" : "Save Offer"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Fragment } from "react";
