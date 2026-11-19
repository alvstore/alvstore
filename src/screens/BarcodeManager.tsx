"use client";

import { Box, Button, ButtonBase, Card, CardContent, Checkbox, FormLabel, MenuItem, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, SearchToolbar, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Barcode, Printer, Search, Package, RefreshCw } from "lucide-react";
import JsBarcode from "jsbarcode";
interface Product {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    selling_price: number | null;
    stock_quantity: number;
}
function BarcodeLabel({ product, code, format }: { product: Product; code: string; format: string }) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (!svgRef.current) return;
        const options = { width: 1.5, height: 40, fontSize: 10, margin: 5, displayValue: true };
        try { JsBarcode(svgRef.current, code, { ...options, format }); }
        catch { JsBarcode(svgRef.current, code, { ...options, format: "CODE128" }); }
    }, [code, format]);
    return <Box data-barcode-label sx={{ display: "inline-block", border: "1px solid #ddd", borderRadius: 1, p: 1.5, m: .5, textAlign: "center", bgcolor: "#fff", color: "#111", width: 200 }}>
        <Box component="svg" ref={svgRef} role="img" aria-label={`Barcode ${code}`} sx={{ maxWidth: "100%", mx: "auto" }} />
        <Typography data-label-name variant="caption" component="p" noWrap sx={{ fontWeight: 500, mt: .5 }}>{product.name}</Typography>
        {product.selling_price != null && <Typography data-label-price variant="caption" component="p" sx={{ color: "#666" }}>₹{product.selling_price}</Typography>}
    </Box>;
}

