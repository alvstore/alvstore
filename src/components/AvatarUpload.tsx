"use client";

import { Avatar, Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { mergeSx, toast } from "@/components/mui";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Loader2 } from "lucide-react";
interface AvatarUploadProps {
    currentUrl?: string | null;
    name: string;
    folder: string; // e.g. "employees", "customers", "technicians"
    entityId?: string;
    onUploaded: (url: string) => void;
    size?: "sm" | "md" | "lg";
}
const sizes = { sm: { height: "3rem", width: "3rem", fontSize: "0.875rem" }, md: { height: "4rem", width: "4rem", fontSize: "1.05rem" }, lg: { height: "5rem", width: "5rem", fontSize: "1.35rem" } };
const iconSizes = { sm: { height: "0.75rem", width: "0.75rem" }, md: { height: "1rem", width: "1rem" }, lg: { height: "1.25rem", width: "1.25rem" } };
export function AvatarUpload({ currentUrl, name, folder, entityId, onUploaded, size = "md" }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB");
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image");
            return;
        }
        setUploading(true);
        try {
            const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
            const safeEntity = (entityId || "user").replace(/[^a-zA-Z0-9_-]/g, "");
            const path = `${folder}/${safeEntity}_${Date.now()}_avatar.${ext}`;
            const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
            if (error)
                throw error;
            const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
            onUploaded(urlData.publicUrl);
            toast.success("Avatar uploaded");
        }
        catch (err: any) {
            toast.error(err.message || "Upload failed");
        }
        finally {
            setUploading(false);
            if (fileRef.current)
                fileRef.current.value = "";
        }
    };
    return (<Box
      role="button"
      tabIndex={0}
      aria-label={`Upload avatar for ${name || "user"}`}
      onClick={() => !uploading && fileRef.current?.click()}
      onKeyDown={e => {
        if ((e.key === "Enter" || e.key === " ") && !uploading) {
          e.preventDefault();
          fileRef.current?.click();
        }
      }}
      data-ui-group
      sx={{ position: "relative", display: "inline-flex", cursor: "pointer", borderRadius: "9999px" }}
    >
      <Box ref={fileRef} type="file" accept="image/*" onChange={handleUpload} component="input" sx={{ display: "none" }}/>
      <Avatar src={currentUrl ?? undefined} alt={name} sx={theme => ({ ...sizes[size], border: "2px solid", borderColor: alpha(theme.palette.primary.main, 0.34), backgroundColor: alpha(theme.palette.primary.main, 0.16), color: theme.palette.primary.main, fontWeight: 700, letterSpacing: "0.02em" })}>{initials}</Avatar>
      <Box sx={{ position: "absolute", inset: "0px", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--foreground)) 48%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", opacity: uploading ? "1" : "0", "[data-ui-group]:hover &, [data-ui-group]:focus-visible &": { opacity: "1" }, transitionProperty: "opacity", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
        {uploading ? <Box component={Loader2} sx={mergeSx(iconSizes[size], { color: "hsl(var(--background))", animation: "spin 1s linear infinite" })}/> : <Box component={Camera} sx={mergeSx(iconSizes[size], { color: "hsl(var(--background))" })}/>}
      </Box>
      <Box aria-hidden="true" sx={{ position: "absolute", right: "-2px", bottom: "-2px", height: "1.35rem", width: "1.35rem", borderRadius: "9999px", backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderWidth: "2px", borderColor: "hsl(var(--background))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgb(0 0 0 / 0.18)" }}>
        {uploading ? <Box component={Loader2} sx={{ height: "0.7rem", width: "0.7rem", animation: "spin 1s linear infinite" }}/> : <Box component={Camera} sx={{ height: "0.7rem", width: "0.7rem" }}/>}
      </Box>
    </Box>);
}
