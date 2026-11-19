"use client";

import { Box, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Shield } from "lucide-react";
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
        if (moduleFilter !== "all")
            combined = combined.filter(l => l.module === moduleFilter);
        if (search) {
            const q = search.toLowerCase();
            combined = combined.filter(l => l.action.toLowerCase().includes(q) ||
                l.details?.toLowerCase().includes(q) ||
                l.staff_name?.toLowerCase().includes(q) ||
                l.user_role?.toLowerCase().includes(q) ||
                l.entity_type?.toLowerCase().includes(q) ||
                l.entity_id?.toLowerCase().includes(q) ||
                l.module?.toLowerCase().includes(q) ||
                new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }).toLowerCase().includes(q));
        }
        setLogs(combined);
        setLoading(false);
    };
    useEffect(() => { fetchLogs(); }, [search, moduleFilter]);
    const moduleColors = {
        finance: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
        crm: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
        sales: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
        repair: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
        system: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
        hrm: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Audit Logs"} subtitle={"Immutable record of all system actions"}/>

      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search actions..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={moduleFilter} select size="small" fullWidth onChange={event => setModuleFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "160px" }}>
            <MenuItem value="all">All Modules</MenuItem>
            <MenuItem value="finance">Finance</MenuItem>
            <MenuItem value="crm">CRM</MenuItem>
            <MenuItem value="sales">Sales</MenuItem>
            <MenuItem value="repair">Repair</MenuItem>
            <MenuItem value="hrm">HRM</MenuItem>
            <MenuItem value="system">System</MenuItem>
          </TextField>
      </Box>

      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={5} loading={loading} empty={logs.length === 0} emptyMessage={<>
                <Box component={Shield} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.5rem", opacity: "0.3" }}/>No audit logs found
              </>}>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Module</TableCell>
              <TableCell>Action</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Staff</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{logs.map(l => (<TableRow key={l.id}>
                <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>
                  {new Date(l.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                </TableCell>
                <TableCell>
                  <StatusChip label={l.module || "system"} sx={moduleColors[l.module || "system"] || { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
                </TableCell>
                <TableCell sx={{ fontWeight: "500" }}>{l.action}</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>{l.staff_name || "—"}</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.details || "—"}</TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Box>
    </Box></AnimatedPage>;
}
