"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Alert, Box, CircularProgress, Snackbar, type AlertColor } from "@mui/material";

type Options = { duration?: number; description?: ReactNode };
type Notice = Options & { id: number; message: ReactNode; severity: AlertColor; loading?: boolean };
let notices: Notice[] = [];
let id = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => notices;
const empty: Notice[] = [];
const add = (message: ReactNode, severity: AlertColor = "info", loading = false, options?: Options) => {
  const key = ++id;
  notices = [...notices.slice(-4), { id: key, message, severity, loading, ...options }]; emit(); return key;
};
const dismiss = (key?: number) => { notices = key === undefined ? [] : notices.filter(n => n.id !== key); emit(); };
export const toast = Object.assign((message: ReactNode, options?: Options) => add(message, "info", false, options), {
  success: (message: ReactNode, options?: Options) => add(message, "success", false, options),
  error: (message: ReactNode, options?: Options) => add(message, "error", false, options),
  warning: (message: ReactNode, options?: Options) => add(message, "warning", false, options),
  info: (message: ReactNode, options?: Options) => add(message, "info", false, options),
  loading: (message: ReactNode) => add(message, "info", true),
  dismiss,
});
export function ToastProvider() {
  const messages = useSyncExternalStore(subscribe, snapshot, () => empty);
  const current = messages[0];
  return <Snackbar key={current?.id ?? "empty"} open={!!current} autoHideDuration={current?.loading ? null : current?.duration ?? 5000} anchorOrigin={{ vertical: "top", horizontal: "center" }} onClose={(_event, reason) => { if (reason !== "clickaway") dismiss(current?.id); }}>
    <Alert variant="filled" severity={current?.severity ?? "info"} onClose={() => dismiss(current?.id)} icon={current?.loading ? <CircularProgress size={18} color="inherit" /> : undefined} sx={{ maxWidth: "min(440px, 90vw)", alignItems: "center" }}>
      {current?.message}{current?.description && <Box sx={{ fontSize: 12, mt: 0.5, overflowWrap: "anywhere" }}>{current.description}</Box>}
    </Alert>
  </Snackbar>;
}
