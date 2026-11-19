"use client";

import { Box, Button, Divider, Typography } from "@mui/material";
import { FormDialog } from "@/components/mui";
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
    customer: {
        name: string;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        gstNumber?: string | null;
    } | null;
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
export function DocumentPreview({ open, onOpenChange, type, number, status, customer, items, gstInclusive, globalDiscountType, globalDiscountValue, notes, terms, validUntil, dueDate, createdAt, signatureData, signatureName, }: DocumentPreviewProps) {
    return (<FormDialog open={open} onClose={() => onOpenChange(false)} title={"Preview"} paperSx={{ maxWidth: "48rem", maxHeight: "90vh", overflowY: "auto", "@media print": { "--alv-shadow": "0 0 #0000", "--alv-shadow-colored": "0 0 #0000", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" } }}>
        <Box sx={{ "@media print": { display: "none" } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <Button onClick={() => window.print()} variant="outlined" size="small">
                <Box component={Printer} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.25rem" }}/> Print
              </Button>
              <Button onClick={() => window.print()} variant="outlined" size="small">
                <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.25rem" }}/> PDF
              </Button>
            </Box>
          </Box>
        </Box>

        <Box id="document-preview-content" data-print-area sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" }, padding: "0.5rem" }}>
          <BusinessHeader />

          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <Box>
              <Typography component="h3" variant="h3" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>
                {type === "quotation" ? "Quotation" : "Invoice"} {number}
              </Typography>
              {createdAt && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                  Date: {new Date(createdAt).toLocaleDateString("en-IN")}
                </Typography>)}
              {validUntil && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Valid Until: {new Date(validUntil).toLocaleDateString("en-IN")}</Typography>}
              {dueDate && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Due: {new Date(dueDate).toLocaleDateString("en-IN")}</Typography>}
            </Box>
            <StatusBadge status={status}/>
          </Box>

          {customer && (<>
              <Box>
                <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Bill To</Typography>
                <CustomerCard {...customer} compact/>
              </Box>
              <Divider />
            </>)}

          <ItemsTable items={items} onItemsChange={() => { }} products={[]} readOnly/>

          <TotalsPanel items={items} gstInclusive={gstInclusive} globalDiscountType={globalDiscountType} globalDiscountValue={globalDiscountValue} readOnly/>

          {notes && (<Box>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--foreground))", marginBottom: "0.25rem" }}>Notes</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-line" }}>{notes}</Typography>
            </Box>)}
          {terms && (<Box>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--foreground))", marginBottom: "0.25rem" }}>Terms & Conditions</Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-line" }}>{terms}</Typography>
            </Box>)}

          {signatureData && (<Box sx={{ textAlign: "center", paddingTop: "1rem" }}>
              <Box src={signatureData} alt="Signature" component="img" sx={{ height: "4rem", marginLeft: "auto", marginRight: "auto" }}/>
              {signatureName && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", marginTop: "0.25rem" }}>{signatureName}</Typography>}
              <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>Authorized Signature</Typography>
            </Box>)}
        </Box>
      </FormDialog>);
}
