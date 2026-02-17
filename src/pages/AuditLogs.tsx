import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Shield } from "lucide-react";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  action: string;
  module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: string | null;
  staff_name: string | null;
  user_role: string | null;
  created_at: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const fetchLogs = async () => {
    setLoading(true);
    // Combine from both audit tables
    const [finRes, sysRes] = await Promise.all([
      supabase.from("finance_audit_log").select("id, action, entity_type, entity_id, details, staff_name, user_role, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("system_audit_log").select("id, action, module, entity_type, entity_id, details, staff_name, user_role, created_at").order("created_at", { ascending: false }).limit(200),
    ]);

    const finLogs: AuditEntry[] = (finRes.data || []).map(l => ({ ...l, module: "finance" }));
    const sysLogs: AuditEntry[] = (sysRes.data || []).map(l => ({ ...l, module: l.module || "system" }));

    let combined = [...finLogs, ...sysLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (moduleFilter !== "all") combined = combined.filter(l => l.module === moduleFilter);
    if (search) combined = combined.filter(l =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()) ||
      l.staff_name?.toLowerCase().includes(search.toLowerCase())
    );

    setLogs(combined);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [search, moduleFilter]);

  const moduleColors: Record<string, string> = {
    finance: "bg-primary/10 text-primary",
    crm: "bg-info/10 text-info",
    sales: "bg-success/10 text-success",
    repair: "bg-warning/10 text-warning",
    system: "bg-muted text-muted-foreground",
    hrm: "bg-accent/10 text-accent-foreground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">Immutable record of all system actions</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search actions..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            <SelectItem value="finance">Finance</SelectItem>
            <SelectItem value="crm">CRM</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="repair">Repair</SelectItem>
            <SelectItem value="hrm">HRM</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden sm:table-cell">Staff</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />No audit logs found
              </TableCell></TableRow>
            ) : logs.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell>
                  <Badge className={moduleColors[l.module || "system"] || "bg-muted text-muted-foreground"}>
                    {l.module || "system"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{l.action}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm">{l.staff_name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">{l.details || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
