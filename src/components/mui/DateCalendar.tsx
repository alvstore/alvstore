"use client";

import { useRef, useState } from "react";
import { Box, ButtonBase, IconButton, Typography, type SxProps, type Theme } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";

/** Small MUI calendar with native-button keyboard navigation; no second widget library. */
export function DateCalendar({ selected, onSelect, month: controlledMonth, onMonthChange, disabled, sx }: {
  selected?: Date; onSelect?: (date: Date | undefined) => void; month?: Date; onMonthChange?: (date: Date) => void;
  disabled?: (date: Date) => boolean; sx?: SxProps<Theme>;
}) {
  const [internal, setInternal] = useState(selected ?? new Date());
  const month = controlledMonth ?? internal;
  const [focused, setFocused] = useState(selected ?? new Date());
  const root = useRef<HTMLDivElement>(null);
  const changeMonth = (next: Date) => { setInternal(next); onMonthChange?.(next); };
  const days: Date[] = [];
  for (let day = startOfWeek(startOfMonth(month)); day <= endOfWeek(endOfMonth(month)); day = addDays(day, 1)) days.push(day);
  const focusDay = (date: Date) => {
    setFocused(date);
    if (!isSameMonth(date, month)) changeMonth(date);
    requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-date="${format(date, "yyyy-MM-dd")}"]`)?.focus());
  };
  return <Box ref={root} sx={[{ width: "100%", minWidth: 220 }, ...(Array.isArray(sx) ? sx : [sx])]}>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
      <IconButton size="small" aria-label="Previous month" onClick={() => changeMonth(addMonths(month, -1))}><ChevronLeft fontSize="small" /></IconButton>
      <Typography variant="body2" aria-live="polite" sx={{ fontWeight: 650 }}>{format(month, "MMMM yyyy")}</Typography>
      <IconButton size="small" aria-label="Next month" onClick={() => changeMonth(addMonths(month, 1))}><ChevronRight fontSize="small" /></IconButton>
    </Box>
    <Box role="grid" aria-label={format(month, "MMMM yyyy")} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.25 }}>
      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <Typography role="columnheader" key={d} variant="caption" color="text.secondary" sx={{ textAlign: "center", py: 0.5 }}>{d}</Typography>)}
      {days.map(day => <ButtonBase role="gridcell" key={day.toISOString()} data-date={format(day, "yyyy-MM-dd")} tabIndex={isSameDay(day, focused) ? 0 : -1} aria-label={format(day, "EEEE, d MMMM yyyy")} aria-selected={!!selected && isSameDay(day, selected)} disabled={disabled?.(day)} onClick={() => { setFocused(day); onSelect?.(day); }}
        onKeyDown={event => {
          const offset: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -day.getDay(), End: 6 - day.getDay() };
          if (event.key in offset) { event.preventDefault(); focusDay(addDays(day, offset[event.key])); }
          if (["PageUp", "PageDown"].includes(event.key)) { event.preventDefault(); focusDay(addMonths(day, event.key === "PageUp" ? -1 : 1)); }
        }}
        sx={{ aspectRatio: "1", borderRadius: 2, fontSize: 12, opacity: isSameMonth(day, month) ? 1 : 0.4, bgcolor: selected && isSameDay(day, selected) ? "primary.main" : "transparent", color: selected && isSameDay(day, selected) ? "primary.contrastText" : "text.primary", "&:hover": { bgcolor: "action.hover" }, "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main" }, "&.Mui-disabled": { opacity: 0.2 } }}>{format(day, "d")}</ButtonBase>)}
    </Box>
  </Box>;
}
