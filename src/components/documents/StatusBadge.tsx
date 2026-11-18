import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  sent: { label: "Sent", className: "bg-info/10 text-info border-info/20" },
  accepted: { label: "Accepted", className: "bg-success/10 text-success border-success/20" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
  expired: { label: "Expired", className: "bg-warning/10 text-warning border-warning/20" },
  converted: { label: "Converted", className: "bg-accent/10 text-accent border-accent/20" },
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  unpaid: { label: "Unpaid", className: "bg-destructive/10 text-destructive border-destructive/20" },
  partial: { label: "Partial", className: "bg-warning/10 text-warning border-warning/20" },
  overdue: { label: "Overdue", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize border", config.className, className)}>
      {config.label}
    </Badge>
  );
}
