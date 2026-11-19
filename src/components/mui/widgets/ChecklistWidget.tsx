"use client";

import { Box, Checkbox, CircularProgress, FormControlLabel, LinearProgress, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { EmptyState } from "../EmptyState";
import { completionPercent } from "@/lib/widget-data";

export type ChecklistItem = { id: string; title: string; completed: boolean; detail?: string; overdue?: boolean };
export function ChecklistWidget({ items, onToggle, pendingIds = [], loading, action, index = 0, error, onRetry, maxItems = 6 }: {
  items: ChecklistItem[]; onToggle: (id: string, completed: boolean) => void; pendingIds?: string[]; loading?: boolean; action?: ReactNode; index?: number; maxItems?: number;
} & WidgetFeedback) {
  const done = items.filter(item => item.completed).length;
  return <WidgetCard title="Today's focus" subtitle="Small steps. A clearer workday." action={action} index={index} error={error} onRetry={onRetry}>
    {loading ? <Box aria-label="Loading tasks" role="status">{Array.from({ length: 4 }, (_, id) => <Skeleton key={id} height={46} />)}</Box> : items.length === 0 ? <EmptyState title="A little room to breathe" description="No tasks due today or overdue. Add your next task to get started." sx={{ py: 4 }} /> : <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}><Typography variant="caption" color="text.secondary">{done} of {items.length} completed</Typography><Typography variant="caption" color="primary.main" sx={{ fontWeight: 650 }}>{Math.round(completionPercent(done, items.length))}%</Typography></Box>
      <LinearProgress variant="determinate" value={completionPercent(done, items.length)} aria-label="Today's task completion" sx={theme => ({ height: 5, borderRadius: 8, bgcolor: alpha(theme.palette.primary.main, .08), mb: 1.5, "& .MuiLinearProgress-bar": { borderRadius: 8, transition: "transform .5s cubic-bezier(.22,1,.36,1)" } })} />
      <Box>{items.slice(0, maxItems).map(item => <Box key={item.id} data-checklist-item={item.id} data-completed={item.completed} sx={theme => ({ display: "flex", alignItems: "center", gap: 1, py: .75, px: .5, borderRadius: 1.5, minHeight: 51, borderBottom: 1, borderColor: "divider", bgcolor: item.completed ? alpha(theme.palette.success.main, .045) : "transparent", transition: "background-color .2s, opacity .16s", opacity: pendingIds.includes(item.id) ? .65 : 1, "&:last-child": { borderBottom: 0 } })}>
        <Box sx={{ flex: 1, minWidth: 0 }}><FormControlLabel sx={{ m: 0, alignItems: "flex-start", width: "100%", "& .MuiCheckbox-root": { p: .5, mr: .75, mt: -.15 }, "& .MuiFormControlLabel-label": { minWidth: 0 } }}
          control={<Checkbox size="small" checked={item.completed} disabled={pendingIds.includes(item.id)} onChange={(_event, checked) => onToggle(item.id, checked)} />}
          label={<Box><Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500, lineHeight: 1.5, color: item.completed ? "text.secondary" : "text.primary", textDecoration: item.completed ? "line-through" : "none", transition: "color .16s" }}>{item.title}</Typography>
            {item.detail && <Typography variant="caption" color={item.overdue && !item.completed ? "warning.main" : "text.secondary"} sx={{ fontSize: 10 }}>{item.detail}</Typography>}</Box>} /></Box>
        {pendingIds.includes(item.id) && <CircularProgress size={13} aria-label={`Saving ${item.title}`} />}
      </Box>)}</Box>
      {items.length > maxItems && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>Showing {maxItems} of {items.length} tasks · view all in Task Management</Typography>}
    </>}
  </WidgetCard>;
}
