"use client";

import { Box, Button, Card, IconButton, Tab, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, StatCard, TabBar, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ShoppingCart, Copy, Eye, FileText, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/documents/StatusBadge";
interface Quotation {
    id: string;
    quotation_number: string;
    status: string;
    subtotal: number;
    gst_amount: number;
    total: number;
    notes: string | null;
    terms: string | null;
    valid_until: string | null;
    public_token: string;
    customer_id: string | null;
    created_at: string;
    discount_type: string | null;
    discount_value: number | null;
    gst_inclusive: boolean | null;
    view_count: number | null;
    converted_invoice_id: string | null;
    signature_data: string | null;
    signature_name: string | null;
    customers?: {
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        gst_number: string | null;
    } | null;
}
export default function Sales() {
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const fetchQuotations = async () => {
        setLoading(true);
        let query = supabase.from("quotations").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
        if (statusFilter !== "all")
            query = query.eq("status", statusFilter as any);
        if (search)
            query = query.ilike("quotation_number", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setQuotations((data as any) || []);
        setLoading(false);
    };
    useEffect(() => { fetchQuotations(); }, [search, statusFilter]);
    const totalQuotations = quotations.length;
    const acceptedCount = quotations.filter(q => q.status === "accepted").length;
    const pendingCount = quotations.filter(q => q.status === "sent" || q.status === "draft").length;
    const totalValue = quotations.reduce((sum, q) => sum + (q.total || 0), 0);
    const copyPublicLink = (token: string) => {
        navigator.clipboard.writeText(`${window.location.origin}/sales/public/${token}`);
        toast.success("Link copied");
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Sales & Quotations"} subtitle={"Create, manage and convert quotations"} actions={<><Button onClick={() => navigate("/sales/new")} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> New Quotation</Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        {[
            { label: "Total Quotations", value: totalQuotations, icon: FileText, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" }, iconColor: { color: "hsl(var(--primary))" } },
            { label: "Accepted", value: acceptedCount, icon: CheckCircle, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" }, iconColor: { color: "hsl(var(--success))" } },
            { label: "Pending", value: pendingCount, icon: Clock, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)" }, iconColor: { color: "hsl(var(--warning))" } },
            { label: "Total Value", value: `₹${totalValue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }, iconColor: { color: "hsl(var(--accent))" } },
        ].map(kpi => (<StatCard label={kpi.label} value={kpi.value} icon={<Box component={kpi.icon} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, kpi.iconColor)}/>} key={kpi.label} sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}/>))}
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", alignItems: "flex-start" }}>
        <TabView value={statusFilter} onChange={setStatusFilter}>
          <TabBar>
            <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
            <Tab value="draft" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Draft</Box>}/>
            <Tab value="sent" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Sent</Box>}/>
            <Tab value="accepted" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Accepted</Box>}/>
            <Tab value="rejected" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Rejected</Box>}/>
          </TabBar>
        </TabView>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search quotations..." sx={{ maxWidth: "24rem" }}/>
      </Box>

      {/* Table */}
      <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", overflow: "hidden" }}>
        <DataTable columnsCount={7} loading={loading} empty={quotations.length === 0} emptyMessage={<>
                <Box component={ShoppingCart} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.2" }}/>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>No quotations found</Typography>
              </>}>
          <TableHead>
            <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>#ID</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Client</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Total</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Issued Date</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "center" }}>Views</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{quotations.map(q => (<TableRow key={q.id} onClick={() => navigate(`/sales/${q.id}`)} sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                <TableCell sx={{ fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))" }}>{q.quotation_number}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Box sx={{ height: "2rem", width: "2rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component="span" sx={{ fontSize: "11px", fontWeight: "600", color: "hsl(var(--primary))" }}>
                        {(q.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </Box>
                    </Box>
                    <Box sx={{ minWidth: "0px" }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.customers?.name || "—"}</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "none", "@media (min-width: 640px)": { display: "block" } }}>{q.customers?.email || ""}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell><StatusBadge status={q.status}/></TableCell>
                <TableCell sx={{ textAlign: "right", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                  {new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, textAlign: "center" }}>
                  <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", backgroundColor: "hsl(var(--muted))", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px" }}>{q.view_count || 0}</Box>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center", justifyContent: "flex-end" }}>
                    <IconButton onClick={() => copyPublicLink(q.public_token)} title="Copy link" aria-label={"Copy link"} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                      <Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/>
                    </IconButton>
                    <IconButton title="View" aria-label={"View"} component={"a"} href={`/sales/public/${q.public_token}`} target="_blank" sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}><Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                  </Box>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Card>
    </Box></AnimatedPage>;
}
