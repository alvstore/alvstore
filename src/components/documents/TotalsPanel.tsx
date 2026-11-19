"use client";

import { Box, Divider, FormLabel, MenuItem, Switch, TextField, Typography } from "@mui/material";
import type { DocumentItem } from "./ItemsTable";
interface TotalsPanelProps {
    items: DocumentItem[];
    gstInclusive: boolean;
    onGstInclusiveChange?: (v: boolean) => void;
    globalDiscountType: "percentage" | "fixed";
    globalDiscountValue: number;
    onGlobalDiscountTypeChange?: (v: "percentage" | "fixed") => void;
    onGlobalDiscountValueChange?: (v: number) => void;
    readOnly?: boolean;
}
export function calculateTotals(items: DocumentItem[], gstInclusive: boolean, globalDiscountType: "percentage" | "fixed", globalDiscountValue: number) {
    const itemSubtotal = items.reduce((sum, i) => sum + i.total, 0);
    let globalDiscount = 0;
    if (globalDiscountType === "percentage") {
        globalDiscount = itemSubtotal * (globalDiscountValue / 100);
    }
    else {
        globalDiscount = globalDiscountValue;
    }
    const afterDiscount = Math.max(0, itemSubtotal - globalDiscount);
    let gstAmount = 0;
    if (gstInclusive) {
        // GST is already included in the prices
        items.forEach(item => {
            if (item.gst_enabled) {
                const ratio = item.total / itemSubtotal;
                const itemAfterDiscount = afterDiscount * ratio;
                const gstRate = item.gst_percentage / 100;
                gstAmount += itemAfterDiscount - (itemAfterDiscount / (1 + gstRate));
            }
        });
    }
    else {
        items.forEach(item => {
            if (item.gst_enabled) {
                const ratio = item.total / (itemSubtotal || 1);
                const itemAfterDiscount = afterDiscount * ratio;
                gstAmount += itemAfterDiscount * (item.gst_percentage / 100);
            }
        });
    }
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    const grandTotal = gstInclusive ? afterDiscount : afterDiscount + gstAmount;
    return {
        itemSubtotal,
        globalDiscount,
        afterDiscount,
        gstAmount,
        cgst,
        sgst,
        grandTotal,
    };
}
export function TotalsPanel({ items, gstInclusive, onGstInclusiveChange, globalDiscountType, globalDiscountValue, onGlobalDiscountTypeChange, onGlobalDiscountValueChange, readOnly, }: TotalsPanelProps) {
    const totals = calculateTotals(items, gstInclusive, globalDiscountType, globalDiscountValue);
    return (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
      {!readOnly && onGstInclusiveChange && (<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>GST Inclusive</FormLabel>
          <Switch checked={gstInclusive} onChange={(event, checked) => onGstInclusiveChange(checked)}/>
        </Box>)}

      <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box>
          <Box component="span" sx={{ fontWeight: "500" }}>₹{totals.itemSubtotal.toFixed(2)}</Box>
        </Box>

        {!readOnly && onGlobalDiscountValueChange ? (<Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
            <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>Discount</Box>
            <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
              <TextField type="number" value={globalDiscountValue} onChange={e => onGlobalDiscountValueChange(parseFloat(e.target.value) || 0)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "1.75rem", width: "5rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "right" }}/>
              <TextField value={globalDiscountType} select size="small" fullWidth onChange={event => (v => onGlobalDiscountTypeChange?.(v as any))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", width: "3rem", fontSize: "0.75rem", lineHeight: "1rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                  <MenuItem value="percentage" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>%</MenuItem>
                  <MenuItem value="fixed" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>₹</MenuItem>
                </TextField>
            </Box>
          </Box>) : totals.globalDiscount > 0 ? (<Box sx={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
            <Box component="span">Discount</Box>
            <Box component="span">-₹{totals.globalDiscount.toFixed(2)}</Box>
          </Box>) : null}

        {totals.globalDiscount > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>After Discount</Box>
            <Box component="span">₹{totals.afterDiscount.toFixed(2)}</Box>
          </Box>)}

        <Divider />

        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}>
          <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>CGST</Box>
          <Box component="span">₹{totals.cgst.toFixed(2)}</Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}>
          <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>SGST</Box>
          <Box component="span">₹{totals.sgst.toFixed(2)}</Box>
        </Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}>
          <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Total GST</Box>
          <Box component="span">₹{totals.gstAmount.toFixed(2)}</Box>
        </Box>

        <Divider />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Box component="span" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>Grand Total</Box>
          <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>₹{totals.grandTotal.toFixed(2)}</Box>
        </Box>

        {gstInclusive && (<Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>* Prices are inclusive of GST</Typography>)}
      </Box>
    </Box>);
}
