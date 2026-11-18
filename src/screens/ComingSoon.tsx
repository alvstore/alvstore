import { useLocation } from "@/lib/router-compat";
import { Construction } from "lucide-react";

export default function ComingSoon() {
  const location = useLocation();
  const pageName = location.pathname.slice(1).replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Module";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
      <div className="p-4 rounded-2xl bg-muted">
        <Construction className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">{pageName}</h1>
      <p className="text-muted-foreground max-w-md">
        This module is coming soon. We're building something amazing for you!
      </p>
    </div>
  );
}
