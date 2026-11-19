"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { MotionConfig } from "framer-motion";
import { ErrorReporter } from "@/components/ErrorReporter";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider } from "@/hooks/useAuth";
import { MuiThemeBridge } from "@/components/MuiThemeBridge";
import { ToastProvider, ConfirmDialogHost } from "@/components/mui";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return <SessionProvider><QueryClientProvider client={queryClient}><ThemeProvider><MuiThemeBridge><MotionConfig reducedMotion="user"><AuthProvider>
    <ErrorReporter /><ToastProvider /><ConfirmDialogHost />{children}
  </AuthProvider></MotionConfig></MuiThemeBridge></ThemeProvider></QueryClientProvider></SessionProvider>;
}