export default function BarcodeManager() {
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [labelQty, setLabelQty] = useState(1);
    const [format, setFormat] = useState("CODE128");
    const [generating, setGenerating] = useState(false);
    const [labels, setLabels] = useState<{ product: Product; code: string; format: string }[]>([]);
    const hasPreview = labels.length > 0;
    const previewRef = useRef<HTMLDivElement>(null);
    const fetchProducts = useCallback(async () => {
        let q = supabase.from("products").select("id, name, sku, barcode, selling_price, stock_quantity").order("name");
        if (search)
            q = q.ilike("name", `%${search}%`);
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
        if (selected.size === products.length)
            setSelected(new Set());
        else
            setSelected(new Set(products.map(p => p.id)));
    };
    const autoGenerateBarcode = async (product: Product) => {
        if (product.barcode)
            return product.barcode;
        const code = `PRD${product.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        const { error } = await supabase.from("products").update({ barcode: code }).eq("id", product.id);
        if (error) throw new Error(error.message);
        return code;
    };
    const generateAndPreview = async () => {
        if (selected.size === 0) {
            toast.error("Select at least one product");
            return;
        }
        setGenerating(true);
        try {
            const next: { product: Product; code: string; format: string }[] = [];
            for (const id of selected) {
                const product = products.find(p => p.id === id);
                if (!product) continue;
                const code = await autoGenerateBarcode(product);
                for (let i = 0; i < Math.max(1, Math.min(50, labelQty)); i++) next.push({ product, code, format });
            }
            setLabels(next);
            await fetchProducts();
            toast.success("Barcodes generated");
        } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to generate barcodes"); }
        finally { setGenerating(false); }
    };
    const printLabels = () => {
        const content = previewRef.current?.innerHTML;
        if (!content) {
            toast.error("Generate barcodes first");
            return;
        }
        const w = window.open("", "_blank", "width=800,height=600");
        if (!w)
            return;
        w.document.write(`<!DOCTYPE html><html><head><title>Print Barcodes</title>
      <style>body{margin:20px;font-family:sans-serif} [data-barcode-label]{display:inline-block;box-sizing:border-box;break-inside:avoid;border:1px solid #ddd;border-radius:4px;padding:12px;margin:4px;text-align:center;background:#fff;color:#111;width:200px}svg{max-width:100%;display:block;margin:auto}p{margin:0;font-size:12px;line-height:16px}[data-label-name]{font-weight:500;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}[data-label-price]{color:#666}</style>
    </head><body>${content}<script>window.print();window.close();</script></body></html>`);
        w.document.close();
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Barcode Manager"} subtitle={"Generate, print, and assign barcodes to products"}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Left: Product Selection */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 5 / span 5" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.75rem" })}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Select Products</Typography>
              <Typography variant="body2" color="text.secondary">Choose products to generate barcodes for</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search products..."/>

              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.5rem", borderBottomWidth: "1px", borderColor: "hsl(var(--border))" }}>
                <Checkbox checked={selected.size === products.length && products.length > 0} onChange={(event, checked) => selectAll()}/>
                <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Select All ({selected.size}/{products.length})</FormLabel>
              </Box>

              <Box sx={{ maxHeight: "400px", overflowY: "auto", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                {products.map(p => (<ButtonBase key={p.id} onClick={() => toggleProduct(p.id)} type="button" sx={mergeSx({ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem", borderRadius: "var(--radius)", textAlign: "left", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, selected.has(p.id) ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" } : { "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }, borderWidth: "1px", borderColor: "transparent" })}>
                    <Checkbox checked={selected.has(p.id)}/>
                    <Box component={Package} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))", flexShrink: "0" }}/>
                    <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</Typography>
                      <Box sx={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                        {p.sku && <Box component="span">SKU: {p.sku}</Box>}
                        {p.selling_price && <Box component="span">₹{p.selling_price}</Box>}
                      </Box>
                    </Box>
                    {p.barcode ? (<StatusChip label={"Has Code"} variant="outlined" sx={{ fontSize: "10px", flexShrink: "0" }}/>) : (<StatusChip label={"No Code"} variant="filled" sx={{ fontSize: "10px", flexShrink: "0" }}/>)}
                  </ButtonBase>))}
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right: Config + Preview */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 7 / span 7" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.75rem" })}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Generate Settings</Typography>
            </Box>
            <CardContent>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={format} label={"Format"} select size="small" fullWidth onChange={event => setFormat(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2.25rem" }}>
                      <MenuItem value="CODE128">CODE128</MenuItem>
                      <MenuItem value="EAN13">EAN-13</MenuItem>
                      <MenuItem value="UPC">UPC</MenuItem>
                    </TextField>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField type="number" value={labelQty} onChange={e => setLabelQty(parseInt(e.target.value) || 1)} label={"Labels per Product"} size="small" fullWidth slotProps={{ htmlInput: { min: 1, max: 50 } }} sx={{ height: "2.25rem" }}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                  <Button onClick={generateAndPreview} disabled={generating || selected.size === 0} variant="contained" sx={{ flex: "1 1 0%", height: "2.25rem" }}>
                    {generating ? <Box component={RefreshCw} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem", animation: "spin 1s linear infinite" }}/> : <Box component={Barcode} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>}
                    Generate
                  </Button>
                  <Button onClick={printLabels} variant="outlined" sx={{ height: "2.25rem" }}>
                    <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Print
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Label Preview</Typography>
              <Typography variant="body2" color="text.secondary">Generated barcode labels will appear here</Typography>
            </Box>
            <CardContent>
              {/* Barcode SVG drawing is confined to leaf refs owned by each label. */}
              <Box sx={{ position: "relative", minHeight: "300px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", borderRadius: "var(--radius)" }}>
                <Box ref={previewRef} sx={{ minHeight: "300px", padding: "1rem", display: "flex", flexWrap: "wrap", alignItems: "flex-start", alignContent: "flex-start" }}>{labels.map((label, index) => <BarcodeLabel key={`${label.product.id}-${index}`} {...label} />)}</Box>
                {!hasPreview && (<Box sx={{ position: "absolute", inset: "0px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "hsl(var(--muted-foreground))", pointerEvents: "none" }}>
                    <Box component={Barcode} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.2" }}/>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>Select products and click Generate</Typography>
                  </Box>)}
              </Box>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
