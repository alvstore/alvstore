import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BusinessHeader } from "./BusinessHeader";
import { CustomerCard } from "./CustomerCard";
import { ItemsTable, type DocumentItem } from "./ItemsTable";
import { TotalsPanel } from "./TotalsPanel";
import { StatusBadge } from "./StatusBadge";
import { Printer, Download } from "lucide-react";

interface DocumentPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "quotation" | "invoice";
  number: string;
  status: string;
  customer: { name: string; email?: string | null; phone?: string | null; address?: string | null; gstNumber?: string | null } | null;
  items: DocumentItem[];
  gstInclusive: boolean;
  globalDiscountType: "percentage" | "fixed";
  globalDiscountValue: number;
  notes?: string | null;
  terms?: string | null;
  validUntil?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  signatureData?: string | null;
  signatureName?: string | null;
}

export function DocumentPreview({
  open, onOpenChange, type, number, status, customer, items,
  gstInclusive, globalDiscountType, globalDiscountValue,
  notes, terms, validUntil, dueDate, createdAt, signatureData, signatureName,
}: DocumentPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle>Preview</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Download className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 p-2 print-area" id="document-preview-content">
          <BusinessHeader />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {type === "quotation" ? "Quotation" : "Invoice"} {number}
              </h3>
              {createdAt && (
                <p className="text-xs text-muted-foreground">
                  Date: {new Date(createdAt).toLocaleDateString("en-IN")}
                </p>
              )}
              {validUntil && <p className="text-xs text-muted-foreground">Valid Until: {new Date(validUntil).toLocaleDateString("en-IN")}</p>}
              {dueDate && <p className="text-xs text-muted-foreground">Due: {new Date(dueDate).toLocaleDateString("en-IN")}</p>}
            </div>
            <StatusBadge status={status} />
          </div>

          {customer && (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bill To</p>
                <CustomerCard {...customer} compact />
              </div>
              <Separator />
            </>
          )}

          <ItemsTable items={items} onItemsChange={() => {}} products={[]} readOnly />

          <TotalsPanel
            items={items}
            gstInclusive={gstInclusive}
            globalDiscountType={globalDiscountType}
            globalDiscountValue={globalDiscountValue}
            readOnly
          />

          {notes && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Notes</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{notes}</p>
            </div>
          )}
          {terms && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Terms & Conditions</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{terms}</p>
            </div>
          )}

          {signatureData && (
            <div className="text-center pt-4">
              <img src={signatureData} alt="Signature" className="h-16 mx-auto" />
              {signatureName && <p className="text-sm font-medium mt-1">{signatureName}</p>}
              <p className="text-[10px] text-muted-foreground">Authorized Signature</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
