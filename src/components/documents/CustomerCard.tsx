"use client";

import { Avatar, Box, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { Mail, Phone, MapPin } from "lucide-react";
interface CustomerCardProps {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    gstNumber?: string | null;
    compact?: boolean;
}
export function CustomerCard({ name, email, phone, address, gstNumber, compact }: CustomerCardProps) {
    const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return (<Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
      <Avatar sx={mergeSx(compact ? { height: "2rem", width: "2rem" } : { height: "2.5rem", width: "2.5rem" }, { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600" })}>{initials}</Avatar>
      <Box sx={{ minWidth: "0px", flex: "1 1 0%" }}>
        <Typography component="p" variant="body1" sx={mergeSx(compact ? { fontSize: "0.875rem", lineHeight: "1.25rem" } : { fontSize: "1rem", lineHeight: "1.5rem" }, { fontWeight: "600", color: "hsl(var(--foreground))" })}>{name}</Typography>
        {gstNumber && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GSTIN: {gstNumber}</Typography>}
        <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: "0.75rem", rowGap: "0.125rem", marginTop: "0.125rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
          {email && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Mail} sx={{ height: "0.75rem", width: "0.75rem" }}/>{email}</Box>}
          {phone && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem" }}/>{phone}</Box>}
          {address && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={MapPin} sx={{ height: "0.75rem", width: "0.75rem", flexShrink: "0" }}/><Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</Box></Box>}
        </Box>
      </Box>
    </Box>);
}
