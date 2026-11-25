"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Autocomplete, Box, Button, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import { Add, ArrowForward, Search } from "@mui/icons-material";
import { SideDrawer } from "@/components/mui/SideDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/lib/router-compat";
import { navigationCommands } from "@/lib/navigation-commands";
import { navigationFor } from "./AppSidebar";

export interface CommandPaletteProps { open: boolean; onOpenChange: Dispatch<SetStateAction<boolean>>; }

/** The shared shell owns one dialog/listener, opened by header, sidebar or keyboard. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl K");
  const categories = navigationFor(hasRole);
  const options = useMemo(() => navigationCommands(categories), [categories]);
  useEffect(() => {
    setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K");
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.altKey && !event.defaultPrevented) {
        event.preventDefault();
        setQuery("");
        onOpenChange(current => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);
  useEffect(() => { if (open) setQuery(""); }, [open]);
  const show = () => onOpenChange(true);
  return <>
    <Button variant="outlined" aria-label="Search pages and actions" aria-haspopup="dialog" onClick={show} startIcon={<Search fontSize="small" />}
      sx={{ display: { xs: "none", md: "inline-flex" }, width: 320, minWidth: 0, justifyContent: "flex-start", borderColor: "divider", color: "text.secondary", bgcolor: "action.hover", fontWeight: 400 }}>
      <Box component="span" sx={{ flex: 1, textAlign: "left", fontSize: 12 }}>Search pages and actions…</Box>
      <Box component="kbd" sx={{ fontFamily: "inherit", fontSize: 10, px: .75, py: .25, border: 1, borderColor: "divider", borderRadius: 1, whiteSpace: "nowrap" }}>{shortcut}</Box>
    </Button>
    <IconButton aria-label="Search pages and actions" aria-haspopup="dialog" onClick={show} sx={{ display: { md: "none" } }}><Search fontSize="small" /></IconButton>
    <SideDrawer open={open} onClose={() => onOpenChange(false)} title="Quick navigation" description="Find a page or start a new workflow." width={480}>
      <Autocomplete open disablePortal autoHighlight value={null} options={options} groupBy={option => option.section}
        getOptionLabel={option => option.title} isOptionEqualToValue={(a, b) => a.id === b.id}
        inputValue={query} onInputChange={(_event, value) => setQuery(value)}
        onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onOpenChange(false); } }}
        onChange={(_event, option) => { if (option) { onOpenChange(false); navigate(option.url); } }}
        noOptionsText="No matching pages or actions"
        slotProps={{
          popper: { sx: { position: "static !important", transform: "none !important", width: "100% !important" } },
          paper: { elevation: 0, sx: { backgroundImage: "none", mt: 1 } },
          listbox: { "aria-label": "Matching pages and actions", sx: { maxHeight: { xs: "58dvh", sm: "65vh" }, p: .5, "& .MuiAutocomplete-groupLabel": { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", lineHeight: "34px", bgcolor: "background.paper" } } },
        }}
        renderInput={params => <TextField {...params} autoFocus placeholder="Search pages and actions…" size="small"
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, "aria-label": "Search navigation" }, input: { ...params.slotProps.input, startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }} />}
        renderOption={({ key, ...props }, option) => <Box component="li" key={key} {...props} sx={{ gap: 1.5, borderRadius: 1.5, minHeight: 42, fontSize: 13 }}>
          <Box sx={{ width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 1, bgcolor: "action.hover", color: option.action ? "primary.main" : "text.secondary" }}>{option.action ? <Add sx={{ fontSize: 16 }} /> : <ArrowForward sx={{ fontSize: 14 }} />}</Box>
          <Box component="span" sx={{ flex: 1 }}>{option.title}</Box>
        </Box>} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, fontSize: 10 }}>↑ ↓ to navigate · Enter to open · Esc to close</Typography>
    </SideDrawer>
  </>;
}
