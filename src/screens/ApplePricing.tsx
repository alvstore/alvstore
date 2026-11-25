"use client";

import { Box, Button, ButtonBase, Card, CardContent, Checkbox, FormLabel, IconButton, InputAdornment, MenuItem, Switch, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatusChip, TabBar, TabPanel, TabView, confirmAction, mergeSx, toast } from "@/components/mui";
import { useState, useMemo, useRef, useCallback, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { Package, Tag, Percent, TrendingUp, Gift, Search, Plus, Calculator, Download, ArrowUpDown, Star, X, IndianRupee, Layers, BarChart3, Upload, FileSpreadsheet, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Info, Trash2, FileText, Pencil } from "lucide-react";
type AppleProduct = {
    id: string;
    part_number: string;
    description: string;
    sap_description: string | null;
    category: string;
    subcategory: string | null;
    mrp: number;
    alp_ex_vat: number;
    gst_percentage: number;
    is_new: boolean;
    status: string;
    created_at: string;
};
type AppleOffer = {
    id: string;
    offer_type: string;
    bank_name: string | null;
    applicable_category: string;
    applicable_product: string | null;
    discount_amount: number;
    discount_description: string | null;
    start_date: string | null;
    end_date: string | null;
    status: string;
};
type PricingRule = {
    id: string;
    category: string;
    discount_percentage: number;
    discount_amount: number;
    rule_name: string | null;
    status: string;
    cash_discount_type: string | null;
    cash_discount_value: number | null;
    cash_discount_mode: string | null;
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
        if (lower.includes(c))
            return c.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
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
    const [importHistory, setImportHistory] = useState<Array<{
        date: string;
        count: number;
    }>>(() => {
        try {
            return JSON.parse(localStorage.getItem("apple_import_history") || "[]");
        }
        catch {
            return [];
        }
    });
    // Queries
    const { data: products = [], isLoading: loadingProducts } = useQuery({
        queryKey: ["apple-products"],
        queryFn: async () => {
            const { data, error } = await supabase.from("apple_products").select("*").eq("status", "active").order("category").order("mrp", { ascending: false });
            if (error)
                throw error;
            return data as AppleProduct[];
        },
    });
    const { data: offers = [] } = useQuery({
        queryKey: ["apple-offers"],
        queryFn: async () => {
            const { data, error } = await supabase.from("apple_offers").select("*");
            if (error)
                throw error;
            return data as AppleOffer[];
        },
    });
    const { data: rules = [] } = useQuery({
        queryKey: ["apple-pricing-rules"],
        queryFn: async () => {
            const { data, error } = await supabase.from("apple_pricing_rules").select("*").eq("status", "active");
            if (error)
                throw error;
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
            if (o.status !== "active")
                return false;
            if (o.end_date && new Date(o.end_date) < now)
                return false;
            return true;
        });
    }, [offers]);
    // Extract unique colors and storage values for filters
    const uniqueColors = useMemo(() => {
        const colors = new Set<string>();
        products.forEach(p => {
            const c = extractColor(p.description);
            if (c)
                colors.add(c);
        });
        return Array.from(colors).sort();
    }, [products]);
    const uniqueStorages = useMemo(() => {
        const storages = new Set<string>();
        products.forEach(p => {
            const s = extractStorage(p.description);
            if (s)
                storages.add(s);
        });
        return Array.from(storages).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (a.includes("TB") && !b.includes("TB"))
                return 1;
            if (!a.includes("TB") && b.includes("TB"))
                return -1;
            return numA - numB;
        });
    }, [products]);
    // Mutations
    const addRuleMutation = useMutation({
        mutationFn: async (rule: any) => {
            const { error } = await supabase.from("apple_pricing_rules").insert(rule);
            if (error)
                throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] }); toast.success("Rule added"); setShowRuleDialog(false); },
    });
    const deleteRuleMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from("apple_pricing_rules").update({ status: "inactive" }).eq("id", id);
            if (error)
                throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] }); toast.success("Rule removed"); },
    });
    const addProductMutation = useMutation({
        mutationFn: async (product: any) => {
            const { error } = await supabase.from("apple_products").upsert(product, { onConflict: "part_number" });
            if (error)
                throw error;
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["apple-products"] }); toast.success("Product added"); setShowProductDialog(false); setNewProduct({ part_number: "", description: "", category: "", mrp: "", alp_ex_vat: "", gst_percentage: "18" }); },
    });
    const saveOfferMutation = useMutation({
        mutationFn: async (offer: any) => {
            if (offer.id) {
                const { id, ...rest } = offer;
                const { error } = await supabase.from("apple_offers").update(rest).eq("id", id);
                if (error)
                    throw error;
            }
            else {
                const { error } = await supabase.from("apple_offers").insert(offer);
                if (error)
                    throw error;
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
            if (error)
                throw error;
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
        if (!rule)
            return 0;
        if (rule.discount_percentage > 0)
            return (product.mrp * rule.discount_percentage) / 100;
        return rule.discount_amount;
    };
    const getOffersForProduct = useCallback((product: AppleProduct) => {
        return activeOffersList.filter((o) => normCat(o.applicable_category) === normCat(product.category) &&
            (!o.applicable_product || product.description.toLowerCase().includes(o.applicable_product.toLowerCase())));
    }, [activeOffersList]);
    const getBestOfferDiscount = (product: AppleProduct) => {
        const pOffers = getOffersForProduct(product);
        if (pOffers.length === 0)
            return 0;
        return Math.max(...pOffers.map((o) => o.discount_amount));
    };
    const getLandingCost = (product: AppleProduct) => product.mrp - getBaseDiscount(product) - getBestOfferDiscount(product);
    const getCashDiscount = (product: AppleProduct) => {
        const rule = getRuleForProduct(product);
        if (!rule || !rule.cash_discount_value)
            return 0;
        let base = 0;
        if (rule.cash_discount_type === "on_base_price")
            base = getBasePrice(product);
        else if (rule.cash_discount_type === "on_mrp")
            base = product.mrp;
        else if (rule.cash_discount_type === "on_landing_cost")
            base = getLandingCost(product);
        if (rule.cash_discount_mode === "percentage")
            return (base * (rule.cash_discount_value || 0)) / 100;
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
            if (sortBy === "mrp")
                return b.mrp - a.mrp;
            if (sortBy === "margin")
                return getFinalCost(a) - getFinalCost(b);
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
    const bestMarginProduct = products.reduce((best, p) => { const m = ((p.mrp - getFinalCost(p)) / p.mrp) * 100; return m > best.margin ? { product: p, margin: m } : best; }, { product: null as AppleProduct | null, margin: 0 });
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
        if (!calcSearch.trim())
            return [];
        const q = calcSearch.toLowerCase();
        return products.filter((p) => p.description.toLowerCase().includes(q) ||
            p.part_number.toLowerCase().includes(q) ||
            normCat(p.category).includes(q)).slice(0, 10);
    }, [products, calcSearch]);
    // Excel import handlers
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target?.result, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
            if (data.length < 2) {
                toast.error("File has no data rows");
                return;
            }
            setImportHeaders(data[0].map(String));
            setImportData(data.slice(1).filter((row) => row.some(Boolean)));
            const autoMap: FieldMapping = {};
            const headers = data[0].map((h) => String(h).toLowerCase().trim());
            headers.forEach((h, i) => {
                const col = data[0][i] as string;
                if (h.includes("part") && h.includes("number"))
                    autoMap["part_number"] = col;
                else if (h.includes("description") && !h.includes("sap"))
                    autoMap["description"] = col;
                else if (h.includes("sap"))
                    autoMap["sap_description"] = col;
                else if (h === "category" || h.includes("category"))
                    autoMap["category"] = col;
                else if (h.includes("mrp") || h.includes("inc vat") || h.includes("alp inc"))
                    autoMap["mrp"] = col;
                else if (h.includes("ex vat") || h.includes("alp ex"))
                    autoMap["alp_ex_vat"] = col;
            });
            setFieldMapping(autoMap);
            const saved = localStorage.getItem("apple_field_mapping");
            if (saved) {
                try {
                    setFieldMapping(JSON.parse(saved));
                }
                catch { }
            }
        };
        reader.readAsBinaryString(file);
    };
    const runImport = async () => {
        if (!fieldMapping.part_number || !fieldMapping.description || !fieldMapping.mrp) {
            toast.error("Map at least Part Number, Description, and MRP");
            return;
        }
        const headerIdx: Record<string, number> = {};
        importHeaders.forEach((h, i) => (headerIdx[h] = i));
        const rows = importData.map((row) => {
            const obj: any = { status: "active", gst_percentage: 18 };
            Object.entries(fieldMapping).forEach(([sysField, excelCol]) => {
                const idx = headerIdx[excelCol];
                if (idx !== undefined && row[idx] !== undefined) {
                    const val = row[idx];
                    if (["mrp", "alp_ex_vat", "gst_percentage"].includes(sysField))
                        obj[sysField] = parseFloat(String(val)) || 0;
                    else
                        obj[sysField] = String(val).trim();
                }
            });
            if (obj.category)
                obj.category = normalizeCategory(obj.category);
            if (!obj.category)
                obj.category = "Uncategorized";
            return obj;
        }).filter((r) => r.part_number && r.description && r.mrp > 0);
        if (rows.length === 0) {
            toast.error("No valid rows to import");
            return;
        }
        let imported = 0;
        for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const { error } = await supabase.from("apple_products").upsert(chunk, { onConflict: "part_number" });
            if (error) {
                toast.error(`Import error: ${error.message}`);
                return;
            }
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
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "apple-pricing-export.csv";
        a.click();
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
        if (!newOffer.offer_type || !newOffer.applicable_category || !newOffer.discount_amount) {
            toast.error("Fill required fields");
            return;
        }
        const payload: any = {
            offer_type: newOffer.offer_type, bank_name: newOffer.bank_name || null, applicable_category: newOffer.applicable_category,
            applicable_product: newOffer.applicable_product || null, discount_amount: parseFloat(newOffer.discount_amount),
            discount_description: newOffer.discount_description || null, start_date: newOffer.start_date || null, end_date: newOffer.end_date || null,
        };
        if (editingOffer)
            payload.id = editingOffer.id;
        else
            payload.status = "active";
        saveOfferMutation.mutate(payload);
    };
    // Offer category filter for offers tab
    const [offerCategoryFilter, setOfferCategoryFilter] = useState("all");
    const [offerStatusFilter, setOfferStatusFilter] = useState<"all" | "active" | "expired">("all");
    const filteredOffers = useMemo(() => {
        const now = new Date();
        return offers.filter(o => {
            if (offerCategoryFilter !== "all" && normCat(o.applicable_category) !== normCat(offerCategoryFilter))
                return false;
            const expired = o.end_date && new Date(o.end_date) < now;
            if (offerStatusFilter === "active" && (expired || o.status !== "active"))
                return false;
            if (offerStatusFilter === "expired" && !expired)
                return false;
            return true;
        });
    }, [offers, offerCategoryFilter, offerStatusFilter]);
    const compareList: string[] = [];
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header with actions */}
      <PageHeader title={"Apple Pricing Engine"} subtitle={"Dynamic pricing, offers & margin calculator"} actions={<><Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Button onClick={() => fileInputRef.current?.click()} variant="outlined" size="small">
            <Box component={Upload} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Import Excel
          </Button>
          <Box ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} component="input" sx={{ display: "none" }}/>
          <Button onClick={() => setShowProductDialog(true)} variant="outlined" size="small">
            <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Add Product
          </Button>
          <Button onClick={() => { setEditingOffer(null); setNewOffer({ offer_type: "", bank_name: "", applicable_category: "", applicable_product: "", discount_amount: "", discount_description: "", start_date: "", end_date: "" }); setShowOfferDialog(true); }} variant="outlined" size="small">
            <Box component={Gift} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Add Offer
          </Button>
          <Button onClick={() => { queryClient.invalidateQueries(); toast.success("Recalculated"); }} variant="outlined" size="small">
            <Box component={RefreshCw} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Recalculate
          </Button>
          <Button onClick={exportCSV} variant="outlined" size="small">
            <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Export CSV
          </Button>
          <SideDrawer width={420} title={"Delete All Products?"} trigger={<Button variant="outlined" size="small" sx={{ color: "hsl(var(--destructive))", "&:hover": { color: "hsl(var(--destructive))" } }}>
                <Box component={Trash2} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Delete All
              </Button>}>

              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>This will permanently delete all Apple products. Use before importing a fresh price list.</Typography>
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                <Button onClick={async () => {
        const { error } = await supabase.from("apple_products").update({ status: "inactive" } as any).neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
            toast.error(error.message);
            return;
        }
        queryClient.invalidateQueries({ queryKey: ["apple-products"] });
        toast.success("All products marked inactive");
    }} variant="contained" color="error">Delete All</Button>
              </Box>
            </SideDrawer>
        </Box></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }, gap: "1rem" }}>
        {[
            { icon: Package, color: { color: "hsl(var(--primary))" }, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" }, value: totalProducts, label: "Products" },
            { icon: Gift, color: { color: "rgb(34 197 94 / 1)" }, bg: { backgroundColor: "rgb(34 197 94 / 0.1)" }, value: totalActiveOffers, label: "Active Offers" },
            { icon: Percent, color: { color: "rgb(59 130 246 / 1)" }, bg: { backgroundColor: "rgb(59 130 246 / 0.1)" }, value: `${avgDiscPct.toFixed(1)}%`, label: "Avg Discount" },
            { icon: Star, color: { color: "rgb(245 158 11 / 1)" }, bg: { backgroundColor: "rgb(245 158 11 / 0.1)" }, value: bestMarginProduct.product?.description?.split(" ").slice(0, 3).join(" ") || "—", label: "Best Discount", small: true },
            { icon: Tag, color: { color: "rgb(168 85 247 / 1)" }, bg: { backgroundColor: "rgb(168 85 247 / 0.1)" }, value: productsWithOffers, label: "With Offers" },
        ].map((kpi, i) => (<Card key={i}>
            <CardContent sx={{ padding: "1rem" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem" }, kpi.bg, { display: "flex", alignItems: "center", justifyContent: "center" })}>
                  <Box component={kpi.icon} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, kpi.color)}/>
                </Box>
                <Box>
                  <Typography component="p" variant="body1" sx={mergeSx({ fontWeight: "700" }, kpi.small ? { fontSize: "0.875rem", lineHeight: "1.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : { fontSize: "1.5rem", lineHeight: "2rem" })}>{kpi.value}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{kpi.label}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>))}
      </Box>

      <TabView defaultValue="catalog" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
        <TabBar sx={{ flexWrap: "wrap" }}>
          <Tab value="catalog" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Layers} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Catalog</Box>}/>
          <Tab value="rules" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Percent} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Pricing Rules</Box>}/>
          <Tab value="offers" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Gift} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Offers</Box>}/>
          <Tab value="calculator" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Calculator} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Calculator</Box>}/>
          <Tab value="import" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={FileSpreadsheet} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Import</Box>}/>
        </TabBar>

        {/* CATALOG TAB */}
        <TabPanel value="catalog" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card>
            <CardContent sx={{ padding: "1rem" }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
                <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search product, part number, or category..." sx={{ flex: "1 1 0%", minWidth: "200px" }}/>
                <TextField value={categoryFilter} select size="small" fullWidth onChange={event => setCategoryFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "140px" }}><MenuItem value="" disabled>{"Category"}</MenuItem>
                    <MenuItem value="all">All Categories</MenuItem>
                    {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                {uniqueColors.length > 0 && (<TextField value={colorFilter} select size="small" fullWidth onChange={event => setColorFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "130px" }}><MenuItem value="" disabled>{"Color"}</MenuItem>
                      <MenuItem value="all">All Colors</MenuItem>
                      {uniqueColors.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>)}
                {uniqueStorages.length > 0 && (<TextField value={storageFilter} select size="small" fullWidth onChange={event => setStorageFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "120px" }}><MenuItem value="" disabled>{"Storage"}</MenuItem>
                      <MenuItem value="all">All Storage</MenuItem>
                      {uniqueStorages.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>)}
                <Button onClick={() => setOfferFilter(!offerFilter)} variant={offerFilter ? "contained" : "outlined"} size="small">
                  <Box component={Gift} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Offers Only
                </Button>
                <TextField value={sortBy} select size="small" fullWidth onChange={event => ((v) => setSortBy(v as typeof sortBy))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "140px" }}>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="mrp">Price ↓</MenuItem>
                    <MenuItem value="margin">Best Margin</MenuItem>
                  </TextField>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ padding: "0px" }}>
              <Box sx={{ overflow: "auto", maxHeight: "60vh" }}>
                <DataTable columnsCount={9} loading={loadingProducts} empty={filtered.length === 0} emptyMessage={"No products found. Import data to get started."}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Part Number</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>MRP</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Base Disc.</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Offer Disc.</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Landing Cost</TableCell>
                      <TableCell>Offers</TableCell>
                      <TableCell sx={{ width: "2rem" }}/>
                    </TableRow>
                  </TableHead>
                  <TableBody>{(filtered.slice(0, 100).map((p) => {
        const rule = getRuleForProduct(p);
        const baseDisc = getBaseDiscount(p);
        const offerDisc = getBestOfferDiscount(p);
        const landingCost = getLandingCost(p);
        const cashDisc = getCashDiscount(p);
        const pOffers = getOffersForProduct(p);
        const isExpanded = expandedRow === p.id;
        return (<Fragment key={p.id}>
                            <TableRow onClick={() => setExpandedRow(isExpanded ? null : p.id)} data-ui-group sx={{ cursor: "pointer" }}>
                              <TableCell>
                                <Box component="span" sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{p.description}</Box>
                                {p.is_new && <StatusChip label={"NEW"} variant="filled" sx={{ marginLeft: "0.5rem", fontSize: "10px", backgroundColor: "rgb(34 197 94 / 0.1)", color: "rgb(22 163 74 / 1)" }}/>}
                              </TableCell>
                              <TableCell><Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{p.part_number}</Box></TableCell>
                              <TableCell><StatusChip label={p.category} variant="outlined" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/></TableCell>
                              <TableCell sx={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{formatINR(p.mrp)}</TableCell>
                              <TableCell sx={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{baseDisc > 0 ? <Box component="span" sx={{ color: "rgb(22 163 74 / 1)" }}>-{formatINR(baseDisc)}</Box> : "—"}</TableCell>
                              <TableCell sx={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{offerDisc > 0 ? <Box component="span" sx={{ color: "rgb(37 99 235 / 1)" }}>-{formatINR(offerDisc)}</Box> : "—"}</TableCell>
                              <TableCell sx={{ textAlign: "right", fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{formatINR(landingCost)}</TableCell>
                              <TableCell>
                                {pOffers.length > 0 ? (<StatusChip label={<>{pOffers.length} offer{pOffers.length > 1 ? "s" : ""}</>} sx={{ backgroundColor: "rgb(34 197 94 / 0.1)", color: "rgb(22 163 74 / 1)", borderColor: "rgb(34 197 94 / 0.2)", fontSize: "10px" }}/>) : <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>—</Box>}
                              </TableCell>
                              <TableCell>{isExpanded ? <Box component={ChevronUp} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={ChevronDown} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>}</TableCell>
                            </TableRow>
                            {isExpanded && (<TableRow>
                                <TableCell colSpan={9} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", padding: "1rem" }}>
                                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }, gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                                    {[
                    { label: "MRP (incl GST)", value: formatINR(p.mrp) },
                    { label: `Base Price (ex ${p.gst_percentage || 18}% GST)`, value: formatINR(getBasePrice(p)) },
                    { label: `Base Discount (${rule?.discount_percentage || 0}% on MRP)`, value: baseDisc > 0 ? `-${formatINR(baseDisc)}` : "—", color: { color: "rgb(22 163 74 / 1)" } },
                    { label: "Best Offer Discount", value: offerDisc > 0 ? `-${formatINR(offerDisc)}` : "—", color: { color: "rgb(37 99 235 / 1)" } },
                    { label: "Landing Cost", value: formatINR(landingCost), bold: true },
                    { label: `Cash Disc. (${rule?.cash_discount_value || 0}% on Base Price)`, value: cashDisc > 0 ? `-${formatINR(cashDisc)}` : "—", color: { color: "rgb(147 51 234 / 1)" }, note: "Optional — advance payment" },
                    { label: "Final Cost (with cash disc.)", value: cashDisc > 0 ? formatINR(landingCost - cashDisc) : "—", bold: true, note: "If advance paid" },
                ].map((item, i) => (<Box key={i} sx={{ padding: "0.5rem", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--background))", borderWidth: "1px" }}>
                                        <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{item.label}</Typography>
                                        <Typography component="p" variant="body1" sx={mergeSx({ fontFamily: "JetBrains Mono, monospace" }, item.bold ? { fontWeight: "700" } : {}, item.color || {})}>{item.value}</Typography>
                                        {item.note && <Typography component="p" variant="body1" sx={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", fontStyle: "italic", marginTop: "0.125rem" }}>{item.note}</Typography>}
                                      </Box>))}
                                  </Box>
                                  {pOffers.length > 0 && (<Box sx={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                      {pOffers.map(o => (<StatusChip key={o.id} label={<>
                                          {OFFER_TYPES[o.offer_type] || o.offer_type} — {o.bank_name} — {formatINR(o.discount_amount)}
                                        </>} variant="outlined" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>))}
                                    </Box>)}
                                  {rule && (<Box sx={{ marginTop: "0.75rem", padding: "0.5rem", borderRadius: "0.25rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <Box component={Info} sx={{ height: "0.75rem", width: "0.75rem" }}/>
                                      <Box component="span">Matched Rule: <Box component="strong">{rule.rule_name || rule.category}</Box> — {rule.discount_percentage}% base discount
                                        {(rule.cash_discount_value ?? 0) > 0 && ` + ${rule.cash_discount_value}% cash discount on ${rule.cash_discount_type === "on_base_price" ? "Base Price" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}`}
                                      </Box>
                                    </Box>)}
                                  {!rule && (<Box sx={{ marginTop: "0.75rem", padding: "0.5rem", borderRadius: "0.25rem", backgroundColor: "rgb(245 158 11 / 0.1)", fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(180 83 9 / 1)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <Box component={AlertTriangle} sx={{ height: "0.75rem", width: "0.75rem" }}/>
                                      <Box component="span">No pricing rule found for category "{p.category}". Add a rule to enable discounts.</Box>
                                    </Box>)}
                                </TableCell>
                              </TableRow>)}
                          </Fragment>);
    }))}</TableBody>
                </DataTable>
              </Box>
              {filtered.length > 100 && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "center", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>Showing 100 of {filtered.length} products</Typography>}
            </CardContent>
          </Card>
        </TabPanel>

        {/* PRICING RULES TAB */}
        <TabPanel value="rules" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography component="h2" variant="h2" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600" }}>Category-wise Pricing Rules</Typography>
            <SideDrawer
              open={showRuleDialog}
              onClose={() => setShowRuleDialog(false)}
              onOpen={() => setShowRuleDialog(true)}
              title={"Add Pricing Rule"}
              width={480}
              trigger={<Button variant="contained" size="small"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Add Rule</Button>}
              footer={
                <>
                  <Button variant="outlined" onClick={() => setShowRuleDialog(false)} sx={{ minHeight: 36 }}>Cancel</Button>
                  <Button onClick={() => {
        if (!newRule.category || !newRule.discount_percentage) {
            toast.error("Fill required fields");
            return;
        }
        addRuleMutation.mutate({
            category: newRule.category, discount_percentage: parseFloat(newRule.discount_percentage), rule_name: newRule.rule_name,
            cash_discount_type: newRule.cash_discount_type, cash_discount_value: parseFloat(newRule.cash_discount_value) || 0, cash_discount_mode: newRule.cash_discount_mode,
        });
    }} variant="contained" sx={{ minHeight: 36 }}>Save Rule</Button>
                </>
              }
            >

                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  <Box>

                    <TextField value={newRule.category} label={"Category"} select size="small" fullWidth onChange={event => ((v) => setNewRule({ ...newRule, category: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select category"}</MenuItem>{CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
                  </Box>
                  <Box><TextField type="number" placeholder="e.g. 5.5" value={newRule.discount_percentage} onChange={(e) => setNewRule({ ...newRule, discount_percentage: e.target.value })} label={"Base Discount % (on MRP incl GST)"} size="small" fullWidth/></Box>
                  <Box><TextField placeholder="e.g. Standard iPhone Discount" value={newRule.rule_name} onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })} label={"Rule Name"} size="small" fullWidth/></Box>
                  <Box sx={{ borderTopWidth: "1px", paddingTop: "1rem" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", marginBottom: "0.25rem" }}>Cash Discount (Optional — advance payment)</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.75rem" }}>Only applied when customer opts for advance cash billing</Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
                      <Box>

                        <TextField value={newRule.cash_discount_type} label={"Applied On"} select size="small" fullWidth onChange={event => ((v) => setNewRule({ ...newRule, cash_discount_type: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                            <MenuItem value="on_base_price">Base Price (ex GST)</MenuItem>
                            <MenuItem value="on_mrp">MRP</MenuItem>
                            <MenuItem value="on_landing_cost">Landing Cost</MenuItem>
                          </TextField>
                      </Box>
                      <Box>

                        <TextField value={newRule.cash_discount_mode} label={"Mode"} select size="small" fullWidth onChange={event => ((v) => setNewRule({ ...newRule, cash_discount_mode: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                            <MenuItem value="percentage">Percentage</MenuItem>
                            <MenuItem value="fixed">Fixed Amount</MenuItem>
                          </TextField>
                      </Box>
                    </Box>
                    <Box sx={{ marginTop: "0.5rem" }}><TextField type="number" placeholder="e.g. 0.5" value={newRule.cash_discount_value} onChange={(e) => setNewRule({ ...newRule, cash_discount_value: e.target.value })} label={"Value"} size="small" fullWidth/></Box>
                  </Box>
                </Box>
              </SideDrawer>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
            {rules.length === 0 ? (<Card sx={{ gridColumn: "1 / -1" }}><CardContent sx={{ padding: "2rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>No pricing rules configured.</CardContent></Card>) : rules.map((rule) => (<Card key={rule.id}>
                <CardContent sx={{ padding: "1rem" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <StatusChip label={rule.category} variant="outlined"/>
                    <IconButton onClick={() => deleteRuleMutation.mutate(rule.id)} aria-label={"X"} sx={{ height: "1.5rem", width: "1.5rem" }}><Box component={X} sx={{ height: "0.75rem", width: "0.75rem" }}/></IconButton>
                  </Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "rgb(22 163 74 / 1)" }}>{rule.discount_percentage}%</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{rule.rule_name || "Base discount on MRP (incl GST)"}</Typography>
                  {(rule.cash_discount_value ?? 0) > 0 && (<Box sx={{ marginTop: "0.5rem", padding: "0.5rem", borderRadius: "0.25rem", backgroundColor: "rgb(168 85 247 / 0.05)", borderWidth: "1px", borderColor: "rgb(168 85 247 / 0.1)" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(147 51 234 / 1)" }}>
                        Cash: {rule.cash_discount_value}{rule.cash_discount_mode === "percentage" ? "%" : " flat"} on{" "}
                        {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}
                      </Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>Optional — requires advance payment</Typography>
                    </Box>)}
                </CardContent>
              </Card>))}
          </Box>
        </TabPanel>

        {/* OFFERS TAB */}
        <TabPanel value="offers" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <Typography component="h2" variant="h2" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600" }}>Offers & Schemes</Typography>
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <Button onClick={() => setPdfUploading(true)} variant="outlined" size="small"><Box component={FileText} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> AI Parse PDF</Button>
              <Button onClick={() => { setEditingOffer(null); setNewOffer({ offer_type: "", bank_name: "", applicable_category: "", applicable_product: "", discount_amount: "", discount_description: "", start_date: "", end_date: "" }); setShowOfferDialog(true); }} variant="contained" size="small">
                <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Add Offer
              </Button>
              <SideDrawer width={420} title={"Delete All Offers?"} trigger={<Button variant="outlined" size="small" sx={{ color: "hsl(var(--destructive))", "&:hover": { color: "hsl(var(--destructive))" } }}>
                    <Box component={Trash2} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Delete All Offers
                  </Button>}>

                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>This will permanently delete all offers. Use before importing fresh offer data.</Typography>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
                    <Button onClick={async () => {
        const { error } = await supabase.from("apple_offers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) {
            toast.error(error.message);
            return;
        }
        queryClient.invalidateQueries({ queryKey: ["apple-offers"] });
        toast.success("All offers deleted");
    }} variant="contained" color="error">Delete All</Button>
                  </Box>
                </SideDrawer>
            </Box>
          </Box>

          {/* Offer Filters */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
            <TextField value={offerCategoryFilter} select size="small" fullWidth onChange={event => setOfferCategoryFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "160px" }}><MenuItem value="" disabled>{"Category"}</MenuItem>
                <MenuItem value="all">All Categories</MenuItem>
                {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            <TextField value={offerStatusFilter} select size="small" fullWidth onChange={event => ((v) => setOfferStatusFilter(v as any))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "130px" }}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </TextField>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{filteredOffers.length} offer{filteredOffers.length !== 1 ? "s" : ""}</Typography>
          </Box>

          {pdfUploading && (<Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)" }}>
              <CardContent sx={{ padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>Paste offer PDF text content below for AI extraction:</Typography>
                <TextField id="pdf-text-input" label="Offer PDF text" placeholder="Copy & paste all text from your Apple offers PDF here..." multiline minRows={5} fullWidth sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                <Box sx={{ display: "flex", gap: "0.5rem" }}>
                  <Button onClick={async () => {
            const text = (document.getElementById("pdf-text-input") as HTMLTextAreaElement)?.value;
            if (!text || text.length < 20) {
                toast.error("Paste PDF text first");
                return;
            }
            toast.loading("AI is parsing offers...");
            try {
                const { data, error } = await supabase.functions.invoke("parse-offer-pdf", { body: { pdfText: text } });
                toast.dismiss();
                if (error)
                    throw error;
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
                        if (!ie)
                            inserted++;
                    }
                    queryClient.invalidateQueries({ queryKey: ["apple-offers"] });
                    toast.success(`Imported ${inserted} offers from PDF`);
                    setPdfUploading(false);
                }
                else {
                    toast.error("No offers found in text");
                }
            }
            catch (e: any) {
                toast.dismiss();
                toast.error(e.message || "Parse failed");
            }
        }} variant="contained" size="small">
                    <Box component={Upload} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Parse & Import
                  </Button>
                  <Button onClick={() => setPdfUploading(false)} variant="text" size="small">Cancel</Button>
                </Box>
              </CardContent>
            </Card>)}

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
            {filteredOffers.length === 0 ? (<Card sx={{ gridColumn: "1 / -1" }}><CardContent sx={{ padding: "2rem", textAlign: "center", color: "hsl(var(--muted-foreground))" }}>No offers found.</CardContent></Card>) : filteredOffers.map((offer) => {
            const expired = offer.end_date && new Date(offer.end_date) < new Date();
            return (<Card key={offer.id} sx={mergeSx({ "&:hover": { borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, expired ? { opacity: "0.6" } : {})}>
                  <CardContent sx={{ padding: "1rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <StatusChip label={OFFER_TYPES[offer.offer_type] || offer.offer_type} sx={{ backgroundColor: "rgb(59 130 246 / 0.1)", color: "rgb(37 99 235 / 1)", borderColor: "rgb(59 130 246 / 0.2)" }}/>
                      <Box component="span" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "rgb(22 163 74 / 1)" }}>{formatINR(offer.discount_amount)}</Box>
                    </Box>
                    <Typography component="p" variant="body1" sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{offer.applicable_product || offer.applicable_category}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{offer.bank_name}</Typography>
                    {offer.discount_description && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{offer.discount_description}</Typography>}
                    {offer.start_date && <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.5rem" }}>{offer.start_date} — {offer.end_date || "No end"}</Typography>}
                    {expired && <StatusChip label={"EXPIRED"} variant="filled" sx={{ marginTop: "0.5rem", fontSize: "10px" }}/>}
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTopWidth: "1px", borderColor: "hsl(var(--border))" }}>
                      <Button onClick={() => openEditOffer(offer)} variant="text" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                        <Box component={Pencil} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Edit
                      </Button>
                      <Button onClick={async () => {
                if (await confirmAction("Delete this offer?"))
                    deleteOfferMutation.mutate(offer.id);
            }} variant="text" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--destructive))", "&:hover": { color: "hsl(var(--destructive))" } }}>
                        <Box component={Trash2} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Delete
                      </Button>
                    </Box>
                  </CardContent>
                </Card>);
        })}
          </Box>
        </TabPanel>

        {/* CALCULATOR TAB */}
        <TabPanel value="calculator" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1.5rem" }}>
            <Card>
              <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1.125rem", lineHeight: "1.75rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Calculator} sx={{ height: "1.25rem", width: "1.25rem" }}/> Price Calculator</Typography></Box>
              <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                <Box>
                  <FormLabel>Search & Select Product</FormLabel>
                  <TextField
                    placeholder="Type product name, part number, or category..."
                    value={calcSearch}
                    onChange={(e) => setCalcSearch(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{
                      htmlInput: { "aria-label": "Type product name, part number, or category..." },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <Box component={Search} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  {calcSearch.trim() && calcSearchResults.length > 0 && (<Box sx={{ marginTop: "0.25rem", borderWidth: "1px", borderRadius: "var(--radius)", maxHeight: "200px", overflowY: "auto", backgroundColor: "hsl(var(--background))", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
                      {calcSearchResults.map((p) => (<ButtonBase key={p.id} onClick={() => { setCalcProduct(p.id); setCalcSearch(p.description); setCalcSelectedOffers([]); setCalcCashDiscountEnabled(false); }} type="button" sx={mergeSx({ width: "100%", textAlign: "left", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", display: "flex", justifyContent: "space-between", alignItems: "center" }, calcProduct === p.id ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)", borderLeftWidth: "2px", borderColor: "hsl(var(--primary))" } : {})}>
                          <Box>
                            <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{p.description}</Typography>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{p.part_number} · {p.category}</Typography>
                          </Box>
                          <Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{formatINR(p.mrp)}</Box>
                        </ButtonBase>))}
                    </Box>)}
                  {calcSearch.trim() && calcSearchResults.length === 0 && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>No products found</Typography>)}
                </Box>

                {calcProductData && (() => {
            const rule = getRuleForProduct(calcProductData);
            return (<>
                      <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <Box>
                            <Typography component="p" variant="body1" sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{calcProductData.description}</Typography>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{calcProductData.part_number} · {calcProductData.category}</Typography>
                          </Box>
                          <IconButton onClick={() => { setCalcProduct(""); setCalcSearch(""); }} aria-label={"X"} sx={{ height: "1.5rem", width: "1.5rem" }}>
                            <Box component={X} sx={{ height: "0.75rem", width: "0.75rem" }}/>
                          </IconButton>
                        </Box>
                      </Box>

                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                        <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>MRP (incl GST)</Typography><Typography component="p" variant="body1" sx={{ fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>{formatINR(calcProductData.mrp)}</Typography></Box>
                        <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>Base Price (ex {calcProductData.gst_percentage || 18}% GST)</Typography><Typography component="p" variant="body1" sx={{ fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>{formatINR(getBasePrice(calcProductData))}</Typography></Box>
                        <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>ALP Ex VAT</Typography><Typography component="p" variant="body1" sx={{ fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>{formatINR(calcProductData.alp_ex_vat)}</Typography></Box>
                      </Box>

                      <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "rgb(34 197 94 / 0.05)", borderWidth: "1px", borderColor: "rgb(34 197 94 / 0.1)" }}>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Base Discount on MRP ({rule?.discount_percentage || 0}%)</Typography>
                        <Typography component="p" variant="body1" sx={{ fontWeight: "600", color: "rgb(22 163 74 / 1)" }}>-{formatINR(calcBaseDiscount)}</Typography>
                      </Box>

                      {getOffersForProduct(calcProductData).length > 0 && (<Box>
                          <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>Select Offers to Apply</FormLabel>
                          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, marginTop: "0.25rem" }}>
                            {getOffersForProduct(calcProductData).map((o) => (<Box key={o.id} component="label" sx={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", cursor: "pointer", padding: "0.5rem", borderRadius: "var(--radius)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" } }}>
                                <Checkbox checked={calcSelectedOffers.includes(o.id)} onChange={(e) => setCalcSelectedOffers(e.target.checked ? [...calcSelectedOffers, o.id] : calcSelectedOffers.filter((id) => id !== o.id))} sx={{ borderRadius: "0.25rem" }}/>
                                <Box component="span" sx={{ flex: "1 1 0%" }}>{OFFER_TYPES[o.offer_type] || o.offer_type} — {o.bank_name} — <Box component="strong">{formatINR(o.discount_amount)}</Box></Box>
                              </Box>))}
                          </Box>
                        </Box>)}

                      {rule && (rule.cash_discount_value ?? 0) > 0 && (<Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "rgb(168 85 247 / 0.05)", borderWidth: "1px", borderColor: "rgb(168 85 247 / 0.1)" }}>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                            <Box>
                              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }}>Apply Cash Discount</Typography>
                              <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
                                {rule.cash_discount_value}{rule.cash_discount_mode === "percentage" ? "%" : " flat"} on{" "}
                                {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}
                              </Typography>
                            </Box>
                            <Switch checked={calcCashDiscountEnabled} onChange={(event, checked) => setCalcCashDiscountEnabled(checked)}/>
                          </Box>
                          {calcCashDiscountEnabled && (<Typography component="p" variant="body1" sx={{ fontWeight: "600", color: "rgb(147 51 234 / 1)" }}>-{formatINR(getCashDiscount(calcProductData))}</Typography>)}
                          <Typography component="p" variant="body1" sx={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem", fontStyle: "italic", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Box component={Info} sx={{ height: "0.625rem", width: "0.625rem" }}/> Requires advance cash billing / payment
                          </Typography>
                        </Box>)}

                      <Box><FormLabel>Your Selling Price</FormLabel>
                        <TextField
                          type="number"
                          placeholder="Enter selling price"
                          value={calcSellingPrice}
                          onChange={(e) => setCalcSellingPrice(e.target.value)}
                          size="small"
                          fullWidth
                          slotProps={{
                            htmlInput: { "aria-label": "Enter selling price" },
                            input: {
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Box component={IndianRupee} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
                                </InputAdornment>
                              ),
                            },
                          }}
                        />
                      </Box>
                    </>);
        })()}
              </CardContent>
            </Card>

            {calcProductData && (() => {
            const rule = getRuleForProduct(calcProductData);
            return (<Card>
                  <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1.125rem", lineHeight: "1.75rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={TrendingUp} sx={{ height: "1.25rem", width: "1.25rem" }}/> Calculation Breakdown</Typography></Box>
                  <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                    <Box sx={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                      {[
                    { label: "MRP (incl GST)", value: formatINR(calcProductData.mrp) },
                    { label: `Base Price (ex ${calcProductData.gst_percentage || 18}% GST)`, value: formatINR(getBasePrice(calcProductData)), muted: true },
                    { label: `Base Discount (${rule?.discount_percentage || 0}% on MRP)`, value: `-${formatINR(calcBaseDiscount)}`, color: { color: "rgb(22 163 74 / 1)" } },
                    { label: "Offer Discount", value: calcOfferDiscount > 0 ? `-${formatINR(calcOfferDiscount)}` : "—", color: { color: "rgb(37 99 235 / 1)" } },
                    { label: "Landing Cost", value: formatINR(calcLandingCost), bold: true, border: true },
                    ...(calcCashDiscountEnabled ? [{ label: `Cash Discount (${rule?.cash_discount_value || 0}% on Base Price ex GST)`, value: `-${formatINR(calcCashDiscount)}`, color: { color: "rgb(147 51 234 / 1)" } }] : []),
                    { label: "Final Cost", value: formatINR(calcFinalCost), bold: true, border: true },
                ].map((row, i) => (<Box key={i} sx={mergeSx({ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }, row.border ? { borderTopWidth: "1px", borderColor: "hsl(var(--border))", paddingTop: "0.5rem" } : {}, row.muted ? { color: "hsl(var(--muted-foreground))" } : {})}>
                          <Box component="span" sx={row.bold ? { fontWeight: "700" } : {}}>{row.label}</Box>
                          <Box component="span" sx={mergeSx({ fontFamily: "JetBrains Mono, monospace" }, row.bold ? { fontWeight: "700" } : {}, row.color || {})}>{row.value}</Box>
                        </Box>))}
                    </Box>

                    {!calcCashDiscountEnabled && rule && (rule.cash_discount_value ?? 0) > 0 && (<Box sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", padding: "0.5rem", borderRadius: "0.25rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Box component={Info} sx={{ height: "0.75rem", width: "0.75rem" }}/>
                        Cash discount available ({rule.cash_discount_value}% on Base Price) — enable toggle to apply
                      </Box>)}

                    {rule && (<Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", borderWidth: "1px", fontSize: "0.75rem", lineHeight: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                        <Typography component="p" variant="body1" sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem" }}>Matched Rule</Typography>
                        <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Category:</Box> {rule.category}</Typography>
                        <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Base Rule:</Box> {rule.discount_percentage}% discount on MRP</Typography>
                        {(rule.cash_discount_value ?? 0) > 0 && (<Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Cash Rule:</Box> {rule.cash_discount_value}% on {rule.cash_discount_type === "on_base_price" ? "Base Price (ex GST)" : rule.cash_discount_type === "on_mrp" ? "MRP" : "Landing Cost"}</Typography>)}
                      </Box>)}

                    {calcSP > 0 && (<Box sx={mergeSx({ padding: "1rem", borderRadius: "0.75rem", borderWidth: "2px" }, calcMargin > 0 ? { backgroundColor: "rgb(34 197 94 / 0.05)", borderColor: "rgb(34 197 94 / 0.2)" } : calcMargin < 0 ? { backgroundColor: "rgb(239 68 68 / 0.05)", borderColor: "rgb(239 68 68 / 0.2)" } : { backgroundColor: "rgb(245 158 11 / 0.05)", borderColor: "rgb(245 158 11 / 0.2)" })}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem", marginBottom: "0.5rem" }}><Box component="span">Selling Price</Box><Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace" }}>{formatINR(calcSP)}</Box></Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Box component="span" sx={{ fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>Margin</Box>
                          <Box sx={{ textAlign: "right" }}>
                            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700" }, calcMargin > 0 ? { color: "rgb(22 163 74 / 1)" } : calcMargin < 0 ? { color: "rgb(220 38 38 / 1)" } : { color: "rgb(217 119 6 / 1)" })}>{formatINR(Math.abs(calcMargin))}</Typography>
                            <StatusChip label={<>
                              {calcMarginPct.toFixed(1)}% {calcMargin > 0 ? "PROFIT" : calcMargin < 0 ? "LOSS" : "BREAK-EVEN"}
                            </>} sx={calcMargin > 0 ? { backgroundColor: "rgb(34 197 94 / 0.1)", color: "rgb(22 163 74 / 1)" } : calcMargin < 0 ? { backgroundColor: "rgb(239 68 68 / 0.1)", color: "rgb(220 38 38 / 1)" } : { backgroundColor: "rgb(245 158 11 / 0.1)", color: "rgb(217 119 6 / 1)" }}/>
                          </Box>
                        </Box>
                      </Box>)}
                  </CardContent>
                </Card>);
        })()}
          </Box>
        </TabPanel>

        {/* IMPORT TAB */}
        <TabPanel value="import" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1.125rem", lineHeight: "1.75rem" })}>Import Center</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              <Box>
                <FormLabel>Upload Apple Price List (.xlsx)</FormLabel>
                <Box sx={{ marginTop: "0.5rem", borderWidth: "2px", borderStyle: "dashed", borderRadius: "0.75rem", padding: "2rem", textAlign: "center" }}>
                  <Box component={FileSpreadsheet} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", color: "hsl(var(--muted-foreground))", marginBottom: "0.75rem" }}/>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.75rem" }}>Drag & drop or click to select an Excel file</Typography>
                  <Box type="file" accept=".xlsx,.xls" onChange={handleFileUpload} id="import-file" component="input" sx={{ display: "none" }}/>
                  <Button onClick={() => document.getElementById("import-file")?.click()} variant="outlined"><Box component={Upload} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Select File</Button>
                </Box>
              </Box>

              {importData.length > 0 && (<>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <Typography component="h3" variant="h3" sx={{ fontWeight: "600" }}>Field Mapping</Typography>
                      <Button onClick={() => { localStorage.setItem("apple_field_mapping", JSON.stringify(fieldMapping)); toast.success("Mapping saved"); }} variant="text" size="small">
                        Save Mapping
                      </Button>
                    </Box>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
                      {SYSTEM_FIELDS.map((sf) => (<Box key={sf}>

                          <TextField value={fieldMapping[sf] || ""} label={SYSTEM_FIELD_LABELS[sf]} select size="small" fullWidth onChange={event => ((v) => setFieldMapping({ ...fieldMapping, [sf]: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select column"}</MenuItem>{importHeaders.map((h) => <MenuItem key={h} value={h}>{h}</MenuItem>)}</TextField>
                        </Box>))}
                    </Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Box component={Info} sx={{ height: "0.75rem", width: "0.75rem" }}/> Categories will be auto-normalized during import (e.g. IPHONE → iPhone)
                    </Typography>
                  </Box>

                  <Box>
                    <Typography component="h3" variant="h3" sx={{ fontWeight: "600", marginBottom: "0.5rem" }}>Preview (first 5 rows)</Typography>
                    <Box sx={{ overflow: "auto", borderWidth: "1px", borderRadius: "var(--radius)" }}>
                      <DataTable columnsCount={1}>
                        <TableHead>
                          <TableRow>{importHeaders.map((h) => <TableCell key={h} sx={{ fontSize: "0.75rem", lineHeight: "1rem", whiteSpace: "nowrap" }}>{h}</TableCell>)}</TableRow>
                        </TableHead>
                        <TableBody>
                          {importData.slice(0, 5).map((row, i) => (<TableRow key={i}>{importHeaders.map((_, j) => <TableCell key={j} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{String(row[j] ?? "")}</TableCell>)}</TableRow>))}
                        </TableBody>
                      </DataTable>
                    </Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{importData.length} rows found</Typography>
                  </Box>

                  <Button onClick={runImport} variant="contained" sx={{ width: "100%" }}><Box component={Upload} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/> Import {importData.length} Products</Button>
                </>)}

              {importHistory.length > 0 && (<Box>
                  <Typography component="h3" variant="h3" sx={{ fontWeight: "600", marginBottom: "0.5rem" }}>Import History</Typography>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    {importHistory.map((h, i) => (<Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem", borderRadius: "0.25rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                        <Box component="span">{new Date(h.date).toLocaleString()}</Box>
                        <StatusChip label={<>{h.count} products</>} variant="outlined"/>
                      </Box>))}
                  </Box>
                </Box>)}
            </CardContent>
          </Card>
        </TabPanel>
      </TabView>

      {/* ADD PRODUCT DRAWER */}
      <SideDrawer
        open={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        title={"Add Product"}
        width={480}
        footer={
          <>
            <Button variant="outlined" onClick={() => setShowProductDialog(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={() => {
        if (!newProduct.part_number || !newProduct.description || !newProduct.category || !newProduct.mrp) {
            toast.error("Fill required fields");
            return;
        }
        addProductMutation.mutate({
            part_number: newProduct.part_number, description: newProduct.description, category: newProduct.category,
            mrp: parseFloat(newProduct.mrp), alp_ex_vat: parseFloat(newProduct.alp_ex_vat) || 0, gst_percentage: parseFloat(newProduct.gst_percentage) || 18,
        });
    }} variant="contained" sx={{ minHeight: 36 }}>Save Product</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
            <Box><TextField value={newProduct.part_number} onChange={(e) => setNewProduct({ ...newProduct, part_number: e.target.value })} placeholder="e.g. MYE73HN/A" label={"Part Number *"} size="small" fullWidth/></Box>
            <Box><TextField value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="e.g. iPhone 16 Pro Max 256GB" label={"Description *"} size="small" fullWidth/></Box>
            <Box>

              <TextField value={newProduct.category} label={"Category *"} select size="small" fullWidth onChange={event => ((v) => setNewProduct({ ...newProduct, category: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select category"}</MenuItem>{CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box><TextField type="number" value={newProduct.mrp} onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })} label={"MRP *"} size="small" fullWidth/></Box>
              <Box><TextField type="number" value={newProduct.alp_ex_vat} onChange={(e) => setNewProduct({ ...newProduct, alp_ex_vat: e.target.value })} label={"ALP Ex VAT"} size="small" fullWidth/></Box>
              <Box><TextField type="number" value={newProduct.gst_percentage} onChange={(e) => setNewProduct({ ...newProduct, gst_percentage: e.target.value })} label={"GST %"} size="small" fullWidth/></Box>
            </Box>
          </Box>
        </SideDrawer>

      {/* ADD/EDIT OFFER DRAWER */}
      <SideDrawer
        open={showOfferDialog}
        onClose={() => ((open) => { setShowOfferDialog(open); if (!open)
        setEditingOffer(null); })(false)}
        title={editingOffer ? "Edit Offer" : "Add Offer"}
        width={480}
        footer={
          <>
            <Button variant="outlined" onClick={() => { setShowOfferDialog(false); setEditingOffer(null); }} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSaveOffer} variant="contained" sx={{ minHeight: 36 }}>{editingOffer ? "Update Offer" : "Save Offer"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
            <Box>

              <TextField value={newOffer.offer_type} label={"Offer Type *"} select size="small" fullWidth onChange={event => ((v) => setNewOffer({ ...newOffer, offer_type: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select type"}</MenuItem>{Object.entries(OFFER_TYPES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
            </Box>
            <Box><TextField value={newOffer.bank_name} onChange={(e) => setNewOffer({ ...newOffer, bank_name: e.target.value })} placeholder="e.g. HDFC Bank" label={"Bank Name"} size="small" fullWidth/></Box>
            <Box>

              <TextField value={newOffer.applicable_category} label={"Applicable Category *"} select size="small" fullWidth onChange={event => ((v) => setNewOffer({ ...newOffer, applicable_category: v }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select category"}</MenuItem>{CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
            </Box>
            <Box><TextField value={newOffer.applicable_product} onChange={(e) => setNewOffer({ ...newOffer, applicable_product: e.target.value })} placeholder="e.g. iPhone 16 Pro" label={"Applicable Product (optional keyword)"} size="small" fullWidth/></Box>
            <Box><TextField type="number" value={newOffer.discount_amount} onChange={(e) => setNewOffer({ ...newOffer, discount_amount: e.target.value })} label={"Discount Amount (\u20B9) *"} size="small" fullWidth/></Box>
            <Box><TextField value={newOffer.discount_description} onChange={(e) => setNewOffer({ ...newOffer, discount_description: e.target.value })} placeholder="e.g. 6/9 month EMI cashback" label={"Description"} size="small" fullWidth/></Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box><TextField type="date" value={newOffer.start_date} onChange={(e) => setNewOffer({ ...newOffer, start_date: e.target.value })} label={"Start Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/></Box>
              <Box><TextField type="date" value={newOffer.end_date} onChange={(e) => setNewOffer({ ...newOffer, end_date: e.target.value })} label={"End Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/></Box>
            </Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
