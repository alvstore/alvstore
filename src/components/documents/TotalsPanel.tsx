import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

export function calculateTotals(
  items: DocumentItem[],
  gstInclusive: boolean,
  globalDiscountType: "percentage" | "fixed",
  globalDiscountValue: number
) {
  const itemSubtotal = items.reduce((sum, i) => sum + i.total, 0);

  let globalDiscount = 0;
  if (globalDiscountType === "percentage") {
    globalDiscount = itemSubtotal * (globalDiscountValue / 100);
  } else {
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
  } else {
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

export function TotalsPanel({
  items, gstInclusive, onGstInclusiveChange,
  globalDiscountType, globalDiscountValue,
  onGlobalDiscountTypeChange, onGlobalDiscountValueChange,
  readOnly,
}: TotalsPanelProps) {
  const totals = calculateTotals(items, gstInclusive, globalDiscountType, globalDiscountValue);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {!readOnly && onGstInclusiveChange && (
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">GST Inclusive</Label>
          <Switch checked={gstInclusive} onCheckedChange={onGstInclusiveChange} />
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">₹{totals.itemSubtotal.toFixed(2)}</span>
        </div>

        {!readOnly && onGlobalDiscountValueChange ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs">Discount</span>
            <div className="flex gap-1 items-center">
              <Input type="number" className="h-7 w-20 text-xs text-right" value={globalDiscountValue}
                onChange={e => onGlobalDiscountValueChange(parseFloat(e.target.value) || 0)} />
              <Select value={globalDiscountType} onValueChange={v => onGlobalDiscountTypeChange?.(v as any)}>
                <SelectTrigger className="h-7 w-12 text-xs px-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage" className="text-xs">%</SelectItem>
                  <SelectItem value="fixed" className="text-xs">₹</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : totals.globalDiscount > 0 ? (
          <div className="flex justify-between text-success">
            <span>Discount</span>
            <span>-₹{totals.globalDiscount.toFixed(2)}</span>
          </div>
        ) : null}

        {totals.globalDiscount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">After Discount</span>
            <span>₹{totals.afterDiscount.toFixed(2)}</span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">CGST</span>
          <span>₹{totals.cgst.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">SGST</span>
          <span>₹{totals.sgst.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total GST</span>
          <span>₹{totals.gstAmount.toFixed(2)}</span>
        </div>

        <Separator />

        <div className="flex justify-between items-baseline">
          <span className="font-semibold text-foreground">Grand Total</span>
          <span className="text-xl font-bold text-foreground">₹{totals.grandTotal.toFixed(2)}</span>
        </div>

        {gstInclusive && (
          <p className="text-[10px] text-muted-foreground text-right">* Prices are inclusive of GST</p>
        )}
      </div>
    </div>
  );
}
