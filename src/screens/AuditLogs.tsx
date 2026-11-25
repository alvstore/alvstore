"use client";

import { Alert, Box, Button, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, StatusChip, toast } from "@/components/mui";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Printer, RefreshCw, Shield } from "lucide-react";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const [finRes, sysRes, jobRes] = await Promise.all([
      supabase
        .from("finance_audit_log")
        .select("id, action, entity_type, entity_id, details, staff_name, user_role, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("system_audit_log")
        .select("id, action, module, entity_type, entity_id, details, staff_name, user_role, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("job_sheet_audit_log")
        .select("id, job_sheet_id, action, details, user_role, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const errors = [finRes.error, sysRes.error, jobRes.error].filter(Boolean).map(e => e!.message);
    if (errors.length > 0 && !finRes.data && !sysRes.data && !jobRes.data) {
      setErrorMessage(errors[0]);
      toast.error(errors[0]);
      setLoading(false);
      return;
    }
    if (errors.length > 0) {
      setErrorMessage(`Partial load warning: ${errors.join(" · ")}`);
    }

    const finLogs: AuditEntry[] = (finRes.data || []).map(l => ({ ...l, module: "finance" }));
    const sysLogs: AuditEntry[] = (sysRes.data || []).map(l => ({ ...l, module: l.module || "system" }));
    const repairLogs: AuditEntry[] = (jobRes.data || []).map(l => ({
      id: `job-${l.id}`,
      action: l.action,
      module: "repair",
      entity_type: "job_sheet",
      entity_id: l.job_sheet_id,
      details: l.details,
      staff_name: l.user_role ? `Role: ${l.user_role}` : null,
      user_role: l.user_role,
      created_at: l.created_at,
    }));

    let combined = [...finLogs, ...sysLogs, ...repairLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (moduleFilter !== "all") {
      combined = combined.filter(l => l.module === moduleFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      combined = combined.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.details?.toLowerCase().includes(q) ||
          l.staff_name?.toLowerCase().includes(q) ||
          l.user_role?.toLowerCase().includes(q) ||
          l.entity_type?.toLowerCase().includes(q) ||
          l.entity_id?.toLowerCase().includes(q) ||
          l.module?.toLowerCase().includes(q) ||
          new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }).toLowerCase().includes(q)
      );
    }
    setLogs(combined);
    setLoading(false);
  }, [search, moduleFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const exportCSV = () => {
    if (logs.length === 0) {
      toast.error("No audit entries to export");
      return;
    }
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
    const csv =
      "Timestamp,Module,Action,Entity,Staff,Role,Details\n" +
      logs
        .map(l =>
          [
            esc(new Date(l.created_at).toISOString()),
            esc(l.module || "system"),
            esc(l.action),
            esc([l.entity_type, l.entity_id].filter(Boolean).join(":")),
            esc(l.staff_name || ""),
            esc(l.user_role || ""),
            esc(l.details || ""),
          ].join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alvstore-audit-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logs.length} audit entries`);
  };

  const moduleColors: Record<string, Record<string, string>> = {
    finance: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    crm: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    sales: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    repair: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    inventory: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    system: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    hrm: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
  };

  return (
    <AnimatedPage>
      <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <PageHeader
          title={"Audit Logs"}
          subtitle={"Immutable record of finance, repair, CRM, sales, and system actions"}
          actions={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", "@media print": { display: "none" } }}>
              <Button onClick={() => void fetchLogs()} variant="outlined" size="small" startIcon={<Box component={RefreshCw} sx={{ width: 14, height: 14 }} />}>
                Refresh
              </Button>
              <Button onClick={exportCSV} variant="outlined" size="small" startIcon={<Box component={Download} sx={{ width: 14, height: 14 }} />}>
                Export CSV
              </Button>
              <Button onClick={() => window.print()} variant="contained" size="small" startIcon={<Box component={Printer} sx={{ width: 14, height: 14 }} />}>
                Print Report
              </Button>
            </Box>
          }
        />

        {errorMessage && (
          <Alert severity="warning" variant="outlined">
            {errorMessage}
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", "@media print": { display: "none" } }}>
          <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search actions, staff, details..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }} />
          <TextField
            value={moduleFilter}
            select
            size="small"
            fullWidth
            onChange={event => setModuleFilter(event.target.value)}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            sx={{ width: { xs: "100%", sm: "170px" } }}
          >
            <MenuItem value="all">All Modules</MenuItem>
            <MenuItem value="finance">Finance</MenuItem>
            <MenuItem value="repair">Repair</MenuItem>
            <MenuItem value="sales">Sales</MenuItem>
            <MenuItem value="crm">CRM</MenuItem>
            <MenuItem value="inventory">Inventory</MenuItem>
            <MenuItem value="hrm">HRM</MenuItem>
            <MenuItem value="system">System</MenuItem>
          </TextField>
        </Box>

        <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable
            columnsCount={5}
            loading={loading}
            empty={logs.length === 0}
            emptyMessage={
              <>
                <Box component={Shield} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.5rem", opacity: "0.3" }} />
                No audit logs found
              </>
            }
          >
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Module</TableCell>
                <TableCell>Action</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Actor / Role</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                    {new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>
                    <StatusChip label={l.module || "system"} sx={moduleColors[l.module || "system"] || moduleColors.system} />
                  </TableCell>
                  <TableCell sx={{ fontWeight: "500" }}>{l.action.replace(/_/g, " ")}</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    {l.staff_name || l.user_role || "—"}
                  </TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.details || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </Box>
      </Box>
    </AnimatedPage>
  );
}
