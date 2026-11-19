"use client";

import { Box, Button } from "@mui/material";
import { mergeSx, toast } from "@/components/mui";
import { Eye, Download, Mail, MessageCircle, Copy, ArrowRightLeft, Send } from "lucide-react";
interface ActionButtonsProps {
    onPreview?: () => void;
    onDownload?: () => void;
    onSendEmail?: () => void;
    onSendWhatsApp?: () => void;
    onCopyLink?: () => void;
    onConvertToInvoice?: () => void;
    onSendReminder?: () => void;
    showConvert?: boolean;
    showReminder?: boolean;
    compact?: boolean;
}
export function ActionButtons({ onPreview, onDownload, onSendEmail, onSendWhatsApp, onCopyLink, onConvertToInvoice, onSendReminder, showConvert, showReminder, compact, }: ActionButtonsProps) {
    const size = compact ? "small" : "medium";
    const iconSx = compact ? { height: "0.875rem", width: "0.875rem" } : { height: "1rem", width: "1rem" };
    return (<Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {onPreview && (<Button onClick={onPreview} variant="outlined" size={size}>
          <Box component={Eye} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> Preview
        </Button>)}
      {onDownload && (<Button onClick={onDownload} variant="outlined" size={size}>
          <Box component={Download} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> PDF
        </Button>)}
      {onSendEmail && (<Button onClick={onSendEmail} variant="outlined" size={size}>
          <Box component={Mail} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> Email
        </Button>)}
      {onSendWhatsApp && (<Button onClick={onSendWhatsApp} variant="outlined" size={size} sx={{ color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" } }}>
          <Box component={MessageCircle} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> WhatsApp
        </Button>)}
      {onCopyLink && (<Button onClick={onCopyLink} variant="outlined" size={size}>
          <Box component={Copy} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> Copy Link
        </Button>)}
      {showConvert && onConvertToInvoice && (<Button onClick={onConvertToInvoice} variant="contained" size={size}>
          <Box component={ArrowRightLeft} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> Convert to Invoice
        </Button>)}
      {showReminder && onSendReminder && (<Button onClick={onSendReminder} variant="outlined" size={size}>
          <Box component={Send} sx={mergeSx(iconSx, { marginRight: "0.375rem" })}/> Send Reminder
        </Button>)}
    </Box>);
}
