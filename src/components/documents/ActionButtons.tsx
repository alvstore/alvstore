import { Button } from "@/components/ui/button";
import { Eye, Download, Mail, MessageCircle, Copy, ArrowRightLeft, Send } from "lucide-react";
import { toast } from "sonner";

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

export function ActionButtons({
  onPreview, onDownload, onSendEmail, onSendWhatsApp,
  onCopyLink, onConvertToInvoice, onSendReminder,
  showConvert, showReminder, compact,
}: ActionButtonsProps) {
  const size = compact ? "sm" : "default";
  const iconClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="flex flex-wrap gap-2">
      {onPreview && (
        <Button variant="outline" size={size} onClick={onPreview}>
          <Eye className={`${iconClass} mr-1.5`} /> Preview
        </Button>
      )}
      {onDownload && (
        <Button variant="outline" size={size} onClick={onDownload}>
          <Download className={`${iconClass} mr-1.5`} /> PDF
        </Button>
      )}
      {onSendEmail && (
        <Button variant="outline" size={size} onClick={onSendEmail}>
          <Mail className={`${iconClass} mr-1.5`} /> Email
        </Button>
      )}
      {onSendWhatsApp && (
        <Button variant="outline" size={size} onClick={onSendWhatsApp} className="text-success border-success/30 hover:bg-success/10">
          <MessageCircle className={`${iconClass} mr-1.5`} /> WhatsApp
        </Button>
      )}
      {onCopyLink && (
        <Button variant="outline" size={size} onClick={onCopyLink}>
          <Copy className={`${iconClass} mr-1.5`} /> Copy Link
        </Button>
      )}
      {showConvert && onConvertToInvoice && (
        <Button variant="default" size={size} onClick={onConvertToInvoice}>
          <ArrowRightLeft className={`${iconClass} mr-1.5`} /> Convert to Invoice
        </Button>
      )}
      {showReminder && onSendReminder && (
        <Button variant="outline" size={size} onClick={onSendReminder}>
          <Send className={`${iconClass} mr-1.5`} /> Send Reminder
        </Button>
      )}
    </div>
  );
}
