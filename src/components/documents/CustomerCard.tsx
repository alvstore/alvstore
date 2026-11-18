import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

  return (
    <div className="flex items-start gap-3">
      <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? "text-sm" : "text-base"} font-semibold text-foreground`}>{name}</p>
        {gstNumber && <p className="text-xs text-muted-foreground">GSTIN: {gstNumber}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
          {email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{email}</span>}
          {phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{phone}</span>}
          {address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{address}</span></span>}
        </div>
      </div>
    </div>
  );
}
