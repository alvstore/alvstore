import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import {
  Package, Tag, Percent, TrendingUp, Gift, Search,
  Plus, Calculator, Download, ArrowUpDown, Star, X,
  IndianRupee, Layers, BarChart3
} from "lucide-react";

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
};

const CATEGORIES = ["iPhone", "Mac", "iPad", "Watch", "AirPods", "HomePod", "Beats", "Accessories", "AppleCare"];
const OFFER_TYPES: Record<string, string> = {
  card_emi: "Card EMI",
  card_fs: "Card Full Swipe",
  loan: "Loan",
  trade_in: "Trade-in",
  iphone_for_life: "iPhone for Life",
};

const formatINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export default function ApplePricing() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [offerFilter, setOfferFilter] = useState(false);
  const [sortBy, setSortBy] = useState<"mrp" | "margin" | "name">("name");
  const [compareList, setCompareList] = useState<string[]>([]);
  const [calcProduct, setCalcProduct] = useState<string>("");
  const [calcSellingPrice, setCalcSellingPrice] = useState<string>("");
  const [calcSelectedOffers, setCalcSelectedOffers] = useState<string[]>([]);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState({ category: "", discount_percentage: "", rule_name: "" });

  // Queries
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["apple-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apple_products")
        .select("*")
        .eq("status", "active")
        .order("category")
        .order("mrp", { ascending: false });
      if (error) throw error;
      return data as AppleProduct[];
    },
  });

  const { data: offers = [] } = useQuery({
    queryKey: ["apple-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apple_offers")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data as AppleOffer[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["apple-pricing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apple_pricing_rules")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data as PricingRule[];
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: async (rule: { category: string; discount_percentage: number; rule_name: string }) => {
      const { error } = await supabase.from("apple_pricing_rules").insert(rule);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] });
      toast.success("Pricing rule added");
      setShowRuleDialog(false);
      setNewRule({ category: "", discount_percentage: "", rule_name: "" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apple_pricing_rules").update({ status: "inactive" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apple-pricing-rules"] });
      toast.success("Rule removed");
    },
  });

  // Computed
  const ruleMap = useMemo(() => {
    const m: Record<string, PricingRule> = {};
    rules.forEach((r) => (m[r.category] = r));
    return m;
  }, [rules]);

  const getBaseDiscount = (product: AppleProduct) => {
    const rule = ruleMap[product.category];
    if (!rule) return 0;
    if (rule.discount_percentage > 0) return (product.mrp * rule.discount_percentage) / 100;
    return rule.discount_amount;
  };

  const getOffersForProduct = (product: AppleProduct) => {
    return offers.filter(
      (o) =>
        o.applicable_category === product.category &&
        (!o.applicable_product ||
          product.description.toLowerCase().includes(o.applicable_product.toLowerCase()))
    );
  };

  const getBestOfferDiscount = (product: AppleProduct) => {
    const pOffers = getOffersForProduct(product);
    if (pOffers.length === 0) return 0;
    return Math.max(...pOffers.map((o) => o.discount_amount));
  };

  const getLandingCost = (product: AppleProduct) => {
    return product.mrp - getBaseDiscount(product) - getBestOfferDiscount(product);
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const matchSearch =
        !search ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.part_number.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      const matchOffer = !offerFilter || getOffersForProduct(p).length > 0;
      return matchSearch && matchCat && matchOffer;
    });

    list.sort((a, b) => {
      if (sortBy === "mrp") return b.mrp - a.mrp;
      if (sortBy === "margin") return getLandingCost(a) - getLandingCost(b);
      return a.description.localeCompare(b.description);
    });

    return list;
  }, [products, search, categoryFilter, offerFilter, sortBy, ruleMap, offers]);

  // KPIs
  const totalProducts = products.length;
  const activeOffers = offers.length;
  const productsWithOffers = products.filter((p) => getOffersForProduct(p).length > 0).length;
  const avgMarginPct =
    products.length > 0
      ? products.reduce((sum, p) => {
          const lc = getLandingCost(p);
          return sum + ((p.mrp - lc) / p.mrp) * 100;
        }, 0) / products.length
      : 0;
  const bestMarginProduct = products.reduce(
    (best, p) => {
      const margin = ((p.mrp - getLandingCost(p)) / p.mrp) * 100;
      return margin > best.margin ? { product: p, margin } : best;
    },
    { product: null as AppleProduct | null, margin: 0 }
  );

  // Calculator
  const calcProductData = products.find((p) => p.id === calcProduct);
  const calcBaseDiscount = calcProductData ? getBaseDiscount(calcProductData) : 0;
  const calcOfferDiscount = calcSelectedOffers.reduce((sum, offerId) => {
    const offer = offers.find((o) => o.id === offerId);
    return sum + (offer?.discount_amount || 0);
  }, 0);
  const calcLandingCost = calcProductData ? calcProductData.mrp - calcBaseDiscount - calcOfferDiscount : 0;
  const calcSP = parseFloat(calcSellingPrice) || 0;
  const calcMargin = calcSP - calcLandingCost;
  const calcMarginPct = calcLandingCost > 0 ? (calcMargin / calcSP) * 100 : 0;

  // CSV export
  const exportCSV = () => {
    const headers = ["Part Number", "Description", "Category", "MRP", "ALP Ex VAT", "Base Discount", "Best Offer", "Landing Cost"];
    const rows = filtered.map((p) => [
      p.part_number, `"${p.description}"`, p.category,
      p.mrp, p.alp_ex_vat, getBaseDiscount(p), getBestOfferDiscount(p), getLandingCost(p),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "apple-pricing-export.csv";
    a.click();
  };

  // Compare
  const compareProducts = products.filter((p) => compareList.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Apple Pricing Engine</h1>
          <p className="text-sm text-muted-foreground">Product pricing, offers & margin calculator</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalProducts}</p>
                <p className="text-xs text-muted-foreground">Products</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Gift className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeOffers}</p>
                <p className="text-xs text-muted-foreground">Active Offers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Percent className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgMarginPct.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Avg Discount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold truncate text-sm">{bestMarginProduct.product?.description?.split(" ").slice(0, 3).join(" ") || "—"}</p>
                <p className="text-xs text-muted-foreground">Best Discount</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Tag className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{productsWithOffers}</p>
                <p className="text-xs text-muted-foreground">With Offers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="catalog"><Layers className="h-4 w-4 mr-1" /> Catalog</TabsTrigger>
          <TabsTrigger value="rules"><Percent className="h-4 w-4 mr-1" /> Pricing Rules</TabsTrigger>
          <TabsTrigger value="offers"><Gift className="h-4 w-4 mr-1" /> Offers</TabsTrigger>
          <TabsTrigger value="calculator"><Calculator className="h-4 w-4 mr-1" /> Calculator</TabsTrigger>
          {compareList.length > 0 && (
            <TabsTrigger value="compare"><BarChart3 className="h-4 w-4 mr-1" /> Compare ({compareList.length})</TabsTrigger>
          )}
        </TabsList>

        {/* CATALOG TAB */}
        <TabsContent value="catalog" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search product or part number..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={offerFilter ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOfferFilter(!offerFilter)}
                >
                  <Gift className="h-4 w-4 mr-1" /> Offers Only
                </Button>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
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
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">MRP</TableHead>
                      <TableHead className="text-right">ALP Ex VAT</TableHead>
                      <TableHead className="text-right">Base Disc.</TableHead>
                      <TableHead className="text-right">Offer Disc.</TableHead>
                      <TableHead className="text-right">Landing Cost</TableHead>
                      <TableHead>Offers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProducts ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Loading products...
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No products found. Import data to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.slice(0, 100).map((p) => {
                        const pOffers = getOffersForProduct(p);
                        const baseDisc = getBaseDiscount(p);
                        const offerDisc = getBestOfferDiscount(p);
                        const landingCost = p.mrp - baseDisc - offerDisc;
                        const inCompare = compareList.includes(p.id);

                        return (
                          <TableRow key={p.id} className="group">
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  if (inCompare) {
                                    setCompareList((l) => l.filter((id) => id !== p.id));
                                  } else if (compareList.length < 3) {
                                    setCompareList((l) => [...l, p.id]);
                                  } else {
                                    toast.error("Max 3 products to compare");
                                  }
                                }}
                              >
                                <ArrowUpDown className={`h-3 w-3 ${inCompare ? "text-primary" : "text-muted-foreground"}`} />
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{p.description}</span>
                                {p.is_new && <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600">NEW</Badge>}
                              </div>
                              <span className="text-xs text-muted-foreground">{p.part_number}</span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{p.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{formatINR(p.mrp)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatINR(p.alp_ex_vat)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {baseDisc > 0 ? <span className="text-green-600">-{formatINR(baseDisc)}</span> : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {offerDisc > 0 ? <span className="text-blue-600">-{formatINR(offerDisc)}</span> : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold">{formatINR(landingCost)}</TableCell>
                            <TableCell>
                              {pOffers.length > 0 ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                                  {pOffers.length} offer{pOffers.length > 1 ? "s" : ""}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Showing 100 of {filtered.length} products
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRICING RULES TAB */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Category-wise Pricing Rules</h2>
            <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Pricing Rule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={newRule.category} onValueChange={(v) => setNewRule({ ...newRule, category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 5"
                      value={newRule.discount_percentage}
                      onChange={(e) => setNewRule({ ...newRule, discount_percentage: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Rule Name</Label>
                    <Input
                      placeholder="e.g. Standard iPhone Discount"
                      value={newRule.rule_name}
                      onChange={(e) => setNewRule({ ...newRule, rule_name: e.target.value })}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (!newRule.category || !newRule.discount_percentage) {
                        toast.error("Fill required fields");
                        return;
                      }
                      addRuleMutation.mutate({
                        category: newRule.category,
                        discount_percentage: parseFloat(newRule.discount_percentage),
                        rule_name: newRule.rule_name,
                      });
                    }}
                  >
                    Save Rule
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No pricing rules configured. Add a rule to set category-wise discounts.
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{rule.category}</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{rule.discount_percentage}%</p>
                    <p className="text-xs text-muted-foreground">{rule.rule_name || "Base discount"}</p>
                    {rule.discount_amount > 0 && (
                      <p className="text-sm mt-1">+ {formatINR(rule.discount_amount)} flat</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* OFFERS TAB */}
        <TabsContent value="offers" className="space-y-4">
          <h2 className="text-lg font-semibold">Q3'26 Affordability Offers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-8 text-center text-muted-foreground">
                  No offers loaded yet. Import offer data to see them here.
                </CardContent>
              </Card>
            ) : (
              offers.map((offer) => (
                <Card key={offer.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                        {OFFER_TYPES[offer.offer_type] || offer.offer_type}
                      </Badge>
                      <span className="text-lg font-bold text-green-600">{formatINR(offer.discount_amount)}</span>
                    </div>
                    <p className="font-medium text-sm">{offer.applicable_product || offer.applicable_category}</p>
                    <p className="text-xs text-muted-foreground mt-1">{offer.bank_name}</p>
                    {offer.discount_description && (
                      <p className="text-xs text-muted-foreground mt-1">{offer.discount_description}</p>
                    )}
                    {offer.start_date && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {offer.start_date} — {offer.end_date}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* CALCULATOR TAB */}
        <TabsContent value="calculator" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" /> Price Calculator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Product</Label>
                  <Select value={calcProduct} onValueChange={(v) => { setCalcProduct(v); setCalcSelectedOffers([]); }}>
                    <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.description} — {formatINR(p.mrp)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {calcProductData && (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground text-xs">MRP</p>
                        <p className="font-bold text-lg">{formatINR(calcProductData.mrp)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-muted-foreground text-xs">ALP Ex VAT</p>
                        <p className="font-bold text-lg">{formatINR(calcProductData.alp_ex_vat)}</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                      <p className="text-xs text-muted-foreground">Base Discount ({ruleMap[calcProductData.category]?.discount_percentage || 0}%)</p>
                      <p className="font-semibold text-green-600">-{formatINR(calcBaseDiscount)}</p>
                    </div>

                    {getOffersForProduct(calcProductData).length > 0 && (
                      <div>
                        <Label className="text-xs">Apply Offers</Label>
                        <div className="space-y-2 mt-1">
                          {getOffersForProduct(calcProductData).map((o) => (
                            <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="checkbox"
                                checked={calcSelectedOffers.includes(o.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCalcSelectedOffers([...calcSelectedOffers, o.id]);
                                  } else {
                                    setCalcSelectedOffers(calcSelectedOffers.filter((id) => id !== o.id));
                                  }
                                }}
                                className="rounded"
                              />
                              <span>{OFFER_TYPES[o.offer_type] || o.offer_type} — {o.bank_name} — <strong>{formatINR(o.discount_amount)}</strong></span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {calcOfferDiscount > 0 && (
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <p className="text-xs text-muted-foreground">Offer Discount</p>
                        <p className="font-semibold text-blue-600">-{formatINR(calcOfferDiscount)}</p>
                      </div>
                    )}

                    <div>
                      <Label>Your Selling Price</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="Enter selling price"
                          value={calcSellingPrice}
                          onChange={(e) => setCalcSellingPrice(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {calcProductData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>MRP</span>
                      <span className="font-mono">{formatINR(calcProductData.mrp)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Base Discount</span>
                      <span className="font-mono">-{formatINR(calcBaseDiscount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-blue-600">
                      <span>Offer Discount</span>
                      <span className="font-mono">-{formatINR(calcOfferDiscount)}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold">
                      <span>Landing Cost</span>
                      <span className="font-mono">{formatINR(calcLandingCost)}</span>
                    </div>
                  </div>

                  {calcSP > 0 && (
                    <div className={`p-4 rounded-xl border-2 ${
                      calcMargin > 0
                        ? "bg-green-500/5 border-green-500/20"
                        : calcMargin < 0
                        ? "bg-red-500/5 border-red-500/20"
                        : "bg-amber-500/5 border-amber-500/20"
                    }`}>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Selling Price</span>
                        <span className="font-mono">{formatINR(calcSP)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Margin</span>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${
                            calcMargin > 0 ? "text-green-600" : calcMargin < 0 ? "text-red-600" : "text-amber-600"
                          }`}>
                            {formatINR(Math.abs(calcMargin))}
                          </p>
                          <Badge className={
                            calcMargin > 0
                              ? "bg-green-500/10 text-green-600"
                              : calcMargin < 0
                              ? "bg-red-500/10 text-red-600"
                              : "bg-amber-500/10 text-amber-600"
                          }>
                            {calcMarginPct.toFixed(1)}% {calcMargin > 0 ? "PROFIT" : calcMargin < 0 ? "LOSS" : "BREAK-EVEN"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* COMPARE TAB */}
        {compareList.length > 0 && (
          <TabsContent value="compare" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Compare Products</h2>
              <Button variant="outline" size="sm" onClick={() => setCompareList([])}>
                Clear All
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {compareProducts.map((p) => {
                const baseDisc = getBaseDiscount(p);
                const offerDisc = getBestOfferDiscount(p);
                const lc = p.mrp - baseDisc - offerDisc;
                const pOffers = getOffersForProduct(p);

                return (
                  <Card key={p.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-sm">{p.description}</h3>
                          <p className="text-xs text-muted-foreground">{p.part_number}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCompareList((l) => l.filter((id) => id !== p.id))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Badge variant="outline">{p.category}</Badge>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>MRP</span><span className="font-mono font-semibold">{formatINR(p.mrp)}</span></div>
                        <div className="flex justify-between"><span>ALP Ex VAT</span><span className="font-mono">{formatINR(p.alp_ex_vat)}</span></div>
                        <div className="flex justify-between text-green-600"><span>Base Disc.</span><span className="font-mono">-{formatINR(baseDisc)}</span></div>
                        <div className="flex justify-between text-blue-600"><span>Offer Disc.</span><span className="font-mono">-{formatINR(offerDisc)}</span></div>
                        <div className="border-t pt-2 flex justify-between font-bold"><span>Landing Cost</span><span className="font-mono">{formatINR(lc)}</span></div>
                      </div>
                      {pOffers.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">Available Offers:</p>
                          {pOffers.map((o) => (
                            <Badge key={o.id} className="text-[10px] bg-green-500/10 text-green-600 mr-1">
                              {OFFER_TYPES[o.offer_type]} {formatINR(o.discount_amount)}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
