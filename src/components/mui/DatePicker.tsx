"use client";

import { useState } from "react";
import { Box, Button, Popover, type SxProps, type Theme } from "@mui/material";
import { CalendarMonth } from "@mui/icons-material";
import { format } from "date-fns";
import { DateCalendar } from "./DateCalendar";

export function DatePicker({ selected, onSelect, disabled, sx }: {
  selected?: Date; onSelect: (date: Date | undefined) => void; disabled?: (date: Date) => boolean; sx?: SxProps<Theme>;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  return <Box sx={sx}>
    <Button variant="outlined" fullWidth startIcon={<CalendarMonth />} onClick={event => setAnchor(event.currentTarget)} sx={{ justifyContent: "flex-start" }} aria-haspopup="dialog" aria-expanded={!!anchor}>{selected ? format(selected, "PPP") : "Pick a date (optional)"}</Button>
    <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
      <Box role="dialog" aria-label="Choose date" sx={{ p: 2, width: 292 }}><DateCalendar selected={selected} onSelect={date => { onSelect(date); setAnchor(null); }} disabled={disabled} /></Box>
    </Popover>
  </Box>;
}
