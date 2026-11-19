"use client";

import { Box, Button, IconButton, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, FileText, Truck, CheckCircle2, Receipt, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
interface Challan {
    id: string;
    challan_number: string;
    status: string;
    notes: string | null;
    invoice_id: string | null;
    created_at: string;
    customer_id: string | null;
    customers?: {
        name: string;
    } | null;
}
const statusColors = {
    draft: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    sent: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    delivered: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    invoiced: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
};
export default function DeliveryChallans() {
    const navigate = useNavigate();
    const [challans, setChallans] = useState<Challan[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const fetchChallans = async () => {
        setLoading(true);
        const { data, error } = await (supabase as any)
            .from("delivery_challans").select("*, customers(name)")
            .order("created_at", { ascending: false });
        if (error)
            toast.error(error.message);
        else
            setChallans((data || []) as any);
        setLoading(false);
    };
    useEffect(() => { fetchChallans(); }, []);
    const filtered = challans.filter(c => {
        if (!search)
            return true;
        const q = search.toLowerCase();
        return c.challan_number.toLowerCase().includes(q) ||
            (c.customers as any)?.name?.toLowerCase().includes(q);
    });
    const stats = {
        total: challans.length,
        sent: challans.filter(c => c.status === "sent").length,
        delivered: challans.filter(c => c.status === "delivered").length,
        invoiced: challans.filter(c => c.status === "invoiced").length,
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Delivery Challans"} subtitle={"Track items sent before invoicing"} actions={<><Button onClick={() => navigate("/challans/new")} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Challan</Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total"} value={stats.total} icon={<Box component={FileText} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Sent"} value={stats.sent} icon={<Box component={Truck} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
        <StatCard label={"Delivered"} value={stats.delivered} icon={<Box component={CheckCircle2} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Invoiced"} value={stats.invoiced} icon={<Box component={Receipt} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
      </Box>

      <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search challans..." sx={{ maxWidth: "24rem" }}/>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={5} empty={filtered.length === 0} emptyMessage={"No challans found"}>
            <TableHead><TableRow>
              <TableCell>Challan #</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell sx={{ width: "5rem" }}>View</TableCell>
            </TableRow></TableHead>
            <TableBody>{filtered.map(c => (<TableRow key={c.id} onClick={() => navigate(`/challans/${c.id}`)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" } }}>
                  <TableCell sx={{ fontWeight: "500", fontFamily: "JetBrains Mono, monospace" }}>{c.challan_number}</TableCell>
                  <TableCell>{(c.customers as any)?.name || "—"}</TableCell>
                  <TableCell><StatusChip label={c.status} sx={statusColors[c.status] || { backgroundColor: "hsl(var(--muted))" }}/></TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <IconButton aria-label={"Arrow Up Right"}><Box component={ArrowUpRight} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                  </TableCell>
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}
    </Box></AnimatedPage>;
}
