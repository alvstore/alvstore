"use client";

import { Box, Typography } from "@mui/material";
import { mergeSx } from "@/components/mui";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Mail, Phone, MapPin } from "lucide-react";
interface BusinessSettings {
    company_name: string | null;
    company_address: string | null;
    company_email: string | null;
    company_phone: string | null;
    gst_number: string | null;
    logo_url: string | null;
}
interface BusinessHeaderProps {
    settings?: BusinessSettings | null;
    compact?: boolean;
}
export function BusinessHeader({ settings: externalSettings, compact }: BusinessHeaderProps) {
    const [settings, setSettings] = useState<BusinessSettings | null>(externalSettings || null);
    useEffect(() => {
        if (externalSettings) {
            setSettings(externalSettings);
            return;
        }
        supabase.from("business_settings").select("company_name, company_address, company_email, company_phone, gst_number, logo_url").limit(1).single()
            .then(({ data }) => { if (data)
            setSettings(data); });
    }, [externalSettings]);
    if (!settings)
        return null;
    return (<Box sx={mergeSx({ display: "flex", alignItems: "flex-start", gap: "1rem" }, compact ? { gap: "0.75rem" } : { gap: "1.25rem" })}>
      {settings.logo_url ? (<Box src={settings.logo_url} alt="Logo" component="img" sx={mergeSx(compact ? { height: "2.5rem", width: "2.5rem" } : { height: "3.5rem", width: "3.5rem" }, { borderRadius: "var(--radius)", objectFit: "contain", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))" })}/>) : (<Box sx={mergeSx(compact ? { height: "2.5rem", width: "2.5rem" } : { height: "3.5rem", width: "3.5rem" }, { borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" })}>
          <Box component={Building2} sx={mergeSx(compact ? { height: "1.25rem", width: "1.25rem" } : { height: "1.75rem", width: "1.75rem" }, { color: "hsl(var(--primary))" })}/>
        </Box>)}
      <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
        <Typography component="h2" variant="h2" sx={mergeSx(compact ? { fontSize: "1rem", lineHeight: "1.5rem" } : { fontSize: "1.125rem", lineHeight: "1.75rem" }, { fontWeight: "700", color: "hsl(var(--foreground))", letterSpacing: "-0.025em" })}>
          {settings.company_name || "Your Business"}
        </Typography>
        {settings.gst_number && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>GSTIN: {settings.gst_number}</Typography>)}
        <Box sx={mergeSx({ display: "flex", flexWrap: "wrap", columnGap: "1rem", rowGap: "0.125rem", marginTop: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }, compact ? {} : { marginTop: "0.375rem" })}>
          {settings.company_address && (<Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={MapPin} sx={{ height: "0.75rem", width: "0.75rem" }}/>{settings.company_address}</Box>)}
          {settings.company_phone && (<Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem" }}/>{settings.company_phone}</Box>)}
          {settings.company_email && (<Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Mail} sx={{ height: "0.75rem", width: "0.75rem" }}/>{settings.company_email}</Box>)}
        </Box>
      </Box>
    </Box>);
}
