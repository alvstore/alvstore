"use client";

import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Stack,
  Tab,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AnimatedPage,
  DataTable,
  MetricStrip,
  PageHeader,
  SearchToolbar,
  StatusChip,
  TabBar,
  TabView,
  toast,
} from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Truck,
  CheckCircle2,
  Receipt,
  Package,
  Copy,
  Download,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import { format } from "date-fns";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";

interface ChallanRow {
  id: string;
  challan_number: string;
  public_token: string | null;
  challan_type: string | null;
  status: string;
  courier_name: string | null;
  tracking_number: string | null;
  invoice_id: string | null;
  job_sheet_id: string | null;
  expected_delivery_at: string | null;
  created_at: string;
  customers?: { name: string } | null;
  invoices?: { invoice_number: string } | null;
}

const STATUS_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  draft: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
  packed: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)", color: "hsl(var(--primary))" },
  sent: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 12%, transparent)", color: "hsl(var(--info))" },
  dispatched: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 12%, transparent)", color: "hsl(var(--info))" },
  in_transit: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 14%, transparent)", color: "hsl(var(--info))" },
  out_for_delivery: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 15%, transparent)", color: "hsl(var(--warning))" },
  delivered: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)", color: "hsl(var(--success))" },
  invoiced: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)", color: "hsl(var(--primary))" },
  returned: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)", color: "hsl(var(--warning))" },
  cancelled: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 12%, transparent)", color: "hsl(var(--destructive))" },
};

export default function DeliveryChallans() {
  const navigate = useNavigate();
  const [challans, setChallans] = useState<ChallanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchChallans = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("delivery_challans")
        .select("*, customers(name), invoices(invoice_number)")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error(error.message);
      } else {
        setChallans((data || []) as ChallanRow[]);
      }
      setLoading(false);
    };
    void fetchChallans();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return challans.filter((c) => {
      if (statusFilter === "in_transit_group") {
        if (!["sent", "dispatched", "in_transit", "out_for_delivery"].includes(c.status)) return false;
      } else if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.challan_number.toLowerCase().includes(q) ||
        (c.customers?.name || "").toLowerCase().includes(q) ||
        (c.tracking_number || "").toLowerCase().includes(q) ||
        (c.courier_name || "").toLowerCase().includes(q)
      );
    });
  }, [challans, search, statusFilter]);

  const stats = useMemo(() => ({
    total: challans.length,
    packed: challans.filter((c) => c.status === "packed" || c.status === "draft").length,
    inTransit: challans.filter((c) => ["sent", "dispatched", "in_transit", "out_for_delivery"].includes(c.status)).length,
    delivered: challans.filter((c) => c.status === "delivered" || c.status === "invoiced").length,
    invoiced: challans.filter((c) => Boolean(c.invoice_id)).length,
  }), [challans]);

  const copyTrackingLink = async (token: string | null) => {
    if (!token) return;
    await navigator.clipboard.writeText(`${window.location.origin}/challan/public/${token}`);
    toast.success("Public tracking & POD link copied");
  };

  return (
    <AnimatedPage>
      <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <PageHeader
          title="Delivery Challans"
          subtitle="2026 dispatch tracking, AWB/e-Way Bill logistics, and contactless Proof of Delivery"
          actions={
            <Button onClick={() => navigate("/challans/new")} variant="contained">
              <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }} />
              New Challan
            </Button>
          }
        />

        <MetricStrip
          items={[
            { label: "Total Challans", value: stats.total, icon: <Package size={16} /> },
            { label: "Draft / Packed", value: stats.packed, icon: <Package size={16} /> },
            { label: "Out / In Transit", value: stats.inTransit, icon: <Truck size={16} /> },
            { label: "Delivered", value: stats.delivered, icon: <CheckCircle2 size={16} /> },
            { label: "Linked to Invoice", value: stats.invoiced, icon: <Receipt size={16} /> },
          ]}
        />

        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.5, alignItems: { md: "center" }, justifyContent: "space-between" }}>
          <TabView value={statusFilter} onChange={setStatusFilter}>
            <TabBar>
              <Tab value="all" label="All" />
              <Tab value="draft" label="Draft" />
              <Tab value="packed" label="Packed" />
              <Tab value="in_transit_group" label="In Transit" />
              <Tab value="delivered" label="Delivered" />
              <Tab value="returned" label="Returned" />
            </TabBar>
          </TabView>
          <SearchToolbar
            onSearch={setSearch}
            value={search}
            placeholder="Search challan #, customer, courier, AWB..."
            sx={{ maxWidth: 360, width: "100%" }}
          />
        </Box>

        <Card sx={{ overflow: "hidden" }}>
          <DataTable
            columnsCount={8}
            loading={loading}
            empty={!loading && filtered.length === 0}
            emptyMessage="No delivery challans match the current filter"
          >
            <TableHead>
              <TableRow>
                <TableCell>Challan #</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Logistics / AWB</TableCell>
                <TableCell>Billing</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => navigate(`/challans/${c.id}`)}
                  sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 40%, transparent)" } }}
                >
                  <TableCell sx={{ fontWeight: 700, color: "primary.main", fontFamily: "JetBrains Mono, monospace" }}>
                    {c.challan_number}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={(c.challan_type || "delivery").replace(/_/g, " ")}
                      sx={{ textTransform: "capitalize" }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {c.customers?.name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {c.courier_name || c.tracking_number ? (
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                          {c.courier_name || "Carrier"}
                        </Typography>
                        {c.tracking_number && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>
                            {c.tracking_number}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Hand delivery / TBD
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.invoice_id ? (
                      <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={c.invoices?.invoice_number || "Invoiced"}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/invoices/${c.invoice_id}`);
                        }}
                      />
                    ) : c.job_sheet_id ? (
                      <Chip size="small" label="Repair Handover" />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Unbilled
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      label={c.status.replace(/_/g, " ")}
                      sx={{ textTransform: "capitalize", ...(STATUS_STYLE[c.status] || { backgroundColor: "hsl(var(--muted))" }) }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {format(new Date(c.created_at), "dd MMM yyyy")}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.25} sx={{ justifyContent: "flex-end" }}>
                      <Tooltip title="Download Branded PDF">
                        <IconButton
                          size="small"
                          aria-label={`Download PDF ${c.challan_number}`}
                          onClick={() => void downloadDocumentPdf({ docType: "challan", id: c.id, filename: `${c.challan_number}.pdf` })}
                        >
                          <Download size={15} />
                        </IconButton>
                      </Tooltip>
                      {c.public_token && (
                        <>
                          <Tooltip title="Copy Tracking & POD Link">
                            <IconButton
                              size="small"
                              aria-label={`Copy tracking link ${c.challan_number}`}
                              onClick={() => void copyTrackingLink(c.public_token)}
                            >
                              <Copy size={15} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Open Live Tracker">
                            <IconButton
                              size="small"
                              aria-label={`Open live tracker ${c.challan_number}`}
                              component="a"
                              href={`/challan/public/${c.public_token}`}
                              target="_blank"
                            >
                              <ExternalLink size={15} />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip title="Open Details">
                        <IconButton size="small" aria-label={`Open ${c.challan_number}`} onClick={() => navigate(`/challans/${c.id}`)}>
                          <ArrowUpRight size={15} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </Card>
      </Box>
    </AnimatedPage>
  );
}
