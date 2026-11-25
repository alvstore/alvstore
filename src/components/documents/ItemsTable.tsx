"use client";

import { Box, Button, FormLabel, IconButton, MenuItem, Switch, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { DataTable } from "@/components/mui";
import { Trash2, Plus } from "lucide-react";
import { DocumentItemAdder } from "./DocumentItemAdder";
export interface DocumentItem {
    id?: string;
    product_id: string | null;
    product_name: string;
    description: string;
    hsn_code: string;
    quantity: number;
    unit_price: number;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    gst_percentage: number;
    gst_enabled: boolean;
    total: number;
    image_url?: string | null;
}
interface Product {
    id: string;
    name: string;
    description?: string | null;
    selling_price: number | null;
    gst_percentage: number | null;
}
interface ItemsTableProps {
    items: DocumentItem[];
    onItemsChange: (items: DocumentItem[]) => void;
    products: Product[];
    readOnly?: boolean;
}
export function calcItemTotal(item: DocumentItem): number {
    const lineTotal = item.quantity * item.unit_price;
    let discount = 0;
    if (item.discount_type === "percentage") {
        discount = lineTotal * (item.discount_value / 100);
    }
    else {
        discount = item.discount_value;
    }
    return Math.max(0, lineTotal - discount);
}
export function ItemsTable({ items, onItemsChange, products, readOnly }: ItemsTableProps) {
    const addItem = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product)
            return;
        const newItem: DocumentItem = {
            product_id: product.id,
            product_name: product.name,
            description: product.description || "",
            hsn_code: "",
            quantity: 1,
            unit_price: product.selling_price || 0,
            discount_type: "percentage",
            discount_value: 0,
            gst_percentage: product.gst_percentage || 18,
            gst_enabled: true,
            total: product.selling_price || 0,
        };
        onItemsChange([...items, newItem]);
    };
    const updateItem = (idx: number, updates: Partial<DocumentItem>) => {
        onItemsChange(items.map((item, i) => {
            if (i !== idx)
                return item;
            const updated = { ...item, ...updates };
            updated.total = calcItemTotal(updated);
            return updated;
        }));
    };
    const removeItem = (idx: number) => onItemsChange(items.filter((_, i) => i !== idx));
    const addCustomItem = () => {
        onItemsChange([
            ...items,
            {
                product_id: null,
                product_name: "Custom Item",
                description: "",
                hsn_code: "",
                quantity: 1,
                unit_price: 0,
                discount_type: "percentage",
                discount_value: 0,
                gst_percentage: 18,
                gst_enabled: true,
                total: 0,
            },
        ]);
    };
    if (readOnly) {
        return (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", overflow: "hidden" }}>
        <DataTable columnsCount={7}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" }}>
              <TableCell sx={{ width: "2.5rem", fontSize: "0.75rem", lineHeight: "1rem" }}>#</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>Item</TableCell>
              <TableCell sx={{ textAlign: "right", fontSize: "0.75rem", lineHeight: "1rem", width: "4rem" }}>Qty</TableCell>
              <TableCell sx={{ textAlign: "right", fontSize: "0.75rem", lineHeight: "1rem", width: "6rem" }}>Price</TableCell>
              <TableCell sx={{ textAlign: "right", fontSize: "0.75rem", lineHeight: "1rem", width: "5rem" }}>Disc.</TableCell>
              <TableCell sx={{ textAlign: "right", fontSize: "0.75rem", lineHeight: "1rem", width: "4rem" }}>GST%</TableCell>
              <TableCell sx={{ textAlign: "right", fontSize: "0.75rem", lineHeight: "1rem", width: "6rem" }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, idx) => (<TableRow key={idx}>
                <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{idx + 1}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                    {item.image_url && (<Box src={item.image_url} alt={item.product_name} component="img" sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "calc(var(--radius) - 2px)", objectFit: "cover", borderWidth: "1px", borderColor: "hsl(var(--border))", flexShrink: "0", marginTop: "0.125rem" }}/>)}
                    <Box>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{item.product_name}</Typography>
                      {item.description && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{item.description}</Typography>}
                      {item.hsn_code && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>HSN: {item.hsn_code}</Typography>}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{item.quantity}</TableCell>
                <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{item.unit_price.toFixed(2)}</TableCell>
                <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  {item.discount_value > 0
                    ? item.discount_type === "percentage" ? `${item.discount_value}%` : `₹${item.discount_value}`
                    : "—"}
                </TableCell>
                <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{item.gst_enabled ? `${item.gst_percentage}%` : "—"}</TableCell>
                <TableCell sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>₹{item.total.toFixed(2)}</TableCell>
              </TableRow>))}
          </TableBody>
        </DataTable>
      </Box>);
    }
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
      <DocumentItemAdder
        products={products}
        onSelectProduct={addItem}
        onAddCustomItem={addCustomItem}
        selectLabel="Line Items"
        emptyPlaceholder="+ Add product"
      />

      {items.length === 0 && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderStyle: "dashed", borderColor: "hsl(var(--border))", padding: "1.5rem", textAlign: "center" }}>
          <Box component={Plus} sx={{ height: "1.5rem", width: "1.5rem", marginLeft: "auto", marginRight: "auto", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 50%, transparent)", marginBottom: "0.25rem" }}/>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.75rem" }}>Add catalog or custom items to get started</Typography>
          <Button type="button" size="small" variant="outlined" onClick={addCustomItem} startIcon={<Box component={Plus} sx={{ width: 14, height: 14 }} />}>
            Add Custom Item
          </Button>
        </Box>)}

      {items.map((item, idx) => (<Box key={idx} sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.625rem" } }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
            <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
              {item.product_id ? (
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product_name}</Typography>
              ) : (
                <TextField
                  placeholder="Item or service name *"
                  value={item.product_name}
                  onChange={e => updateItem(idx, { product_name: e.target.value })}
                  size="small"
                  fullWidth
                  slotProps={{ htmlInput: { "aria-label": "Custom item name" } }}
                  sx={{ fontSize: "0.875rem", fontWeight: 600 }}
                />
              )}
              <TextField placeholder="Description (optional)" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Description (optional)" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", marginTop: "0.25rem" }}/>
            </Box>
            <IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"} sx={{ height: "1.75rem", width: "1.75rem", flexShrink: "0", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--destructive))" } }}>
              <Box component={Trash2} sx={{ height: "0.875rem", width: "0.875rem" }}/>
            </IconButton>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.5rem" }}>
            <Box>

              <TextField type="number" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} label={"Qty"} size="small" fullWidth slotProps={{ htmlInput: { min: "1" } }} sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}/>
            </Box>
            <Box>

              <TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} label={"Price"} size="small" fullWidth sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}/>
            </Box>
            <Box>
              <FormLabel sx={{ fontSize: "10px", textTransform: "uppercase", color: "hsl(var(--muted-foreground))" }}>Discount</FormLabel>
              <Box sx={{ display: "flex", gap: "0.25rem" }}>
                <TextField type="number" value={item.discount_value} onChange={e => updateItem(idx, { discount_value: parseFloat(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", flex: "1 1 0%" }}/>
                <TextField value={item.discount_type} select size="small" fullWidth onChange={event => (v => updateItem(idx, { discount_type: v as "percentage" | "fixed" }))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2rem", width: "3.5rem", fontSize: "0.75rem", lineHeight: "1rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                    <MenuItem value="percentage" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>%</MenuItem>
                    <MenuItem value="fixed" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>₹</MenuItem>
                  </TextField>
              </Box>
            </Box>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <FormLabel sx={{ fontSize: "10px", textTransform: "uppercase", color: "hsl(var(--muted-foreground))" }}>GST %</FormLabel>
                <Switch checked={item.gst_enabled} onChange={(event, checked) => (v => updateItem(idx, { gst_enabled: v }))(checked)} sx={{ height: "1rem", width: "1.75rem" }}/>
              </Box>
              <TextField type="number" value={item.gst_percentage} disabled={!item.gst_enabled} onChange={e => updateItem(idx, { gst_percentage: parseFloat(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem" }}/>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.25rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            {item.hsn_code || !readOnly ? (<TextField placeholder="HSN/SAC" value={item.hsn_code} onChange={e => updateItem(idx, { hsn_code: e.target.value })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "HSN/SAC" } }} sx={{ height: "1.5rem", fontSize: "0.75rem", lineHeight: "1rem", width: "6rem", borderWidth: "0px", paddingLeft: "0px", paddingRight: "0px", backgroundColor: "transparent" }}/>) : <Box component="span"/>}
            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>₹{item.total.toFixed(2)}</Typography>
          </Box>
        </Box>))}
    </Box>);
}
