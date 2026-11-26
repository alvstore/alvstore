import { useEffect, useState } from "react";
import { Alert, Box, Button, Divider, Stack, TextField, Typography } from "@mui/material";
import { Check, Copy, FileDown, Mail, MessageCircle, Send } from "lucide-react";
import { SideDrawer, toast } from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { downloadDocumentPdf, type BrandedDocType } from "@/lib/document-pdf-client";

export interface SendDocumentDrawerProps {
  open: boolean;
  onClose: () => void;
  docType: BrandedDocType;
  docId: string;
  docNumber: string;
  customerName?: string | null;
  defaultEmail?: string | null;
  defaultPhone?: string | null;
  publicUrl?: string | null;
  totalLabel?: string | null;
  onEmailSent?: () => void;
}

const DOC_TITLES: Record<BrandedDocType, string> = {
  quotation: "Quotation",
  invoice: "Tax Invoice",
  challan: "Delivery Challan",
};

export function SendDocumentDrawer({
  open,
  onClose,
  docType,
  docId,
  docNumber,
  customerName,
  defaultEmail,
  defaultPhone,
  publicUrl,
  totalLabel,
  onEmailSent,
}: SendDocumentDrawerProps) {
  const docLabel = DOC_TITLES[docType];
  const [toEmail, setToEmail] = useState(defaultEmail || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setToEmail(defaultEmail || "");
    setSubject(`ALVStore ${docLabel} — ${docNumber}`);
    const greeting = `Hello ${customerName || "Customer"},`;
    const bodyText =
      docType === "quotation"
        ? `Please find attached our ${docLabel} (${docNumber})${totalLabel ? ` for ${totalLabel}` : ""}. You can review product details and accept or decline directly via the online link.`
        : docType === "challan"
        ? `Your ALVStore dispatch ${docLabel} (${docNumber}) has been generated. Track live delivery milestones and confirm proof of delivery online.`
        : `Please find attached your ${docLabel} (${docNumber})${totalLabel ? ` for ${totalLabel}` : ""} from ALVStore.`;
    setMessage(`${greeting}\n\n${bodyText}\n\nWarm regards,\nALVStore Team`);
  }, [open, docType, docLabel, docNumber, customerName, defaultEmail, totalLabel]);

  const handleSendEmail = async () => {
    setErrorMsg(null);
    const cleanTo = toEmail.trim();
    if (!cleanTo) {
      setErrorMsg("Recipient email is required.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: cleanTo,
          subject: subject.trim() || `ALVStore ${docLabel} — ${docNumber}`,
          body: message,
          plain_text: true,
          attach_document: { type: docType, id: docId },
          mark_sent: true,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Failed to send email");
      }
      toast.success(`${docLabel} PDF sent to ${cleanTo}`);
      onEmailSent?.();
      onClose();
    } catch (err) {
      const msg = (err as Error).message || "Email delivery failed";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const markQuotationSentIfDraft = () => {
    if (docType !== "quotation") return;
    void (supabase as any)
      .from("quotations")
      .update({ status: "sent" })
      .eq("id", docId)
      .eq("status", "draft")
      .then(() => {
        onEmailSent?.();
      });
  };

  const handleWhatsApp = () => {
    markQuotationSentIfDraft();
    const cleanPhone = (defaultPhone || "").replace(/[^0-9]/g, "");
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const shareText = [
      `Hello ${customerName || ""},`,
      `Your ALVStore ${docLabel} *${docNumber}*${totalLabel ? ` (${totalLabel})` : ""} is ready.`,
      publicUrl ? `View online: ${publicUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(shareText)}`
      : `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    markQuotationSentIfDraft();
    setCopied(true);
    toast.success("Public link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadDocumentPdf({ docType, id: docId, filename: `${docNumber}.pdf` });
      toast.success(`Downloaded ${docNumber}.pdf`);
    } catch (err) {
      toast.error((err as Error).message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={`Send ${docLabel} — ${docNumber}`}
      description="Deliver branded ALVStore A4 PDF via email, or share the live interactive link."
      width={480}
      footer={
        <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "space-between" }}>
          <Button
            variant="outlined"
            size="small"
            disabled={downloading}
            onClick={() => void handleDownloadPdf()}
            startIcon={<FileDown size={15} />}
          >
            {downloading ? "Generating..." : "Download PDF"}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={sending}
              onClick={() => void handleSendEmail()}
              startIcon={<Send size={15} />}
            >
              {sending ? "Sending PDF..." : "Send Email + PDF"}
            </Button>
          </Stack>
        </Stack>
      }
    >
      <Stack spacing={2}>
        {errorMsg && (
          <Alert severity="error" role="alert">
            {errorMsg}
          </Alert>
        )}

        <Alert severity="info" icon={<Mail size={16} />}>
          Attaches <strong>{docNumber}.pdf</strong> rendered with ALVStore branding and includes the direct customer action link.
        </Alert>

        <TextField
          fullWidth
          size="small"
          type="email"
          label="Recipient Email"
          placeholder="customer@example.com"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          label="Email Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={4}
          label="Message to Customer"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <Divider />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Instant Customer Share
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<MessageCircle size={15} />}
              onClick={handleWhatsApp}
            >
              WhatsApp Share
            </Button>
            {publicUrl && (
              <Button
                variant="outlined"
                fullWidth
                startIcon={copied ? <Check size={15} /> : <Copy size={15} />}
                onClick={() => void handleCopyLink()}
              >
                {copied ? "Copied Link" : "Copy Public Link"}
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    </SideDrawer>
  );
}
