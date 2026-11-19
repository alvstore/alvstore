"use client";

import { Box } from "@mui/material";
import { AnimatedPage, PageHeader } from "@/components/mui";
import { useLocation } from "@/lib/router-compat";
import { Construction } from "lucide-react";
export default function ComingSoon() {
    const location = useLocation();
    const pageName = location.pathname.slice(1).replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Module";
    return <AnimatedPage><PageHeader title={pageName} subtitle={"This module is coming soon. We're building something amazing for you!"} actions={<><Box sx={{ padding: "1rem", borderRadius: "1rem", backgroundColor: "hsl(var(--muted))" }}>
        <Box component={Construction} sx={{ height: "2.5rem", width: "2.5rem", color: "hsl(var(--muted-foreground))" }}/>
      </Box></>}/></AnimatedPage>;
}
