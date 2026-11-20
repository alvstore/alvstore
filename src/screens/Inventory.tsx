"use client";

import { Box, Button, Card, CardContent, IconButton, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, DataTable, DistributionWidget, FormDialog, PageHeader, SearchToolbar, StatCard, StatusChip, TabBar, TabPanel, TabView, confirmAction, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Pencil, Trash2, LayoutGrid, List, Package, AlertTriangle, Barcode, Printer, ArrowRightLeft, CheckCircle, XCircle } from "lucide-react";
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
function BarcodePreview({ value, productName }: {
    value: string;
    productName?: string;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, margin: 10, background: "#ffffff" });
            }
            catch { }
        }
    }, [value]);
    if (!value)
        return null;
    return (<Box sx={{ backgroundColor: "rgb(255 255 255 / 1)", borderRadius: "var(--radius)", borderWidth: "1px", padding: "0.75rem", textAlign: "center" }}>
      {productName && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem", fontWeight: "500" }}>{productName}</Typography>}
      <svg ref={svgRef}/>
    </Box>);
}
function printBarcode(barcodeValue: string, productName: string, sellingPrice: number) {
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow)
        return;
    const svgContainer = document.createElement("div");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgContainer.appendChild(svg);
    try {
        JsBarcode(svg, barcodeValue, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 12, margin: 5 });
    }
    catch {
        return;
    }
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
        if (search)
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
        if (categoryFilter !== "all")
            query = query.eq("category", categoryFilter);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else {
            let filtered = data || [];
            if (stockFilter === "low")
                filtered = filtered.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold);
            else if (stockFilter === "out")
                filtered = filtered.filter(p => p.stock_quantity <= 0);
            else if (stockFilter === "in")
                filtered = filtered.filter(p => p.stock_quantity > p.low_stock_threshold);
            setProducts(filtered);
            const cats = [...new Set((data || []).map(p => p.category).filter(Boolean))] as string[];
            setCategories(cats);
        }
        setLoading(false);
    };
    const fetchMovements = async () => {
        const { data, error } = await supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).limit(100);
        if (!error)
            setMovements(data || []);
    };
    useEffect(() => { fetchProducts(); }, [search, categoryFilter, stockFilter]);
    useEffect(() => { if (activeTab === "movements")
        fetchMovements(); }, [activeTab]);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("tab") === "movements")
            setActiveTab("movements");
    }, []);
    const handleDelete = async (id: string) => {
        if (!await confirmAction("Delete this product?"))
            return;
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Product deleted");
            fetchProducts();
        }
    };
    const isLowStock = (p: Product) => p.stock_quantity <= p.low_stock_threshold;
    const openBarcodeView = (p: Product) => { setBarcodeProduct(p); setBarcodeSheetOpen(true); };
    const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || productId;
    // KPI stats
    const totalProducts = products.length;
    const inStock = products.filter(p => p.stock_quantity > p.low_stock_threshold).length;
    const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length;
    const outOfStock = products.filter(p => p.stock_quantity <= 0).length;
    const categoryDistribution = Object.entries(products.reduce((acc, p) => {
        const cat = p.category || "Uncategorized";
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader title={"Products"} subtitle={"Manage your product catalog, barcode assignments, and stock inventory"} actions={<><Button onClick={() => navigate("/inventory/add")} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Add Product</Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard label="Total Products" value={loading ? "—" : totalProducts} icon={<Box component={Package} sx={{ height: 20, width: 20 }} />} accent="primary" loading={loading} />
        <StatCard label="In Stock" value={loading ? "—" : inStock} icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />} accent="success" loading={loading} />
        <StatCard label="Low Stock" value={loading ? "—" : lowStock} icon={<Box component={AlertTriangle} sx={{ height: 20, width: 20 }} />} accent="warning" loading={loading} />
        <StatCard label="Out of Stock" value={loading ? "—" : outOfStock} icon={<Box component={XCircle} sx={{ height: 20, width: 20 }} />} accent="error" loading={loading} />
      </Box>

      {categoryDistribution.length > 1 && (
        <DistributionWidget
          title="Product category distribution"
          subtitle="Inventory composition by product category."
          items={categoryDistribution}
          loading={loading}
          formatter={val => `${val} products`}
        />
      )}

      <TabView value={activeTab} onChange={setActiveTab}>
        <TabBar>
          <Tab value="products" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Package} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Products</Box>}/>
          <Tab value="movements" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={ArrowRightLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Stock Movements</Box>}/>
        </TabBar>

        <TabPanel value="products" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
          {/* Filters */}
          <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", flexWrap: "wrap" }}>
            <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search products..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
            <TextField value={categoryFilter} select size="small" fullWidth onChange={event => setCategoryFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "160px" }}><MenuItem value="" disabled>{"Category"}</MenuItem>
                <MenuItem value="all">All Categories</MenuItem>
                {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            <TextField value={stockFilter} select size="small" fullWidth onChange={event => setStockFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "160px" }}><MenuItem value="" disabled>{"Stock Status"}</MenuItem>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="in">In Stock</MenuItem>
                <MenuItem value="low">Low Stock</MenuItem>
                <MenuItem value="out">Out of Stock</MenuItem>
              </TextField>
            <Box sx={{ display: "flex", gap: "0.25rem", borderWidth: "1px", borderRadius: "var(--radius)", padding: "0.125rem" }}>
              <IconButton onClick={() => setViewMode("list")} aria-label={"List"}><Box component={List} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
              <IconButton onClick={() => setViewMode("grid")} aria-label={"Layout Grid"}><Box component={LayoutGrid} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
            </Box>
          </Box>

          {loading ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))" }}>Loading...</Box>) : products.length === 0 ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))" }}>
              <Box component={Package} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.3" }}/>
              <Typography component="p" variant="body1">No products found. Add your first product!</Typography>
            </Box>) : viewMode === "list" ? (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
              <DataTable columnsCount={6}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>SKU</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Stock</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ width: "8rem" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map(p => (<TableRow key={p.id} onClick={() => navigate(`/inventory/${p.id}/edit`)} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "var(--radius)", backgroundColor: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: "0" }}>
                            {p.image_url ? <Box src={p.image_url} alt="" component="img" sx={{ height: "100%", width: "100%", objectFit: "cover" }}/> : <Box component={Package} sx={{ height: "1rem", width: "1rem", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 50%, transparent)" }}/>}
                          </Box>
                          <Box>
                            <Typography component="p" variant="body1" sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{p.name}</Typography>
                            <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{p.category || "Uncategorized"}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{p.sku || "—"}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>{p.stock_quantity} {p.unit}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>₹{p.selling_price}</TableCell>
                      <TableCell>
                        {p.stock_quantity <= 0 ? (<StatusChip label={"Out of Stock"} variant="filled" sx={{ fontSize: "10px" }}/>) : isLowStock(p) ? (<StatusChip label={"Low Stock"} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))", fontSize: "10px" }}/>) : (<StatusChip label={"In Stock"} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", fontSize: "10px" }}/>)}
                      </TableCell>
                      <TableCell>
                        <Box onClick={e => e.stopPropagation()} sx={{ display: "flex", gap: "0.25rem" }}>
                          {p.barcode && (<IconButton onClick={() => openBarcodeView(p)} title="Barcode" aria-label={"Barcode"}>
                              <Box component={Barcode} sx={{ height: "1rem", width: "1rem" }}/>
                            </IconButton>)}
                          <IconButton onClick={() => navigate(`/inventory/${p.id}/edit`)} aria-label={"Pencil"}>
                            <Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/>
                          </IconButton>
                          <IconButton onClick={() => handleDelete(p.id)} aria-label={"Trash2"}>
                            <Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/>
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>))}
                </TableBody>
              </DataTable>
            </Box>) : (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, "@media (min-width: 1280px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
              {products.map(p => (<Card key={p.id} onClick={() => navigate(`/inventory/${p.id}/edit`)} sx={{ overflow: "hidden", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", cursor: "pointer" }}>
                  <Box sx={{ height: "9rem", backgroundColor: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.image_url ? <Box src={p.image_url} alt={p.name} component="img" sx={{ height: "100%", width: "100%", objectFit: "cover" }}/> : <Box component={Package} sx={{ height: "2.5rem", width: "2.5rem", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 30%, transparent)" }}/>}
                  </Box>
                  <CardContent sx={{ padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <Typography component="h3" variant="h3" sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25" }}>{p.name}</Typography>
                      {p.stock_quantity <= 0 ? (<StatusChip label={"Out"} variant="filled" sx={{ fontSize: "10px", flexShrink: "0" }}/>) : isLowStock(p) ? (<StatusChip label={"Low"} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))", fontSize: "10px", flexShrink: "0" }}/>) : (<StatusChip label={"In Stock"} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", fontSize: "10px", flexShrink: "0" }}/>)}
                    </Box>
                    {p.sku && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>SKU: {p.sku}</Typography>}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      <Box component="span" sx={{ fontWeight: "700" }}>₹{p.selling_price}</Box>
                      <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>{p.stock_quantity} {p.unit}</Box>
                    </Box>
                    <Box onClick={e => e.stopPropagation()} sx={{ display: "flex", gap: "0.25rem", paddingTop: "0.25rem" }}>
                      <Button onClick={() => navigate(`/inventory/${p.id}/edit`)} variant="outlined" size="small" sx={{ flex: "1 1 0%" }}>Edit</Button>
                      {p.barcode && <Button onClick={() => openBarcodeView(p)} variant="outlined" size="small"><Box component={Barcode} sx={{ height: "0.875rem", width: "0.875rem" }}/></Button>}
                      <Button onClick={() => handleDelete(p.id)} variant="outlined" size="small"><Box component={Trash2} sx={{ height: "0.875rem", width: "0.875rem", color: "hsl(var(--destructive))" }}/></Button>
                    </Box>
                  </CardContent>
                </Card>))}
            </Box>)}
        </TabPanel>

        <TabPanel value="movements" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
          <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
            <DataTable columnsCount={6} empty={movements.length === 0} emptyMessage={<>
                    <Box component={ArrowRightLeft} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.5rem", opacity: "0.3" }}/>No stock movements yet
                  </>}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Product</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell sx={{ textAlign: "right" }}>Quantity</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Reference</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{movements.map(m => (<TableRow key={m.id}>
                    <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{new Date(m.created_at).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell sx={{ fontWeight: "500" }}>{getProductName(m.product_id)}</TableCell>
                    <TableCell>
                      <StatusChip label={m.type} sx={m.type === "in" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : m.type === "out" ? { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }}/>
                    </TableCell>
                    <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>{m.quantity}</TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>{m.reference || "—"}</TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{m.notes || "—"}</TableCell>
                  </TableRow>))}</TableBody>
            </DataTable>
          </Box>
        </TabPanel>
      </TabView>

      {/* Barcode View/Print Sheet */}
      <FormDialog open={barcodeSheetOpen} onClose={() => setBarcodeSheetOpen(false)} title={"Product Barcode"} description={barcodeProduct?.name} paperSx={{ "@media (min-width: 640px)": { maxWidth: "28rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            {barcodeProduct?.barcode && (<>
                <BarcodePreview value={barcodeProduct.barcode} productName={barcodeProduct.name}/>
                <Typography component="p" variant="body1" sx={{ textAlign: "center", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>₹{barcodeProduct.selling_price}</Typography>
                <Button onClick={() => printBarcode(barcodeProduct.barcode!, barcodeProduct.name, barcodeProduct.selling_price)} variant="contained" sx={{ width: "100%" }}>
                  <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Print Barcode Label
                </Button>
              </>)}
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
