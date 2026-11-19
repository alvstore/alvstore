"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Box, Button, ButtonBase, IconButton, LinearProgress, Skeleton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { addDays, addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { workloadMonth, type ScheduledTask } from "@/lib/workload-calendar";
import { localDateKey } from "@/lib/widget-data";

/** Compact Tendly-like month grid, grounded in the team's actual task due dates. */
export function WorkloadCalendar({ tasks, date, onDateChange, loading, index = 0, error, onRetry }: {
  tasks: ScheduledTask[]; date: Date; onDateChange: (date: Date) => void; loading?: boolean; index?: number;
} & WidgetFeedback) {
  const month = workloadMonth(tasks, date);
  const selected = localDateKey(date), today = localDateKey(new Date());
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const day = month.days.find(day => day.key === selected);
  useEffect(() => {
    if (pendingFocus.current) buttons.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [selected]);
  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, current: Date) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date;
    if (event.key in steps) next = addDays(current, steps[event.key]);
    else if (event.key === "Home") next = startOfMonth(current);
    else if (event.key === "End") next = endOfMonth(current);
    else if (event.key === "PageUp" || event.key === "PageDown") next = addMonths(current, event.key === "PageUp" ? -1 : 1);
    else return;
    event.preventDefault();
    pendingFocus.current = localDateKey(next);
    onDateChange(next);
  };
  return <WidgetCard title="Workload calendar" subtitle={format(date, "MMMM yyyy")} index={index} error={error} onRetry={onRetry}
    action={<Box sx={{ display: "flex", alignItems: "center", gap: .25 }}>
      <Tooltip title="Previous month"><IconButton size="small" aria-label="Previous workload month" onClick={() => onDateChange(addMonths(date, -1))}><ChevronLeft fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Next month"><IconButton size="small" aria-label="Next workload month" onClick={() => onDateChange(addMonths(date, 1))}><ChevronRight fontSize="small" /></IconButton></Tooltip>
    </Box>} footer="By task due date · completed status, not completion date">
    {loading ? <Box role="status" aria-label="Loading workload calendar"><Skeleton height={36} /><Skeleton variant="rounded" height={216} sx={{ mt: 1.5 }} /></Box> : <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.05em", fontVariantNumeric: "tabular-nums" }}>{month.completed}<Box component="span" sx={{ color: "text.secondary", fontSize: 15, fontWeight: 500 }}> / {month.total}</Box></Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>tasks completed</Typography>
      </Box>
      <LinearProgress variant="determinate" value={month.percent} aria-label="Monthly scheduled-task completion" sx={{ height: 4, borderRadius: 4, mb: 2 }} />
      <Box role="group" aria-label={`Tasks due in ${format(date, "MMMM yyyy")}`} sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: .5 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => <Typography key={index} aria-hidden="true" variant="caption" color="text.secondary" sx={{ textAlign: "center", fontSize: 9, mb: .5 }}>{label}</Typography>)}
        {Array.from({ length: month.offset }, (_, index) => <Box key={`blank-${index}`} aria-hidden="true" />)}
        {month.days.map(item => {
          const active = item.key === selected;
          return <ButtonBase key={item.key} ref={node => { if (node) buttons.current.set(item.key, node); else buttons.current.delete(item.key); }}
            data-workload-day={item.key} aria-pressed={active} aria-current={item.key === today ? "date" : undefined}
            aria-label={`${format(item.date, "EEEE d MMMM")}: ${item.total} tasks, ${item.completed} completed, ${item.open} open${item.overdue ? `, ${item.overdue} overdue` : ""}`}
            tabIndex={active ? 0 : -1} onClick={() => onDateChange(item.date)} onKeyDown={event => handleKey(event, item.date)}
            sx={theme => ({ minHeight: 36, borderRadius: "9px", display: "flex", flexDirection: "column", gap: .3, fontSize: 11, fontWeight: active ? 700 : 500,
              color: active ? theme.palette.primary.contrastText : item.total && !item.open ? theme.palette.success.main : theme.palette.text.secondary,
              bgcolor: active ? theme.palette.primary.main : item.total ? alpha(item.open ? theme.palette.primary.main : theme.palette.success.main, .1) : theme.palette.action.hover,
              boxShadow: item.key === today && !active ? `inset 0 0 0 1px ${theme.palette.primary.main}` : "none",
              transition: "background-color .2s, color .2s, box-shadow .2s", "&:hover": { bgcolor: active ? theme.palette.primary.dark : theme.palette.action.selected },
            })}>
            {item.day}<Box component="span" aria-hidden="true" sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: item.total ? item.overdue && !active ? "warning.main" : "currentColor" : "transparent" }} />
          </ButtonBase>;
        })}
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mt: 1.75 }}>
        {[{ label: "Open", color: "primary.main" }, { label: "Complete", color: "success.main" }, { label: "Overdue", color: "warning.main" }].map(item => <Box key={item.label} sx={{ display: "flex", gap: .5, alignItems: "center" }}><Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: item.color }} /><Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>{item.label}</Typography></Box>)}
      </Box>
      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="caption" color="text.secondary" aria-live="polite" sx={{ fontSize: 10 }}>{month.total === 0 ? "No tasks due this month" : `${day?.open ?? 0} open · ${format(date, "d MMM")}`}</Typography>
        <Button size="small" onClick={() => onDateChange(new Date())}>Today</Button>
      </Box>
    </>}
  </WidgetCard>;
}
