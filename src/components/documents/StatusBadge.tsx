import { StatusChip } from "@/components/mui";
import type { SxProps, Theme } from "@mui/material";

export function StatusBadge({ status, sx }: { status: string; sx?: SxProps<Theme> }) {
  return <StatusChip status={status} sx={sx} />;
}
