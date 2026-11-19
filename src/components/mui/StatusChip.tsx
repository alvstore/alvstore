import { Chip, type ChipProps } from "@mui/material";
import { alpha } from "@mui/material/styles";

const colors: Record<string, "success" | "warning" | "error" | "info" | "primary" | "default"> = {
  paid: "success", active: "success", completed: "success", accepted: "success", approved: "success", delivered: "success",
  unpaid: "error", failed: "error", rejected: "error", overdue: "error", cancelled: "error",
  pending: "warning", partial: "warning", waiting_parts: "warning", pending_approval: "warning",
  sent: "info", in_progress: "info", assigned: "info", staff: "info", admin: "primary", technician: "warning", draft: "default",
};
export function StatusChip({ status, label, color, sx, ...props }: ChipProps & { status?: string }) {
  const resolved = color ?? colors[status ?? String(label).toLowerCase()] ?? "default";
  return <Chip size="small" color={resolved} variant="outlined" label={label ?? status?.replace(/_/g, " ")} {...props}
    sx={[{ height: 24, fontSize: 11, fontWeight: 600, textTransform: "capitalize", borderRadius: 1.5, ...(resolved !== "default" && { bgcolor: (theme: import("@mui/material").Theme) => alpha(theme.palette[resolved as "primary"].main, 0.08) }) }, ...(Array.isArray(sx) ? sx : [sx])]} />;
}
