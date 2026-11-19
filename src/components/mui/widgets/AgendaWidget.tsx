"use client";

import { Box, ButtonBase, Chip, IconButton, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronLeft, ChevronRight, NorthEast } from "@mui/icons-material";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { WidgetCard, type WidgetFeedback } from "./WidgetCard";
import { EmptyState } from "../EmptyState";
import { SegmentedControl } from "../SegmentedControl";
import { localDateKey } from "@/lib/widget-data";
import { easeOut, motionTokens } from "@/lib/motion-presets";

export type AgendaItem = { id: string; title: string; date: string; allDay?: boolean; detail?: string; kind?: "event" | "task"; completed?: boolean };
export function AgendaWidget({ items, date, onDateChange, onOpen, loading, action, index = 0, error, onRetry }: {
  items: AgendaItem[]; date: Date; onDateChange: (date: Date) => void; onOpen?: (item: AgendaItem) => void;
  loading?: boolean; action?: ReactNode; index?: number;
} & WidgetFeedback) {
  const week = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  // Fixed appointments precede due-date-only tasks; a busy task board must
  // not hide the day's booked events behind the compact list's item limit.
  const selected = items.filter(item => localDateKey(item.date) === localDateKey(date)).sort((a, b) => Number(a.kind === "task") - Number(b.kind === "task") || a.date.localeCompare(b.date));
  const reduced = useReducedMotion();
  return <WidgetCard title="Your agenda" subtitle={format(date, "MMMM yyyy")} action={action} index={index} error={error} onRetry={onRetry}>
    <Box sx={{ display: "flex", alignItems: "center", gap: .5, mb: 2 }}>
      <IconButton size="small" aria-label="Previous week" onClick={() => onDateChange(addDays(date, -7))}><ChevronLeft fontSize="small" /></IconButton>
      <SegmentedControl value={localDateKey(date)} label="Agenda day" tone="brand" onChange={key => { const next = days.find(day => localDateKey(day) === key); if (next) onDateChange(next); }}
        sx={{ flex: 1, flexWrap: "nowrap", p: .25, bgcolor: "transparent", gap: .2, "& .MuiToggleButton-root": { p: .5, flex: 1, minHeight: 61 }, "& .MuiToggleButton-root[aria-pressed='false']": { border: "1px solid transparent" } }}
        options={days.map(day => ({ value: localDateKey(day), ariaLabel: format(day, "EEEE d MMMM"), label: <Box component="span" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: .65, color: "inherit", boxShadow: isSameDay(day, new Date()) && !isSameDay(day, date) ? "0 1px 0 currentColor" : "none" }}>
          <Typography component="span" variant="caption" sx={{ fontSize: 9, color: "inherit" }}>{format(day, "EEEEE")}</Typography>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600, fontSize: 12, color: "inherit" }}>{format(day, "d")}</Typography>
          <Box component="span" sx={{ width: 3, height: 3, borderRadius: "50%", bgcolor: items.some(item => localDateKey(item.date) === localDateKey(day)) ? "currentColor" : "transparent" }} />
        </Box> }))} />
      <IconButton size="small" aria-label="Next week" onClick={() => onDateChange(addDays(date, 7))}><ChevronRight fontSize="small" /></IconButton>
    </Box>
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1, gap: 1 }}><Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600 }}>{format(date, "EEEE, d MMM")}</Typography><Chip size="small" label={loading ? "Loading…" : `${selected.length} planned`} variant="outlined" sx={{ height: 20, fontSize: 9 }} /></Box>
    {loading ? <Box aria-label="Loading agenda" role="status"><Skeleton height={54} /><Skeleton height={54} /></Box> : <Box component={motion.div} key={localDateKey(date)} data-agenda-date={localDateKey(date)}
      initial={reduced ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : motionTokens.fast, ease: easeOut }}>
      {selected.length === 0 ? <EmptyState title="Nothing scheduled" description="Choose another day or add an event in Calendar." sx={{ py: 3 }} /> : <Box sx={{ display: "grid", gap: 1, pt: 1 }}>
        {selected.slice(0, 4).map(item => <ButtonBase key={item.id} onClick={() => onOpen?.(item)} disabled={!onOpen} sx={theme => ({ width: "100%", borderRadius: "12px", p: 1.25, display: "flex", gap: 1.25, justifyContent: "flex-start", textAlign: "left", bgcolor: alpha(item.completed ? theme.palette.success.main : theme.palette.primary.main, theme.palette.mode === "dark" ? .06 : .035), transition: "background-color .16s", "&:hover": { bgcolor: alpha(theme.palette.primary.main, .09) }, "&.Mui-disabled": { color: "inherit" } })}>
          <Box sx={{ width: 3, alignSelf: "stretch", borderRadius: 2, bgcolor: item.completed ? "success.main" : "primary.main", opacity: .6 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" noWrap sx={{ fontSize: 12, fontWeight: 550, textDecoration: item.completed ? "line-through" : "none" }}>{item.title}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{item.allDay ? item.kind === "task" ? "Task due" : "All day" : format(new Date(item.date), "h:mm a")}{item.detail ? ` · ${item.detail}` : ""}</Typography></Box>
          {onOpen && <NorthEast sx={{ fontSize: 13, color: "text.secondary" }} />}
        </ButtonBase>)}
        {selected.length > 4 && <Typography variant="caption" color="text.secondary">+{selected.length - 4} more in Tasks / Calendar</Typography>}
      </Box>}
    </Box>}
  </WidgetCard>;
}
