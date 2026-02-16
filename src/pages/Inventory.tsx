import { useState, useEffect } from "react";
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
import { Plus, Search, Pencil, Trash2, LayoutGrid, List, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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

const emptyForm = {
  name: "", sku: "", barcode: "", description: "", category: "",
  purchase_price: "0", selling_price: "0", gst_percentage: "18",
  stock_quantity: "0", low_stock_threshold: "5", unit: "pcs",
};

export default function Inventory() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<string[]>([]);

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

  useEffect(() => { fetchProducts(); }, [search, categoryFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Manage products and stock</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Product</Button>
      </div>

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
                <TableHead className="w-24">Actions</TableHead>
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
                  <Button variant="outline" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Slide-over form */}
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
              { key: "barcode", label: "Barcode" },
              { key: "category", label: "Category" },
              { key: "unit", label: "Unit" },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input value={(form as any)[f.key]} onChange={e => updateField(f.key, e.target.value)} />
              </div>
            ))}
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
    </div>
  );
}
