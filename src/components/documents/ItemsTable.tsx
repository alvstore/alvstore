import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";

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
  } else {
    discount = item.discount_value;
  }
  return Math.max(0, lineTotal - discount);
}

export function ItemsTable({ items, onItemsChange, products, readOnly }: ItemsTableProps) {
  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
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
      if (i !== idx) return item;
      const updated = { ...item, ...updates };
      updated.total = calcItemTotal(updated);
      return updated;
    }));
  };

  const removeItem = (idx: number) => onItemsChange(items.filter((_, i) => i !== idx));

  if (readOnly) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-xs">#</TableHead>
              <TableHead className="text-xs">Item</TableHead>
              <TableHead className="text-right text-xs w-16">Qty</TableHead>
              <TableHead className="text-right text-xs w-24">Price</TableHead>
              <TableHead className="text-right text-xs w-20">Disc.</TableHead>
              <TableHead className="text-right text-xs w-16">GST%</TableHead>
              <TableHead className="text-right text-xs w-24">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                <TableCell>
                  <div className="flex items-start gap-2.5">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.product_name} className="h-10 w-10 rounded-md object-cover border border-border shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.product_name}</p>
                      {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      {item.hsn_code && <p className="text-xs text-muted-foreground">HSN: {item.hsn_code}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                <TableCell className="text-right text-sm">₹{item.unit_price.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm">
                  {item.discount_value > 0
                    ? item.discount_type === "percentage" ? `${item.discount_value}%` : `₹${item.discount_value}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">{item.gst_enabled ? `${item.gst_percentage}%` : "—"}</TableCell>
                <TableCell className="text-right text-sm font-medium">₹{item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Line Items</Label>
        <Select onValueChange={addItem}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue placeholder="+ Add product" />
          </SelectTrigger>
          <SelectContent>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name} — ₹{p.selling_price}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Plus className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
          <p className="text-sm text-muted-foreground">Add products to get started</p>
        </div>
      )}

      {items.map((item, idx) => (
        <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{item.product_name}</p>
              <Input
                placeholder="Description (optional)"
                value={item.description}
                onChange={e => updateItem(idx, { description: e.target.value })}
                className="h-7 text-xs mt-1"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
              <Input type="number" min="1" className="h-8 text-sm" value={item.quantity}
                onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Price</Label>
              <Input type="number" className="h-8 text-sm" value={item.unit_price}
                onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Discount</Label>
              <div className="flex gap-1">
                <Input type="number" className="h-8 text-sm flex-1" value={item.discount_value}
                  onChange={e => updateItem(idx, { discount_value: parseFloat(e.target.value) || 0 })} />
                <Select value={item.discount_type} onValueChange={v => updateItem(idx, { discount_type: v as "percentage" | "fixed" })}>
                  <SelectTrigger className="h-8 w-14 text-xs px-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage" className="text-xs">%</SelectItem>
                    <SelectItem value="fixed" className="text-xs">₹</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase text-muted-foreground">GST %</Label>
                <Switch checked={item.gst_enabled} onCheckedChange={v => updateItem(idx, { gst_enabled: v })} className="h-4 w-7" />
              </div>
              <Input type="number" className="h-8 text-sm" value={item.gst_percentage} disabled={!item.gst_enabled}
                onChange={e => updateItem(idx, { gst_percentage: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            {item.hsn_code || !readOnly ? (
              <Input placeholder="HSN/SAC" value={item.hsn_code} onChange={e => updateItem(idx, { hsn_code: e.target.value })}
                className="h-6 text-xs w-24 border-0 px-0 bg-transparent" />
            ) : <span />}
            <p className="text-sm font-semibold text-foreground">₹{item.total.toFixed(2)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
