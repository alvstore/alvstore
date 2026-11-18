import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl?: string | null;
  name: string;
  folder: string; // e.g. "employees", "customers", "technicians"
  entityId?: string;
  onUploaded: (url: string) => void;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "h-12 w-12", md: "h-16 w-16", lg: "h-20 w-20" };
const iconSizes = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

export function AvatarUpload({ currentUrl, name, folder, entityId, onUploaded, size = "md" }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${entityId || Date.now()}_avatar.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
      onUploaded(urlData.publicUrl);
      toast.success("Avatar uploaded");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => !uploading && fileRef.current?.click()}>
      <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleUpload} />
      <Avatar className={`${sizes[size]} border-2 border-border`}>
        {currentUrl && <AvatarImage src={currentUrl} alt={name} />}
        <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">{initials}</AvatarFallback>
      </Avatar>
      <div className="absolute inset-0 rounded-full bg-foreground/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {uploading ? <Loader2 className={`${iconSizes[size]} text-background animate-spin`} /> : <Camera className={`${iconSizes[size]} text-background`} />}
      </div>
    </div>
  );
}
