"use client";

import { Box, Button, Divider, Typography } from "@mui/material";
import { SideDrawer } from "@/components/mui";
import { BusinessHeader } from "./BusinessHeader";
import { CustomerCard } from "./CustomerCard";
import { ItemsTable, type DocumentItem } from "./ItemsTable";
import { TotalsPanel } from "./TotalsPanel";
import { StatusBadge } from "./StatusBadge";
import { Printer, Download, Send, ExternalLink } from "lucide-react";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";

interface DocumentPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: "quotation" | "invoice" | "challan";
    docId?: string | null;
    publicToken?: string | null;
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
    showImages?: boolean;
    hidePricing?: boolean;
    gstInclusive: boolean;
    globalDiscountType: "percentage" | "fixed";
    globalDiscountValue: number;
    notes?: string | null;
    terms?: string | null;
    validUntil?: string | null;
    dueDate?: string | null;
    paymentTerms?: string | null;
    salespersonName?: string | null;
    createdAt?: string;
    signatureData?: string | null;
    signatureName?: string | null;
    challanMeta?: {
        challan_type?: string | null;
        courier_name?: string | null;
        tracking_number?: string | null;
        tracking_url?: string | null;
        eway_bill_number?: string | null;
        shipping_address?: string | null;
        delivery_person?: string | null;
        vehicle_number?: string | null;
    } | null;
    onSendClick?: () => void;
}
export function DocumentPreview({ open, onOpenChange, type, docId, publicToken, number, status, customer, items, showImages = true, hidePricing = false, gstInclusive, globalDiscountType, globalDiscountValue, notes, terms, validUntil, dueDate, paymentTerms, salespersonName, createdAt, signatureData, signatureName, challanMeta, onSendClick, }: DocumentPreviewProps) {
    const canServerPdf = Boolean(docId || publicToken);
    const titleLabel = type === "quotation" ? "Quotation" : type === "challan" ? "Delivery Challan" : "Tax Invoice";
    return (<SideDrawer open={open} onClose={() => onOpenChange(false)} title={`${titleLabel} Preview`} width={780} footer={<Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
              {onSendClick && (<Button onClick={onSendClick} variant="outlined" size="small" sx={{ minHeight: 36 }}>
                <Box component={Send} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.35rem" }}/> Send
              </Button>)}
              <Button onClick={() => window.print()} variant="outlined" size="small" sx={{ minHeight: 36 }}>
                <Box component={Printer} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.35rem" }}/> Print
              </Button>
              <Button onClick={() => canServerPdf ? void downloadDocumentPdf({ docType: type, id: docId, token: publicToken, filename: `${number || type}.pdf` }) : window.print()} variant="contained" size="small" sx={{ minHeight: 36 }}>
                <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.35rem" }}/> {canServerPdf ? "Download PDF" : "Save / Print PDF"}
              </Button>
            </Box>} paperSx={{ "@media print": { "--alv-shadow": "0 0 #0000", "--alv-shadow-colored": "0 0 #0000", boxShadow: "none" } }}>

        <Box id="document-preview-content" data-print-area sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" }, padding: "0.5rem" }}>
          <BusinessHeader />

          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <Box>
              <Typography component="h3" variant="h3" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>
                {titleLabel} {number || "(Draft)"}
              </Typography>
              {createdAt && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                  Date: {new Date(createdAt).toLocaleDateString("en-IN")}
                </Typography>)}
              {validUntil && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Valid Until: {new Date(validUntil).toLocaleDateString("en-IN")}</Typography>}
              {dueDate && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Due: {new Date(dueDate).toLocaleDateString("en-IN")}</Typography>}
              {paymentTerms && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Payment Terms: {paymentTerms}</Typography>}
              {salespersonName && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Salesperson: {salespersonName}</Typography>}
            </Box>
            <StatusBadge status={status}/>
          </Box>

          {customer && (<>
              <Box>
                <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>
                  {type === "challan" ? "Deliver To" : "Bill To"}
                </Typography>
                <CustomerCard {...customer} compact/>
              </Box>
              <Divider />
            </>)}

          {type === "challan" && challanMeta && (<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1, p: 1.5, borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))", bgcolor: "color-mix(in srgb, hsl(var(--muted)) 35%, transparent)" }}>
              {challanMeta.challan_type && (<Typography variant="caption">Type: <strong>{challanMeta.challan_type.replace(/_/g, " ").toUpperCase()}</strong></Typography>)}
              {challanMeta.courier_name && (<Typography variant="caption">Courier: <strong>{challanMeta.courier_name}</strong></Typography>)}
              {challanMeta.tracking_number && (<Typography variant="caption">AWB / Tracking: <strong>{challanMeta.tracking_number}</strong>{challanMeta.tracking_url ? (<Box component="a" href={challanMeta.tracking_url} target="_blank" rel="noopener noreferrer" sx={{ ml: 0.75, display: "inline-flex", alignItems: "center", color: "primary.main" }}><ExternalLink size={11}/></Box>) : null}</Typography>)}
              {challanMeta.eway_bill_number && (<Typography variant="caption">e-Way Bill: <strong>{challanMeta.eway_bill_number}</strong></Typography>)}
              {challanMeta.delivery_person && (<Typography variant="caption">Driver / Executive: <strong>{challanMeta.delivery_person}</strong></Typography>)}
              {challanMeta.vehicle_number && (<Typography variant="caption">Vehicle No: <strong>{challanMeta.vehicle_number}</strong></Typography>)}
              {challanMeta.shipping_address && (<Typography variant="caption" sx={{ gridColumn: { sm: "1 / -1" } }}>Shipping Address: <strong>{challanMeta.shipping_address}</strong></Typography>)}
            </Box>)}

          <ItemsTable items={items} onItemsChange={() => { }} products={[]} showImages={type === "invoice" ? false : showImages} hidePricing={hidePricing} readOnly/>

          {!hidePricing && (<TotalsPanel items={items} gstInclusive={gstInclusive} globalDiscountType={globalDiscountType} globalDiscountValue={globalDiscountValue} readOnly/>)}

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
      </SideDrawer>);
}
