import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, X, Barcode, Upload, Package } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";

function generateBarcode(): string {
  const prefix = "200";
  const random = String(Math.floor(Math.random() * 1000000000)).padStart(9, "0");
  const code = prefix + random;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  return code + ((10 - (sum % 10)) % 10);
}

function BarcodePreview({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try { JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 12, margin: 5, background: "#ffffff" }); } catch {}
    }
  }, [value]);
  if (!value) return null;
  return <svg ref={svgRef} className="mx-auto" />;
}

const emptyForm = {
  name: "", sku: "", barcode: "", description: "", category: "",
  purchase_price: "0", selling_price: "0", gst_percentage: "18",
  stock_quantity: "0", low_stock_threshold: "5", unit: "pcs",
  image_url: "", status: "active",
};

export default function ProductAdd() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    // Fetch categories
    supabase.from("products").select("category").then(({ data }) => {
      const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
      setCategories(cats);
    });

    // If editing, load product
    if (id) {
      supabase.from("products").select("*").eq("id", id).single().then(({ data, error }) => {
        if (error || !data) { toast.error("Product not found"); navigate("/inventory"); return; }
        setForm({
          name: data.name, sku: data.sku || "", barcode: data.barcode || "",
          description: data.description || "", category: data.category || "",
          purchase_price: String(data.purchase_price || 0),
          selling_price: String(data.selling_price || 0),
          gst_percentage: String(data.gst_percentage || 18),
          stock_quantity: String(data.stock_quantity || 0),
          low_stock_threshold: String(data.low_stock_threshold || 5),
          unit: data.unit || "pcs", image_url: data.image_url || "",
          status: "active",
        });
      });
    }
  }, [id, navigate]);

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error("Upload failed"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
    setUploading(false);
    toast.success("Image uploaded");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Product name is required"); return; }
    setLoading(true);
    const payload = {
      name: form.name, sku: form.sku || null, barcode: form.barcode || null,
      description: form.description || null, category: form.category || null,
      purchase_price: parseFloat(form.purchase_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      gst_percentage: parseFloat(form.gst_percentage) || 18,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 5,
      unit: form.unit || "pcs", image_url: form.image_url || null,
    };

    if (isEdit) {
      const { error } = await supabase.from("products").update(payload).eq("id", id);
      if (error) toast.error(error.message); else { toast.success("Product updated"); navigate("/inventory"); }
    } else {
      const { error } = await supabase.from("products").insert({ ...payload, created_by: user?.id });
      if (error) toast.error(error.message); else { toast.success("Product created"); navigate("/inventory"); }
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Edit Product" : "Add New Product"}</h1>
          <p className="text-muted-foreground text-sm">
            {isEdit ? "Update product information" : "Create a new product in your inventory"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - 8 cols */}
        <div className="lg:col-span-8 space-y-6">
          {/* Product Information */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Product Name *</Label>
                  <Input value={form.name} onChange={e => updateField("name", e.target.value)} placeholder="Enter product name" />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={e => updateField("sku", e.target.value)} placeholder="SKU-001" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Barcode</Label>
                <div className="flex gap-2">
                  <Input value={form.barcode} onChange={e => updateField("barcode", e.target.value)} placeholder="Scan or generate" className="flex-1" />
                  <Button variant="outline" onClick={() => { const code = generateBarcode(); updateField("barcode", code); toast.success("Barcode generated"); }}>
                    <Barcode className="h-4 w-4 mr-2" />Generate
                  </Button>
                </div>
                {form.barcode && (
                  <div className="mt-2 p-3 bg-white rounded-lg border">
                    <BarcodePreview value={form.barcode} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => updateField("description", e.target.value)} rows={3} placeholder="Product description..." />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Purchase Price (₹)</Label>
                  <Input type="number" value={form.purchase_price} onChange={e => updateField("purchase_price", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling Price (₹)</Label>
                  <Input type="number" value={form.selling_price} onChange={e => updateField("selling_price", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>GST %</Label>
                  <Input type="number" value={form.gst_percentage} onChange={e => updateField("gst_percentage", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Stock Quantity</Label>
                  <Input type="number" value={form.stock_quantity} onChange={e => updateField("stock_quantity", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" value={form.low_stock_threshold} onChange={e => updateField("low_stock_threshold", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Select value={form.unit} onValueChange={v => updateField("unit", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["pcs", "kg", "ltr", "mtr", "box", "set"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          {/* Product Image */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Product Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
                {form.image_url ? (
                  <div className="space-y-3">
                    <img src={form.image_url} alt="Product" className="w-full h-40 object-contain rounded-lg" />
                    <Button variant="outline" size="sm" onClick={() => updateField("image_url", "")}>Remove</Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block space-y-2">
                    <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload image"}
                    </p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={form.category} onValueChange={v => updateField("category", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Or type a new category</Label>
                <Input value={form.category} onChange={e => updateField("category", e.target.value)} placeholder="New category" />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />{isEdit ? "Update Product" : "Save Product"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/inventory")}>
                <X className="h-4 w-4 mr-2" />Discard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
