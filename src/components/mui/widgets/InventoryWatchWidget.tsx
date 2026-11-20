"use client";

import { type ReactNode } from "react";
import { Box, Button, ButtonBase, Chip, LinearProgress, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CheckCircleOutlined, Inventory2Outlined, NorthEast, WarningAmberRounded } from "@mui/icons-material";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { EmptyState } from "../EmptyState";
import { useNavigate } from "@/lib/router-compat";
import { clampPercent } from "@/lib/widget-data";
import { controlFeedback } from "@/lib/motion-presets";

export interface LowStockItem {
  id: string;
  name: string;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string | null;
  selling_price?: number | null;
}

export function InventoryWatchWidget({
  items,
  loading = false,
  index = 0,
  action,
  error,
  onRetry,
}: {
  items: LowStockItem[];
  loading?: boolean;
  index?: number;
  action?: ReactNode;
} & WidgetFeedback) {
  const navigate = useNavigate();
  const title = "Inventory stock watch";
  const subtitle = "Items requiring reorder attention";

  return (
    <WidgetCard
      title={title}
      subtitle={subtitle}
      index={index}
      error={error}
      onRetry={onRetry}
      action={
        action ?? (
          <Button
            size="small"
            endIcon={<NorthEast sx={{ fontSize: 13 }} />}
            onClick={() => navigate("/inventory")}
          >
            Inventory
          </Button>
        )
      }
    >
      {loading ? (
        <Box role="status" aria-label="Loading inventory alerts" sx={{ display: "grid", gap: 1.5 }}>
          {Array.from({ length: 3 }, (_, idx) => (
            <Skeleton key={idx} variant="rounded" height={52} />
          ))}
        </Box>
      ) : !items.length ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: theme => alpha(theme.palette.success.main, 0.1),
              color: "success.main",
              display: "grid",
              placeItems: "center",
              mx: "auto",
              mb: 1.5,
            }}
          >
            <CheckCircleOutlined sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 650, mb: 0.5 }}>
            All catalog items healthy
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", maxWidth: 300, mx: "auto" }}>
            No products are currently at or below their low-stock reorder thresholds.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate("/inventory")}
            sx={{ mt: 2 }}
          >
            View product catalog
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "warning.main" }}>
              <WarningAmberRounded sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {items.length} item{items.length > 1 ? "s" : ""} need restock
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              Threshold comparison
            </Typography>
          </Box>
          {items.map(item => {
            const qty = Number(item.stock_quantity ?? 0);
            const low = Number(item.low_stock_threshold ?? 0);
            const isOutOfStock = qty <= 0;
            const threshold = Math.max(low, 1);
            const ratio = clampPercent((qty / threshold) * 100);
            const statusColor = isOutOfStock ? "error.main" : "warning.main";

            return (
              <ButtonBase
                key={item.id}
                onClick={() => navigate(`/inventory`)}
                sx={theme => ({
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.25,
                  borderRadius: 2,
                  textAlign: "left",
                  bgcolor: alpha(
                    isOutOfStock ? theme.palette.error.main : theme.palette.warning.main,
                    theme.palette.mode === "dark" ? 0.06 : 0.035
                  ),
                  border: `1px solid ${alpha(
                    isOutOfStock ? theme.palette.error.main : theme.palette.warning.main,
                    0.15
                  )}`,
                  gap: 1.5,
                  ...controlFeedback,
                })}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="body2" noWrap sx={{ fontSize: 12.5, fontWeight: 600 }}>
                      {item.name}
                    </Typography>
                    {item.category && (
                      <Chip
                        size="small"
                        label={item.category}
                        sx={{ height: 18, fontSize: 9.5, px: 0.25 }}
                      />
                    )}
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={ratio}
                    color={isOutOfStock ? "error" : "warning"}
                    aria-label={`${item.name} stock level`}
                    aria-valuenow={Math.round(ratio)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    sx={{ height: 4, borderRadius: 2, mt: 0.75, maxWidth: 160 }}
                  />
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: 12, fontWeight: 700, color: statusColor, fontVariantNumeric: "tabular-nums" }}
                  >
                    {isOutOfStock ? "Out of stock" : `${qty} in stock`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    Reorder at {low}
                  </Typography>
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
      )}
    </WidgetCard>
  );
}
