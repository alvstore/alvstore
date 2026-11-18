import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, LayoutGrid, List, Package, AlertTriangle, Barcode, Printer, ArrowRightLeft, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  purchase_price: number;
  selling_price: number;
  gst_percentage: number;
  stock_quantity: number;
  low_stock_threshold: number;
  unit: string | null;
  created_at: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
}

// Barcode preview component
function BarcodePreview({ value, productName }: { value: string; productName?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try { JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, margin: 10, background: "#ffffff" }); } catch {}
    }
  }, [value]);
  if (!value) return null;
  return (
    <div className="bg-white rounded-lg border p-3 text-center">
      {productName && <p className="text-xs text-muted-foreground mb-1 font-medium">{productName}</p>}
      <svg ref={svgRef} />
    </div>
  );
}

function printBarcode(barcodeValue: string, productName: string, sellingPrice: number) {
  const printWindow = window.open("", "_blank", "width=400,height=300");
  if (!printWindow) return;
  const svgContainer = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgContainer.appendChild(svg);
  try { JsBarcode(svg, barcodeValue, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 12, margin: 5 }); } catch { return; }
  printWindow.document.write(`<html><head><title>Print Barcode</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}.label{text-align:center;padding:8px}.name{font-size:11px;font-weight:bold;margin-bottom:4px}.price{font-size:13px;font-weight:bold;margin-top:2px}@media print{@page{margin:0;size:50mm 30mm}}</style></head><body><div class="label"><div class="name">${productName}</div>${svgContainer.innerHTML}<div class="price">₹${sellingPrice}</div></div></body></html>`);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("products");
  const [barcodeSheetOpen, setBarcodeSheetOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else {
      let filtered = data || [];
      if (stockFilter === "low") filtered = filtered.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold);
      else if (stockFilter === "out") filtered = filtered.filter(p => p.stock_quantity <= 0);
      else if (stockFilter === "in") filtered = filtered.filter(p => p.stock_quantity > p.low_stock_threshold);
      setProducts(filtered);
      const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
      setCategories(cats);
    }
    setLoading(false);
  };

  const fetchMovements = async () => {
    const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100);
    if (!error) setMovements(data || []);
  };

  useEffect(() => { fetchProducts(); }, [search, categoryFilter, stockFilter]);
  useEffect(() => { if (activeTab === "movements") fetchMovements(); }, [activeTab]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "movements") setActiveTab("movements");
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Product deleted"); fetchProducts(); }
  };

  const isLowStock = (p: Product) => p.stock_quantity <= p.low_stock_threshold;
  const openBarcodeView = (p: Product) => { setBarcodeProduct(p); setBarcodeSheetOpen(true); };
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || productId;

  // KPI stats
  const totalProducts = products.length;
  const inStock = products.filter(p => p.stock_quantity > p.low_stock_threshold).length;
  const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length;
  const outOfStock = products.filter(p => p.stock_quantity <= 0).length;

  const kpiCards = [
    { label: "Total Products", value: totalProducts, icon: Package, bg: "bg-primary/10", iconColor: "text-primary" },
    { label: "In Stock", value: inStock, icon: CheckCircle, bg: "bg-success/10", iconColor: "text-success" },
    { label: "Low Stock", value: lowStock, icon: AlertTriangle, bg: "bg-warning/10", iconColor: "text-warning" },
    { label: "Out of Stock", value: outOfStock, icon: XCircle, bg: "bg-destructive/10", iconColor: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog and inventory</p>
        </div>
        <Button onClick={() => navigate("/inventory/add")}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className="text-xl font-bold text-foreground">{loading ? "—" : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1.5" />Products</TabsTrigger>
          <TabsTrigger value="movements"><ArrowRightLeft className="h-4 w-4 mr-1.5" />Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stock Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1 border rounded-lg p-0.5">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No products found. Add your first product!</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden sm:table-cell">SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/inventory/${p.id}/edit`)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted-foreground/50" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground">{p.category || "Uncategorized"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{p.sku || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{p.stock_quantity} {p.unit}</TableCell>
                      <TableCell className="text-right font-medium">₹{p.selling_price}</TableCell>
                      <TableCell>
                        {p.stock_quantity <= 0 ? (
                          <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>
                        ) : isLowStock(p) ? (
                          <Badge className="bg-warning/10 text-warning text-[10px]">Low Stock</Badge>
                        ) : (
                          <Badge className="bg-success/10 text-success text-[10px]">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                          {p.barcode && (
                            <Button variant="ghost" size="icon" onClick={() => openBarcodeView(p)} title="Barcode">
                              <Barcode className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/inventory/${p.id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map(p => (
                <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/inventory/${p.id}/edit`)}>
                  <div className="h-36 bg-muted flex items-center justify-center">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-10 w-10 text-muted-foreground/30" />}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight">{p.name}</h3>
                      {p.stock_quantity <= 0 ? (
                        <Badge variant="destructive" className="text-[10px] shrink-0">Out</Badge>
                      ) : isLowStock(p) ? (
                        <Badge className="bg-warning/10 text-warning text-[10px] shrink-0">Low</Badge>
                      ) : (
                        <Badge className="bg-success/10 text-success text-[10px] shrink-0">In Stock</Badge>
                      )}
                    </div>
                    {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold">₹{p.selling_price}</span>
                      <span className="text-muted-foreground">{p.stock_quantity} {p.unit}</span>
                    </div>
                    <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/inventory/${p.id}/edit`)}>Edit</Button>
                      {p.barcode && <Button variant="outline" size="sm" onClick={() => openBarcodeView(p)}><Barcode className="h-3.5 w-3.5" /></Button>}
                      <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="hidden sm:table-cell">Reference</TableHead>
                  <TableHead className="hidden md:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <ArrowRightLeft className="h-10 w-10 mx-auto mb-2 opacity-30" />No stock movements yet
                  </TableCell></TableRow>
                ) : movements.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm text-muted-foreground">{new Date(m.created_at).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell className="font-medium">{getProductName(m.product_id)}</TableCell>
                    <TableCell>
                      <Badge className={m.type === "in" ? "bg-success/10 text-success" : m.type === "out" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}>
                        {m.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{m.quantity}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{m.reference || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Barcode View/Print Sheet */}
      <Sheet open={barcodeSheetOpen} onOpenChange={setBarcodeSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Product Barcode</SheetTitle>
            <SheetDescription>{barcodeProduct?.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {barcodeProduct?.barcode && (
              <>
                <BarcodePreview value={barcodeProduct.barcode} productName={barcodeProduct.name} />
                <p className="text-center text-sm text-muted-foreground">₹{barcodeProduct.selling_price}</p>
                <Button className="w-full" onClick={() => printBarcode(barcodeProduct.barcode!, barcodeProduct.name, barcodeProduct.selling_price)}>
                  <Printer className="h-4 w-4 mr-2" />Print Barcode Label
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
