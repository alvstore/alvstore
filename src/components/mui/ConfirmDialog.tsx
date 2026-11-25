"use client";

import { useState, useSyncExternalStore } from "react";
import { Alert, Button } from "@mui/material";
import { SideDrawer } from "./SideDrawer";

export function ConfirmDialog({ open, title = "Confirm action", description, confirmLabel = "Delete", onConfirm, onClose }: {
  open: boolean; title?: string; description: string; confirmLabel?: string; onConfirm: () => void | Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <SideDrawer
      open={open}
      title={title}
      onClose={onClose}
      busy={busy}
      width={420}
      footer={
        <>
          <Button onClick={onClose} disabled={busy} variant="outlined" sx={{ minHeight: 36 }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            sx={{ minHeight: 36 }}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <Alert severity="warning">{description}</Alert>
    </SideDrawer>
  );
}

type Request = { message: string; resolve: (accepted: boolean) => void };
let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => queue[0] ?? null;
const serverSnapshot = () => null;

/** Promise-based replacement for blocking window.confirm, rendered by MUI. */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => { queue = [...queue, { message, resolve }]; emit(); });
}
export function ConfirmDialogHost() {
  const request = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const settle = (accepted: boolean) => { const current = queue[0]; queue = queue.slice(1); current?.resolve(accepted); emit(); };
  return <ConfirmDialog open={!!request} description={request?.message ?? ""} onConfirm={() => settle(true)} onClose={() => { if (queue[0] === request) settle(false); }} />;
}
