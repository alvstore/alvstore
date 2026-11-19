"use client";

import { Box, Button, Card, CardContent, FormLabel, IconButton, MenuItem, Tab, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Save, X, Barcode, Upload, Link2, Loader2 } from "lucide-react";
import JsBarcode from "jsbarcode";
function generateBarcode(): string {
    const prefix = "200";
    const random = String(Math.floor(Math.random() * 1000000000)).padStart(9, "0");
    const code = prefix + random;
    let sum = 0;
    for (let i = 0; i < 12; i++)
        sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    return code + ((10 - (sum % 10)) % 10);
}
function BarcodePreview({ value }: {
    value: string;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 12, margin: 5, background: "#ffffff" });
            }
            catch { }
        }
    }, [value]);
    if (!value)
        return null;
    return <Box ref={svgRef} component="svg" sx={{ marginLeft: "auto", marginRight: "auto" }}/>;
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
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [validatingUrl, setValidatingUrl] = useState(false);
    const isEdit = Boolean(id);
    useEffect(() => {
        supabase.from("products").select("category").then(({ data }) => {
            const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
            setCategories(cats);
        });
        if (id) {
            supabase.from("products").select("*").eq("id", id).single().then(({ data, error }) => {
                if (error || !data) {
                    toast.error("Product not found");
                    navigate("/inventory");
                    return;
                }
                setForm({
                    name: data.name, sku: data.sku || "", barcode: data.barcode || "",
                    description: data.description || "", category: data.category || "",
                    purchase_price: String(data.purchase_price || 0),
                    selling_price: String(data.selling_price || 0),
                    gst_percentage: String(data.gst_percentage || 18),
                    stock_quantity: String(data.stock_quantity || 0),
                    low_stock_threshold: String(data.low_stock_threshold || 5),
                    unit: data.unit || "pcs", image_url: data.image_url || "", status: "active",
                });
            });
        }
    }, [id, navigate]);
    const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        const ext = file.name.split(".").pop();
        const path = `products/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("uploads").upload(path, file);
        if (error) {
            toast.error("Upload failed");
            setUploading(false);
            return;
        }
        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
        setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
        setUploading(false);
        toast.success("Image uploaded");
    };
    const handleImageUrl = async () => {
        if (!imageUrlInput.trim())
            return;
        setValidatingUrl(true);
        try {
            await new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve();
                img.onerror = () => reject(new Error("Invalid image URL"));
                img.src = imageUrlInput;
                setTimeout(() => reject(new Error("Image load timeout")), 8000);
            });
            setForm(prev => ({ ...prev, image_url: imageUrlInput }));
            toast.success("Image URL validated");
        }
        catch {
            toast.error("Could not load image from URL");
        }
        setValidatingUrl(false);
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Product name is required");
            return;
        }
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
            if (error)
                toast.error(error.message);
            else {
                toast.success("Product updated");
                navigate("/inventory");
            }
        }
        else {
            const { error } = await supabase.from("products").insert({ ...payload, created_by: user?.id });
            if (error)
                toast.error(error.message);
            else {
                toast.success("Product created");
                navigate("/inventory");
            }
        }
        setLoading(false);
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={isEdit ? "Edit Product" : "Add New Product"} subtitle={isEdit ? "Update product information" : "Create a new product in your inventory"} actions={<><IconButton onClick={() => navigate("/inventory")} aria-label={"Arrow Left"}><Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }}/></IconButton></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          {/* Product Information */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "1rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600" })}>Product Information</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => updateField("name", e.target.value)} placeholder="Enter product name" label={"Product Name *"} size="small" fullWidth/></Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.sku} onChange={e => updateField("sku", e.target.value)} placeholder="SKU-001" label={"SKU"} size="small" fullWidth/></Box>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                <FormLabel>Barcode</FormLabel>
                <Box sx={{ display: "flex", gap: "0.5rem" }}>
                  <TextField value={form.barcode} onChange={e => updateField("barcode", e.target.value)} placeholder="Scan or generate" size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Scan or generate" } }} sx={{ flex: "1 1 0%" }}/>
                  <Button onClick={() => { updateField("barcode", generateBarcode()); toast.success("Barcode generated"); }} variant="outlined">
                    <Box component={Barcode} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Generate
                  </Button>
                </Box>
                {form.barcode && <Box sx={{ marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "rgb(255 255 255 / 1)", borderRadius: "var(--radius)", borderWidth: "1px" }}><BarcodePreview value={form.barcode}/></Box>}
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.description} onChange={e => updateField("description", e.target.value)} rows={3} placeholder="Product description..." label={"Description"} size="small" fullWidth multiline/></Box>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "1rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600" })}>Pricing</Typography></Box>
            <CardContent>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.purchase_price} onChange={e => updateField("purchase_price", e.target.value)} label={"Purchase Price (\u20B9)"} size="small" fullWidth/></Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.selling_price} onChange={e => updateField("selling_price", e.target.value)} label={"Selling Price (\u20B9)"} size="small" fullWidth/></Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.gst_percentage} onChange={e => updateField("gst_percentage", e.target.value)} label={"GST %"} size="small" fullWidth/></Box>
              </Box>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "1rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600" })}>Inventory</Typography></Box>
            <CardContent>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.stock_quantity} onChange={e => updateField("stock_quantity", e.target.value)} label={"Stock Quantity"} size="small" fullWidth/></Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.low_stock_threshold} onChange={e => updateField("low_stock_threshold", e.target.value)} label={"Low Stock Threshold"} size="small" fullWidth/></Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={form.unit} label={"Unit"} select size="small" fullWidth onChange={event => (v => updateField("unit", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{["pcs", "kg", "ltr", "mtr", "box", "set"].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}</TextField>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          {/* Product Image - Upload or URL */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "1rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600" })}>Product Image</Typography></Box>
            <CardContent>
              {form.image_url ? (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Box sx={{ aspectRatio: "1 / 1", borderRadius: "0.75rem", overflow: "hidden", borderWidth: "1px", backgroundColor: "hsl(var(--muted))" }}>
                    <Box src={form.image_url} alt="Product" component="img" sx={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                  </Box>
                  <Button onClick={() => updateField("image_url", "")} variant="outlined" size="small" sx={{ width: "100%" }}>Remove Image</Button>
                </Box>) : (<TabView defaultValue="upload">
                  <TabBar sx={{ width: "100%", height: "2rem", marginBottom: "0.75rem" }}>
                    <Tab value="upload" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Upload} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Upload</Box>} sx={{ flex: "1 1 0%", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                    <Tab value="url" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Link2} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>URL</Box>} sx={{ flex: "1 1 0%", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                  </TabBar>
                  <TabPanel value="upload">
                    <Box component="label" sx={{ cursor: "pointer", display: "block", borderWidth: "2px", borderStyle: "dashed", borderColor: "hsl(var(--border))", borderRadius: "0.75rem", padding: "1.5rem", textAlign: "center", "&:hover": { borderColor: "color-mix(in srgb, hsl(var(--primary)) 50%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                      <Box sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", borderRadius: "9999px", backgroundColor: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Box component={Upload} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--muted-foreground))" }}/>
                      </Box>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", marginTop: "0.5rem" }}>{uploading ? "Uploading..." : "Click to upload"}</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>JPG, PNG, WEBP</Typography>
                      <Box type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} component="input" sx={{ display: "none" }}/>
                    </Box>
                  </TabPanel>
                  <TabPanel value="url">
                    <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                      <TextField placeholder="https://example.com/image.jpg" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "https://example.com/image.jpg" } }}/>
                      <Button onClick={handleImageUrl} disabled={validatingUrl || !imageUrlInput.trim()} variant="outlined" sx={{ width: "100%" }}>
                        {validatingUrl ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Link2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}
                        {validatingUrl ? "Validating..." : "Use Image URL"}
                      </Button>
                    </Box>
                  </TabPanel>
                </TabView>)}
            </CardContent>
          </Card>

          {/* Category */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "1rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600" })}>Category</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <TextField value={form.category} select size="small" fullWidth onChange={event => (v => updateField("category", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select category"}</MenuItem>{categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.category} onChange={e => updateField("category", e.target.value)} placeholder="New category" label={"Or type a new category"} size="small" fullWidth/>
              </Box>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <CardContent sx={{ padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Button onClick={handleSave} disabled={loading} variant="contained" sx={{ width: "100%" }}>
                <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{isEdit ? "Update Product" : "Save Product"}
              </Button>
              <Button onClick={() => navigate("/inventory")} variant="outlined" sx={{ width: "100%" }}>
                <Box component={X} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Discard
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
