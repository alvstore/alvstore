"use client";

import { Box } from "@mui/material";
import { Navigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
export function ProtectedRoute({ children }: {
    children: React.ReactNode;
}) {
    const { session, loading } = useAuth();
    if (loading) {
        return (<Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))" }}>
        <Box sx={{ animation: "spin 1s linear infinite", height: "2rem", width: "2rem", borderWidth: "4px", borderColor: "hsl(var(--primary))", borderTopColor: "transparent", borderRadius: "9999px" }}/>
      </Box>);
    }
    if (!session) {
        return <Navigate to="/" replace/>;
    }
    return <>{children}</>;
}
