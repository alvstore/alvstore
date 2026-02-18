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
    if (externalSettings) { setSettings(externalSettings); return; }
    supabase.from("business_settings").select("company_name, company_address, company_email, company_phone, gst_number, logo_url").limit(1).single()
      .then(({ data }) => { if (data) setSettings(data); });
  }, [externalSettings]);

  if (!settings) return null;

  return (
    <div className={`flex items-start gap-4 ${compact ? "gap-3" : "gap-5"}`}>
      {settings.logo_url ? (
        <img src={settings.logo_url} alt="Logo" className={`${compact ? "h-10 w-10" : "h-14 w-14"} rounded-lg object-contain border border-border bg-card`} />
      ) : (
        <div className={`${compact ? "h-10 w-10" : "h-14 w-14"} rounded-lg bg-primary/10 flex items-center justify-center`}>
          <Building2 className={`${compact ? "h-5 w-5" : "h-7 w-7"} text-primary`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className={`${compact ? "text-base" : "text-lg"} font-bold text-foreground tracking-tight`}>
          {settings.company_name || "Your Business"}
        </h2>
        {settings.gst_number && (
          <p className="text-xs font-medium text-muted-foreground mt-0.5">GSTIN: {settings.gst_number}</p>
        )}
        <div className={`flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground ${compact ? "" : "mt-1.5"}`}>
          {settings.company_address && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{settings.company_address}</span>
          )}
          {settings.company_phone && (
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{settings.company_phone}</span>
          )}
          {settings.company_email && (
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{settings.company_email}</span>
          )}
        </div>
      </div>
    </div>
  );
}
