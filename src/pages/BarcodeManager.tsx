import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Barcode, Printer, Search, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";

interface Product {
  id: string; name: string; sku: string | null; barcode: string | null;
  selling_price: number | null; stock_quantity: number;
}

export default function BarcodeManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelQty, setLabelQty] = useState(1);
  const [format, setFormat] = useState("CODE128");
  const [generating, setGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async () => {
    let q = supabase.from("products").select("id, name, sku, barcode, selling_price, stock_quantity").order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q.limit(100);
    setProducts(data || []);
  }, [search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const toggleProduct = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  };

  const autoGenerateBarcode = async (product: Product) => {
    if (product.barcode) return product.barcode;
    const code = `PRD${Date.now().toString(36).toUpperCase()}`;
    await supabase.from("products").update({ barcode: code }).eq("id", product.id);
    return code;
  };

  const generateAndPreview = async () => {
    if (selected.size === 0) { toast.error("Select at least one product"); return; }
    setGenerating(true);
    const container = previewRef.current;
    if (!container) { setGenerating(false); return; }
    container.innerHTML = "";

    for (const id of selected) {
      const product = products.find(p => p.id === id);
      if (!product) continue;
      const code = await autoGenerateBarcode(product);

      for (let i = 0; i < labelQty; i++) {
        const label = document.createElement("div");
        label.className = "inline-block border border-border rounded p-3 m-1 text-center bg-white";
        label.style.width = "200px";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        label.appendChild(svg);

        try {
          JsBarcode(svg, code, { format, width: 1.5, height: 40, fontSize: 10, margin: 5, displayValue: true });
        } catch { JsBarcode(svg, code, { format: "CODE128", width: 1.5, height: 40, fontSize: 10, margin: 5, displayValue: true }); }

        const nameEl = document.createElement("p");
        nameEl.className = "text-xs font-medium mt-1 truncate";
        nameEl.textContent = product.name;
        label.appendChild(nameEl);

        if (product.selling_price) {
          const priceEl = document.createElement("p");
          priceEl.className = "text-xs text-gray-500";
          priceEl.textContent = `₹${product.selling_price}`;
          label.appendChild(priceEl);
        }

        container.appendChild(label);
      }
    }

    setGenerating(false);
    fetchProducts();
    toast.success("Barcodes generated");
  };

  const printLabels = () => {
    const content = previewRef.current?.innerHTML;
    if (!content) { toast.error("Generate barcodes first"); return; }
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Print Barcodes</title>
      <style>body{margin:20px;font-family:sans-serif} .label{display:inline-block;border:1px solid #ddd;border-radius:4px;padding:12px;margin:4px;text-align:center;background:#fff;width:200px}</style>
    </head><body>${content}<script>window.print();window.close();</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Barcode Manager</h1>
        <p className="text-muted-foreground">Generate, print, and assign barcodes to products</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Selection */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Select Products</CardTitle>
              <CardDescription>Choose products to generate barcodes for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>

              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Checkbox checked={selected.size === products.length && products.length > 0} onCheckedChange={selectAll} />
                <Label className="text-xs text-muted-foreground">Select All ({selected.size}/{products.length})</Label>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleProduct(p.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${selected.has(p.id) ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50 border border-transparent"}`}
                  >
                    <Checkbox checked={selected.has(p.id)} />
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {p.sku && <span>SKU: {p.sku}</span>}
                        {p.selling_price && <span>₹{p.selling_price}</span>}
                      </div>
                    </div>
                    {p.barcode ? (
                      <Badge variant="outline" className="text-[10px] shrink-0">Has Code</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] shrink-0">No Code</Badge>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Config + Preview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Generate Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Format</Label>
                  <Select value={format} onValueChange={setFormat}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">CODE128</SelectItem>
                      <SelectItem value="EAN13">EAN-13</SelectItem>
                      <SelectItem value="UPC">UPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Labels per Product</Label>
                  <Input type="number" min={1} max={50} value={labelQty} onChange={e => setLabelQty(parseInt(e.target.value) || 1)} className="h-9" />
                </div>
                <div className="flex items-end gap-2">
                  <Button className="flex-1 h-9" onClick={generateAndPreview} disabled={generating || selected.size === 0}>
                    {generating ? <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> : <Barcode className="h-4 w-4 mr-1.5" />}
                    Generate
                  </Button>
                  <Button variant="outline" className="h-9" onClick={printLabels}>
                    <Printer className="h-4 w-4 mr-1.5" />Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Label Preview</CardTitle>
              <CardDescription>Generated barcode labels will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={previewRef} className="min-h-[300px] bg-muted/20 rounded-lg p-4 flex flex-wrap items-start content-start">
                {!previewRef.current?.innerHTML && (
                  <div className="w-full text-center py-16 text-muted-foreground">
                    <Barcode className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Select products and click Generate</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
