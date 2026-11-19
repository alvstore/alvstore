"use client";

import { useId, useState, cloneElement, type ReactElement, type ReactNode } from "react";
import { Box, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, useMediaQuery, type Breakpoint, type SxProps, type Theme } from "@mui/material";
import { Close } from "@mui/icons-material";

export interface FormDialogProps {
  open?: boolean; onClose?: () => void; onOpen?: () => void;
  title: ReactNode; description?: ReactNode; children?: ReactNode; actions?: ReactNode;
  trigger?: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
  maxWidth?: Breakpoint | false; paperSx?: SxProps<Theme>; busy?: boolean;
}

export function FormDialog({ open: controlled, onClose, onOpen, title, description, children, actions, trigger, maxWidth = "sm", paperSx, busy = false }: FormDialogProps) {
  const [internal, setInternal] = useState(false);
  const id = useId();
  const mobile = useMediaQuery((theme: Theme) => theme.breakpoints.down("sm"));
  const close = () => { if (!busy) { setInternal(false); onClose?.(); } };
  return <>
    {trigger && cloneElement(trigger, { onClick: event => { trigger.props.onClick?.(event); setInternal(true); onOpen?.(); } })}
    <Dialog open={controlled ?? internal} onClose={close} fullWidth fullScreen={mobile} maxWidth={maxWidth}
      aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
      slotProps={{ paper: { sx: [{ maxHeight: { sm: "90dvh" }, borderRadius: { xs: 0, sm: 3 } }, ...(Array.isArray(paperSx) ? paperSx : [paperSx])] } }}>
      <DialogTitle id={`${id}-title`} component="h2" sx={{ pr: 7, fontWeight: 700 }}>{title}</DialogTitle>
      <IconButton aria-label="Close dialog" disabled={busy} onClick={close} sx={{ position: "absolute", right: 12, top: 12 }}><Close fontSize="small" /></IconButton>
      <DialogContent dividers sx={{ overflowY: "auto" }}>
        {description && <DialogContentText id={`${id}-description`} sx={{ mb: 2, fontSize: 14 }}>{description}</DialogContentText>}
        <Box sx={{ minWidth: 0 }}>{children}</Box>
      </DialogContent>
      {actions && <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>{actions}</DialogActions>}
    </Dialog>
  </>;
}
