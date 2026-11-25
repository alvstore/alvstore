"use client";

import { Box, Button, MenuItem, TextField } from "@mui/material";
import { Plus } from "lucide-react";

export interface CatalogProductOption {
  id: string;
  name: string;
  selling_price?: number | null;
}

interface DocumentItemAdderProps {
  products: CatalogProductOption[];
  onSelectProduct: (productId: string) => void;
  onAddCustomItem: () => void;
  selectLabel?: string;
  emptyPlaceholder?: string;
  addCustomLabel?: string;
}

/**
 * Shared line-item picker for Invoice, Quotation, Delivery Challan, and ItemsTable.
 * Always keeps `+ Add Custom Item` enabled even when the catalog is empty.
 */
export function DocumentItemAdder({
  products,
  onSelectProduct,
  onAddCustomItem,
  selectLabel = "Line Items",
  emptyPlaceholder = "+ Add from Catalog",
  addCustomLabel = "Add Custom Item",
}: DocumentItemAdderProps) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
      <TextField
        label={selectLabel}
        select
        size="small"
        value=""
        onChange={event => {
          const val = event.target.value;
          if (val) onSelectProduct(val);
        }}
        slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        sx={{ minWidth: { xs: "100%", sm: "220px" }, fontSize: "0.75rem", lineHeight: "1rem" }}
      >
        <MenuItem value="" disabled>
          {products.length > 0 ? emptyPlaceholder : "No catalog products"}
        </MenuItem>
        {products.map(p => (
          <MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>
            {p.name} — ₹{Number(p.selling_price || 0).toLocaleString("en-IN")}
          </MenuItem>
        ))}
      </TextField>

      <Button
        type="button"
        onClick={onAddCustomItem}
        variant="outlined"
        size="small"
        startIcon={<Box component={Plus} sx={{ width: 14, height: 14 }} />}
        sx={{ minHeight: 38, whiteSpace: "nowrap" }}
      >
        {addCustomLabel}
      </Button>
    </Box>
  );
}
