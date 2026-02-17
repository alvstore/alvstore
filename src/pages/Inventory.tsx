import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, Pencil, Trash2, LayoutGrid, List, Package, AlertTriangle, Barcode, Printer, ArrowRightLeft } from "lucide-react";
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

const emptyForm = {
  name: "", sku: "", barcode: "", description: "", category: "",
  purchase_price: "0", selling_price: "0", gst_percentage: "18",
  stock_quantity: "0", low_stock_threshold: "5", unit: "pcs",
};

// Barcode preview component
function BarcodePreview({ value, productName }: { value: string; productName?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: "#ffffff",
        });
      } catch {
        // Invalid barcode value
      }
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

// Print barcode function
function printBarcode(barcodeValue: string, productName: string, sellingPrice: number) {
  const printWindow = window.open("", "_blank", "width=400,height=300");
  if (!printWindow) return;

  const svgContainer = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svgContainer.appendChild(svg);
  try {
    JsBarcode(svg, barcodeValue, {
      format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 12, margin: 5,
    });
  } catch { return; }

  printWindow.document.write(`
    <html><head><title>Print Barcode</title>
    <style>
      body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
      .label { text-align: center; padding: 8px; }
      .name { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
      .price { font-size: 13px; font-weight: bold; margin-top: 2px; }
      @media print { @page { margin: 0; size: 50mm 30mm; } }
    </style></head>
    <body>
      <div class="label">
        <div class="name">${productName}</div>
        ${svgContainer.innerHTML}
        <div class="price">₹${sellingPrice}</div>
      </div>
    </body></html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
}

function generateBarcode(): string {
  // Generate EAN-13 compatible barcode
  const prefix = "200"; // In-store use prefix
  const random = String(Math.floor(Math.random() * 1000000000)).padStart(9, "0");
  const code = prefix + random;
  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return code + checkDigit;
}

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("products");

  // Barcode sheet
  const [barcodeSheetOpen, setBarcodeSheetOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (search) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    }
    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else {
      setProducts(data || []);
      const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
      setCategories(cats);
    }
    setLoading(false);
  };

  const fetchMovements = async () => {
    const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100);
    if (!error) setMovements(data || []);
  };

  useEffect(() => { fetchProducts(); }, [search, categoryFilter]);
  useEffect(() => { if (activeTab === "movements") fetchMovements(); }, [activeTab]);

  // Check URL params for tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "movements") setActiveTab("movements");
  }, []);

  const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };

  const openEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name, sku: p.sku || "", barcode: p.barcode || "",
      description: p.description || "", category: p.category || "",
      purchase_price: String(p.purchase_price), selling_price: String(p.selling_price),
      gst_percentage: String(p.gst_percentage), stock_quantity: String(p.stock_quantity),
      low_stock_threshold: String(p.low_stock_threshold), unit: p.unit || "pcs",
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name, sku: form.sku || null, barcode: form.barcode || null,
      description: form.description || null, category: form.category || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      gst_percentage: parseFloat(form.gst_percentage) || 18,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      unit: form.unit || "pcs",
    };
    if (editId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Product updated");
    } else {
      const { error } = await supabase.from("products").insert({ ...payload, created_by: user?.id });
      if (error) toast.error(error.message); else toast.success("Product created");
    }
    setSheetOpen(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Product deleted"); fetchProducts(); }
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isLowStock = (p: Product) => p.stock_quantity <= p.low_stock_threshold;

  const handleGenerateBarcode = () => {
    const code = generateBarcode();
    setForm(prev => ({ ...prev, barcode: code }));
    toast.success("Barcode generated: " + code);
  };

  const openBarcodeView = (p: Product) => {
    setBarcodeProduct(p);
    setBarcodeSheetOpen(true);
  };

  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || productId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage products, stock, and barcodes</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products"><Package className="h-4 w-4 mr-1.5" />Products</TabsTrigger>
          <TabsTrigger value="movements"><ArrowRightLeft className="h-4 w-4 mr-1.5" />Stock Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, SKU, barcode..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1 border rounded-lg p-0.5">
              <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
              <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" onClick={() => setViewMode("grid")}><LayoutGrid className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Products */}
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
                    <TableHead className="hidden md:table-cell">Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {isLowStock(p) && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Low</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.sku || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{p.category || "—"}</TableCell>
                      <TableCell className="text-right">₹{p.selling_price}</TableCell>
                      <TableCell className="text-right">{p.stock_quantity} {p.unit}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.barcode && (
                            <Button variant="ghost" size="icon" onClick={() => openBarcodeView(p)} title="View Barcode">
                              <Barcode className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-36 bg-muted flex items-center justify-center">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package className="h-10 w-10 text-muted-foreground/30" />}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight">{p.name}</h3>
                      {isLowStock(p) && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    </div>
                    {p.sku && <p className="text-xs text-muted-foreground">SKU: {p.sku}</p>}
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold">₹{p.selling_price}</span>
                      <span className={isLowStock(p) ? "text-destructive font-medium" : "text-muted-foreground"}>{p.stock_quantity} {p.unit}</span>
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(p)}>Edit</Button>
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

      {/* Product Form Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Product" : "Add Product"}</SheetTitle>
            <SheetDescription>{editId ? "Update product details" : "Fill in the product information"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "name", label: "Name *" },
              { key: "sku", label: "SKU" },
              { key: "category", label: "Category" },
              { key: "unit", label: "Unit" },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input value={(form as any)[f.key]} onChange={e => updateField(f.key, e.target.value)} />
              </div>
            ))}

            {/* Barcode with generator */}
            <div className="space-y-1.5">
              <Label>Barcode</Label>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={e => updateField("barcode", e.target.value)} placeholder="Scan or generate" className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={handleGenerateBarcode} title="Auto-generate barcode">
                  <Barcode className="h-4 w-4 mr-1" />Generate
                </Button>
              </div>
              {form.barcode && <BarcodePreview value={form.barcode} />}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => updateField("description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "purchase_price", label: "Purchase Price" },
                { key: "selling_price", label: "Selling Price" },
                { key: "gst_percentage", label: "GST %" },
                { key: "stock_quantity", label: "Stock Qty" },
                { key: "low_stock_threshold", label: "Low Stock Alert" },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input type="number" value={(form as any)[f.key]} onChange={e => updateField(f.key, e.target.value)} />
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update Product" : "Create Product"}</Button>
          </div>
        </SheetContent>
      </Sheet>

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
                <Button
                  className="w-full"
                  onClick={() => printBarcode(barcodeProduct.barcode!, barcodeProduct.name, barcodeProduct.selling_price)}
                >
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
