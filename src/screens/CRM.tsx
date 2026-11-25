"use client";

import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AnimatedPage,
  DataTable,
  DistributionWidget,
  PageHeader,
  SearchToolbar,
  SegmentedControl,
  SideDrawer,
  StatCard,
  StatusChip,
  confirmAction,
  toast,
} from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  MapPin,
  Building2,
  Eye,
  Phone,
  Mail,
  FileText,
  Receipt,
  Wrench,
  Star,
  Copy,
  ExternalLink,
  X,
  CreditCard,
  User,
} from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import {
  parseCustomerMetadata,
  serializeCustomerNotes,
  type CustomerData,
} from "@/components/customers/CustomerQuickDialog";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_pincode?: string | null;
  notes: string | null;
  created_at: string;
  avatar_url?: string | null;
}

const emptyForm = {
  name: "",
  customer_type: "B2C" as "B2C" | "B2B",
  is_vip: false,
  phone: "",
  email: "",
  gst_number: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  shipping_address: "",
  shipping_city: "",
  shipping_state: "",
  shipping_pincode: "",
  credit_limit: "",
  notes: "",
  avatar_url: "",
};

export default function CRM() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "b2b" | "b2c" | "vip" | "gst">("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  // Quick view drawer state
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null);
  const [drawerStats, setDrawerStats] = useState<{ quotations: number; invoices: number; jobSheets: number } | null>(null);

  // Edit / Add modal state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch drawer statistics whenever drawer customer changes
  useEffect(() => {
    if (!drawerCustomer) {
      setDrawerStats(null);
      return;
    }
    let isCancelled = false;
    Promise.all([
      supabase.from("quotations").select("id", { count: "exact", head: true }).eq("customer_id", drawerCustomer.id),
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("customer_id", drawerCustomer.id),
      supabase.from("job_sheets").select("id", { count: "exact", head: true }).eq("customer_id", drawerCustomer.id),
    ]).then(([qRes, iRes, jRes]) => {
      if (!isCancelled) {
        setDrawerStats({
          quotations: qRes.count || 0,
          invoices: iRes.count || 0,
          jobSheets: jRes.count || 0,
        });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [drawerCustomer]);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    toast.success(`${label} copied to clipboard`);
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (c: Customer) => {
    const meta = parseCustomerMetadata(c.notes, c.gst_number);
    setEditId(c.id);
    setForm({
      name: c.name,
      customer_type: meta.customerType,
      is_vip: meta.isVIP,
      phone: c.phone || "",
      email: c.email || "",
      gst_number: c.gst_number || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      pincode: c.pincode || "",
      shipping_address: c.shipping_address || "",
      shipping_city: c.shipping_city || "",
      shipping_state: c.shipping_state || "",
      shipping_pincode: c.shipping_pincode || "",
      credit_limit: meta.creditLimit || "",
      notes: meta.cleanNotes || "",
      avatar_url: c.avatar_url || "",
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    const serializedNotes = serializeCustomerNotes(form.notes, form.is_vip, form.credit_limit);

    const payload = {
      name: trimmedName,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      gst_number: form.gst_number.trim().toUpperCase() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
      shipping_address: form.shipping_address.trim() || form.address.trim() || null,
      shipping_city: form.shipping_city.trim() || form.city.trim() || null,
      shipping_state: form.shipping_state.trim() || form.state.trim() || null,
      shipping_pincode: form.shipping_pincode.trim() || form.pincode.trim() || null,
      notes: serializedNotes,
    };

    if (editId) {
      const { error } = await supabase.from("customers").update(payload as any).eq("id", editId);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Customer profile updated");
        if (drawerCustomer && drawerCustomer.id === editId) {
          setDrawerCustomer((prev) => (prev ? { ...prev, ...payload } : null));
        }
      }
    } else {
      const { error } = await supabase.from("customers").insert({ ...payload, created_by: user?.id } as any);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Customer created successfully");
      }
    }
    setSheetOpen(false);
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Delete this customer? This cannot be undone."))) {
      return;
    }
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Customer deleted");
      if (drawerCustomer?.id === id) {
        setDrawerCustomer(null);
      }
      fetchCustomers();
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Metrics and breakdown
  const customersWithMeta = useMemo(() => {
    return customers.map((c) => {
      const meta = parseCustomerMetadata(c.notes, c.gst_number);
      return {
        ...c,
        meta,
      };
    });
  }, [customers]);

  const totalCustomers = customers.length;
  const b2bCount = customersWithMeta.filter((c) => c.meta.customerType === "B2B").length;
  const b2cCount = customersWithMeta.filter((c) => c.meta.customerType === "B2C").length;
  const vipCount = customersWithMeta.filter((c) => c.meta.isVIP).length;
  const withGST = customers.filter((c) => c.gst_number).length;

  const uniqueCities = useMemo(() => {
    const list = Array.from(new Set(customers.map((c) => c.city).filter(Boolean))) as string[];
    return list.sort();
  }, [customers]);

  const cityDistribution = useMemo(() => {
    return Object.entries(
      customers.reduce((acc, c) => {
        const city = c.city || "Other";
        acc[city] = (acc[city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [customers]);

  // Filtered dataset
  const filteredCustomers = useMemo(() => {
    return customersWithMeta.filter((c) => {
      if (filterType === "b2b" && c.meta.customerType !== "B2B") return false;
      if (filterType === "b2c" && c.meta.customerType !== "B2C") return false;
      if (filterType === "vip" && !c.meta.isVIP) return false;
      if (filterType === "gst" && !c.gst_number) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.gst_number?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [customersWithMeta, filterType, cityFilter, search]);

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gap: 3 }}>
        <PageHeader
          title="CRM & Customer Directory"
          subtitle="Manage customer relationships, B2B billing profiles, credit terms, and service workflows"
          actions={
            <Button onClick={openNew} variant="contained" startIcon={<Box component={Plus} sx={{ height: 16, width: 16 }} />}>
              Add Customer
            </Button>
          }
        />

        {/* Top KPI StatCards */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
          <StatCard
            label="Total Customers"
            value={totalCustomers}
            icon={<Box component={Users} sx={{ height: 20, width: 20 }} />}
            accent="primary"
            loading={loading}
          />
          <StatCard
            label="B2B Accounts"
            value={b2bCount}
            icon={<Box component={Building2} sx={{ height: 20, width: 20 }} />}
            accent="info"
            loading={loading}
          />
          <StatCard
            label="VIP Priority"
            value={vipCount}
            icon={<Box component={Star} sx={{ height: 20, width: 20 }} />}
            accent="warning"
            loading={loading}
          />
          <StatCard
            label="Active Cities"
            value={uniqueCities.length}
            icon={<Box component={MapPin} sx={{ height: 20, width: 20 }} />}
            accent="secondary"
            loading={loading}
          />
        </Box>

        {cityDistribution.length > 1 && (
          <DistributionWidget
            title="Customer geographic reach"
            subtitle="Customer concentration across cities and service territories."
            items={cityDistribution}
            loading={loading}
            formatter={(val) => `${val} clients`}
          />
        )}

        {/* Filter and Search Bar */}
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2, alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <SegmentedControl
              label="Customer directory filter"
              value={filterType}
              onChange={(val) => setFilterType(val as any)}
              options={[
                { value: "all", label: `All (${totalCustomers})` },
                { value: "b2b", label: `B2B (${b2bCount})` },
                { value: "b2c", label: `B2C (${b2cCount})` },
                { value: "vip", label: `VIP (${vipCount})` },
                { value: "gst", label: `GST (${withGST})` },
              ]}
            />

            {uniqueCities.length > 0 && (
              <TextField
                select
                size="small"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                sx={{ minWidth: 150 }}
                slotProps={{ select: { displayEmpty: true } }}
              >
                <MenuItem value="all">All Cities</MenuItem>
                {uniqueCities.map((city) => (
                  <MenuItem key={city} value={city}>
                    {city}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <SearchToolbar
            onSearch={(query) => setSearch(query)}
            value={search}
            placeholder="Search by name, phone, email, GSTIN, city..."
            sx={{ maxWidth: { xs: "100%", md: "24rem" }, width: "100%" }}
          />
        </Box>

        {/* Customers Data Table */}
        <Card sx={(theme) => ({ borderRadius: "18px", border: `1px solid ${theme.palette.divider}`, overflow: "hidden" })}>
          <DataTable
            columnsCount={6}
            loading={loading}
            empty={filteredCustomers.length === 0}
            emptyMessage={
              <Box sx={{ py: 3, textAlign: "center" }}>
                <Box component={Users} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  {search ? "No customers match your search criteria." : "No customers found in this category."}
                </Typography>
                <Button size="small" variant="outlined" onClick={openNew} sx={{ mt: 1.5 }} startIcon={<Box component={Plus} sx={{ width: 14, height: 14 }} />}>
                  Add Customer
                </Button>
              </Box>
            }
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Customer
                </TableCell>
                <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Classification & Terms
                </TableCell>
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Contact Info
                </TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Location
                </TableCell>
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  GSTIN
                </TableCell>
                <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", textAlign: "right" }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCustomers.map((c) => {
                const initials = (c.name || "CU").slice(0, 2).toUpperCase();
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => setDrawerCustomer(c)}
                    sx={(theme) => ({
                      "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
                      cursor: "pointer",
                      transition: "background-color 160ms ease",
                    })}
                  >
                    {/* Customer Name & Avatar */}
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar
                          src={c.avatar_url ?? undefined}
                          alt={c.name}
                          sx={(theme) => ({
                            height: "2.5rem",
                            width: "2.5rem",
                            border: `1px solid ${theme.palette.divider}`,
                            backgroundColor: c.meta.isVIP
                              ? alpha(theme.palette.warning.main, 0.15)
                              : alpha(theme.palette.primary.main, 0.1),
                            color: c.meta.isVIP ? "warning.main" : "primary.main",
                            fontSize: "0.8125rem",
                            fontWeight: 700,
                          })}
                        >
                          {initials}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.name}
                            </Typography>
                            {c.meta.isVIP && (
                              <Tooltip title="VIP Priority Customer">
                                <Box component={Star} sx={{ width: 14, height: 14, color: "warning.main", fill: "currentColor", flexShrink: 0 }} />
                              </Tooltip>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { sm: "none" }, fontSize: "11px" }}>
                            {[c.phone, c.city].filter(Boolean).join(" · ")}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Classification & Terms */}
                    <TableCell>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                        <Chip
                          size="small"
                          label={c.meta.customerType}
                          color={c.meta.customerType === "B2B" ? "primary" : "default"}
                          variant={c.meta.customerType === "B2B" ? "filled" : "outlined"}
                          sx={{ fontSize: "10.5px", height: "20px", fontWeight: 700 }}
                        />
                        {c.meta.creditLimit && (
                          <Chip
                            size="small"
                            label={`Limit: ${c.meta.creditLimit}`}
                            variant="outlined"
                            sx={{ fontSize: "10px", height: "20px", color: "text.secondary" }}
                          />
                        )}
                        {c.meta.isVIP && (
                          <Chip
                            size="small"
                            label="VIP"
                            color="warning"
                            sx={{ fontSize: "10px", height: "20px", fontWeight: 700 }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* Contact Info */}
                    <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        {c.phone ? (
                          <Box
                            component="span"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(c.phone!, "Phone number");
                            }}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              fontSize: "0.8125rem",
                              color: "text.primary",
                              cursor: "pointer",
                              "&:hover": { color: "primary.main" },
                            }}
                          >
                            <Box component={Phone} sx={{ width: 12, height: 12, color: "text.secondary" }} />
                            {c.phone}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            —
                          </Typography>
                        )}
                        {c.email && (
                          <Box
                            component="span"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(c.email!, "Email address");
                            }}
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                              fontSize: "0.75rem",
                              color: "text.secondary",
                              cursor: "pointer",
                              "&:hover": { color: "primary.main" },
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 180,
                            }}
                          >
                            <Box component={Mail} sx={{ width: 11, height: 11 }} />
                            {c.email}
                          </Box>
                        )}
                      </Box>
                    </TableCell>

                    {/* Location */}
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                      {c.city ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.8125rem", color: "text.secondary" }}>
                          <Box component={MapPin} sx={{ width: 13, height: 13, flexShrink: 0 }} />
                          <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                            {[c.city, c.state].filter(Boolean).join(", ")}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* GSTIN */}
                    <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                      {c.gst_number ? (
                        <Box
                          component="span"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(c.gst_number!, "GSTIN");
                          }}
                          sx={(theme) => ({
                            fontSize: "0.75rem",
                            fontFamily: "monospace",
                            backgroundColor: alpha(theme.palette.text.primary, 0.06),
                            px: 1,
                            py: 0.25,
                            borderRadius: "4px",
                            color: "text.primary",
                            cursor: "pointer",
                            "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.1), color: "primary.main" },
                          })}
                        >
                          {c.gst_number}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>

                    {/* Row Actions */}
                    <TableCell>
                      <Box onClick={(e) => e.stopPropagation()} sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                        <Tooltip title="Quick View & Actions">
                          <IconButton
                            onClick={() => setDrawerCustomer(c)}
                            size="small"
                            aria-label="View Customer"
                            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <Box component={Eye} sx={{ height: 16, width: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="New Quotation">
                          <IconButton
                            onClick={() => navigate(`/sales/new?customerId=${c.id}`)}
                            size="small"
                            aria-label="New Quotation"
                            sx={{ color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <Box component={FileText} sx={{ height: 16, width: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Customer">
                          <IconButton
                            onClick={() => openEdit(c)}
                            size="small"
                            aria-label="Edit Customer"
                            sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                          >
                            <Box component={Pencil} sx={{ height: 16, width: 16 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => handleDelete(c.id)}
                            size="small"
                            aria-label="Delete Customer"
                            sx={{ color: "text.secondary", "&:hover": { color: "error.main" } }}
                          >
                            <Box component={Trash2} sx={{ height: 16, width: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </Card>

        {/* Customer Detail Drawer (Slide-out Inspector) */}
        <Drawer
          anchor="right"
          open={!!drawerCustomer}
          onClose={() => setDrawerCustomer(null)}
          slotProps={{
            backdrop: { sx: { backgroundColor: "rgba(0, 0, 0, 0.4)" } },
            paper: {
              sx: {
                width: { xs: "100%", sm: 460 },
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                overflowY: "auto",
              },
            },
          }}
        >
          {drawerCustomer && (
            <>
              {/* Drawer Header */}
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Avatar
                    sx={(theme) => ({
                      width: 52,
                      height: 52,
                      backgroundColor: parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).isVIP
                        ? alpha(theme.palette.warning.main, 0.15)
                        : alpha(theme.palette.primary.main, 0.1),
                      color: parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).isVIP
                        ? "warning.main"
                        : "primary.main",
                      fontSize: "1.25rem",
                      fontWeight: 700,
                    })}
                  >
                    {(drawerCustomer.name || "CU").slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {drawerCustomer.name}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                      <Chip
                        size="small"
                        label={parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).customerType}
                        color={parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).customerType === "B2B" ? "primary" : "default"}
                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                      />
                      {parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).isVIP && (
                        <Chip size="small" label="VIP Client" color="warning" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                      )}
                    </Box>
                  </Box>
                </Box>
                <IconButton onClick={() => setDrawerCustomer(null)} size="small" aria-label="Close Drawer">
                  <Box component={X} sx={{ width: 18, height: 18 }} />
                </IconButton>
              </Box>

              <Divider />

              {/* Quick Workflow Action Shortcuts */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Box component={FileText} sx={{ width: 14, height: 14 }} />}
                  onClick={() => navigate(`/sales/new?customerId=${drawerCustomer.id}`)}
                  sx={{ py: 1 }}
                >
                  + Quotation
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Box component={Receipt} sx={{ width: 14, height: 14 }} />}
                  onClick={() => navigate(`/invoices/new?customerId=${drawerCustomer.id}`)}
                  sx={{ py: 1 }}
                >
                  + Invoice
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Box component={Wrench} sx={{ width: 14, height: 14 }} />}
                  onClick={() => navigate(`/repairs/new?customerId=${drawerCustomer.id}`)}
                  sx={{ py: 1 }}
                >
                  + Repair Job
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Box component={ExternalLink} sx={{ width: 14, height: 14 }} />}
                  onClick={() => navigate(`/customers/${drawerCustomer.id}`)}
                  sx={{ py: 1 }}
                >
                  Full Profile
                </Button>
              </Box>

              {/* Linked Records Live Summary */}
              {drawerStats && (
                <Card sx={(theme) => ({ bgcolor: alpha(theme.palette.background.default, 0.6), border: `1px solid ${theme.palette.divider}` })}>
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: "block", mb: 1 }}>
                      Activity History
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", textAlign: "center", gap: 1 }}>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {drawerStats.quotations}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Quotes
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {drawerStats.invoices}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Invoices
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {drawerStats.jobSheets}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Repairs
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Contact Information */}
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Contact Information
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.25, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.03) }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box component={Phone} sx={{ width: 16, height: 16, color: "text.secondary" }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>
                        Phone
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {drawerCustomer.phone || "Not provided"}
                      </Typography>
                    </Box>
                  </Box>
                  {drawerCustomer.phone && (
                    <IconButton size="small" onClick={() => copyToClipboard(drawerCustomer.phone!, "Phone")} aria-label="Copy phone">
                      <Box component={Copy} sx={{ width: 14, height: 14 }} />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.25, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.03) }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box component={Mail} sx={{ width: 16, height: 16, color: "text.secondary" }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>
                        Email
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {drawerCustomer.email || "Not provided"}
                      </Typography>
                    </Box>
                  </Box>
                  {drawerCustomer.email && (
                    <IconButton size="small" onClick={() => copyToClipboard(drawerCustomer.email!, "Email")} aria-label="Copy email">
                      <Box component={Copy} sx={{ width: 14, height: 14 }} />
                    </IconButton>
                  )}
                </Box>

                {drawerCustomer.gst_number && (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.25, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.03) }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box component={Building2} sx={{ width: 16, height: 16, color: "text.secondary" }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>
                          GSTIN
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: "monospace" }}>
                          {drawerCustomer.gst_number}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={() => copyToClipboard(drawerCustomer.gst_number!, "GSTIN")} aria-label="Copy GSTIN">
                      <Box component={Copy} sx={{ width: 14, height: 14 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>

              {/* Billing & Shipping Address */}
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>
                  Addresses
                </Typography>

                <Box sx={{ p: 1.5, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                      Billing Address
                    </Typography>
                    {drawerCustomer.address && (
                      <IconButton size="small" onClick={() => copyToClipboard(drawerCustomer.address!, "Billing Address")} aria-label="Copy address">
                        <Box component={Copy} sx={{ width: 12, height: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Typography variant="body2" color="text.primary">
                    {drawerCustomer.address || "No billing address"}
                  </Typography>
                  {(drawerCustomer.city || drawerCustomer.state || drawerCustomer.pincode) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                      {[drawerCustomer.city, drawerCustomer.state, drawerCustomer.pincode].filter(Boolean).join(", ")}
                    </Typography>
                  )}
                </Box>

                {drawerCustomer.shipping_address && drawerCustomer.shipping_address !== drawerCustomer.address && (
                  <Box sx={{ p: 1.5, borderRadius: 1.5, border: (t) => `1px solid ${t.palette.divider}` }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.5 }}>
                      Shipping Address
                    </Typography>
                    <Typography variant="body2" color="text.primary">
                      {drawerCustomer.shipping_address}
                    </Typography>
                    {(drawerCustomer.shipping_city || drawerCustomer.shipping_state || drawerCustomer.shipping_pincode) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                        {[drawerCustomer.shipping_city, drawerCustomer.shipping_state, drawerCustomer.shipping_pincode].filter(Boolean).join(", ")}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              {/* Commercial Terms & Credit Limit */}
              {parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).creditLimit && (
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.info.main, 0.08), border: (t) => `1px solid ${alpha(t.palette.info.main, 0.2)}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box component={CreditCard} sx={{ width: 16, height: 16, color: "info.main" }} />
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "info.main", display: "block" }}>
                        Approved Credit Limit
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).creditLimit}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Notes */}
              {parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).cleanNotes && (
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.03), border: (t) => `1px solid ${t.palette.divider}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: "block", mb: 0.5 }}>
                    Account Notes
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "text.secondary" }}>
                    {parseCustomerMetadata(drawerCustomer.notes, drawerCustomer.gst_number).cleanNotes}
                  </Typography>
                </Box>
              )}

              {/* Drawer Footer Actions */}
              <Box sx={{ display: "flex", gap: 1.5, mt: "auto", pt: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => openEdit(drawerCustomer)}
                  startIcon={<Box component={Pencil} sx={{ width: 14, height: 14 }} />}
                >
                  Edit Profile
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  onClick={() => handleDelete(drawerCustomer.id)}
                  startIcon={<Box component={Trash2} sx={{ width: 14, height: 14 }} />}
                >
                  Delete
                </Button>
              </Box>
            </>
          )}
        </Drawer>

        {/* Customer Add / Edit SideDrawer */}
        <SideDrawer
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={editId ? "Edit Customer Profile" : "Create New Customer"}
          description={editId ? "Update contact information, billing metadata, and commercial terms" : "Add a new customer or business account to your directory"}
          width={620}
          footer={
            <>
              <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 38 }}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleSave} sx={{ minHeight: 38 }}>
                {editId ? "Update Customer" : "Create Customer"}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2.5 }}>
            {/* Classification & VIP Switch */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
              <SegmentedControl
                label="Customer Type"
                value={form.customer_type}
                onChange={(val) => updateField("customer_type", val)}
                options={[
                  {
                    value: "B2C",
                    label: (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box component={User} sx={{ width: 14, height: 14 }} /> Retail (B2C)
                      </Box>
                    ),
                  },
                  {
                    value: "B2B",
                    label: (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <Box component={Building2} sx={{ width: 14, height: 14 }} /> Business (B2B)
                      </Box>
                    ),
                  },
                ]}
              />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={form.is_vip}
                    onChange={(e) => updateField("is_vip", e.target.checked)}
                    color="warning"
                  />
                }
                label={
                  <Typography variant="caption" sx={{ fontWeight: 600, color: form.is_vip ? "warning.main" : "text.secondary" }}>
                    VIP Client
                  </Typography>
                }
              />
            </Box>

            {/* Avatar Upload (Edit mode) */}
            {editId && (
              <Box sx={{ display: "flex", justifyContent: "center" }}>
                <AvatarUpload
                  currentUrl={form.avatar_url || null}
                  name={form.name || "Customer"}
                  folder="customers"
                  entityId={editId}
                  onUploaded={(url) => updateField("avatar_url", url)}
                  size="lg"
                />
              </Box>
            )}

            {/* Basic Information */}
            <TextField
              autoFocus
              label="Customer / Company Name *"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              size="small"
              fullWidth
              placeholder={form.customer_type === "B2B" ? "e.g. Acme Tech Solutions Pvt Ltd" : "e.g. Ramesh Sharma"}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Phone Number"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. 9876543210"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. ramesh@example.com"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>

            {form.customer_type === "B2B" && (
              <TextField
                label="GSTIN / GST Number"
                value={form.gst_number}
                onChange={(e) => updateField("gst_number", e.target.value.toUpperCase())}
                size="small"
                fullWidth
                placeholder="08AAAAA0000A1Z5"
                helperText="15-character Goods and Services Tax Identification Number"
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}

            {/* Billing Address */}
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Billing Address
              </Typography>
              <TextField
                label="Address Line"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                size="small"
                fullWidth
                placeholder="Shop/Flat no, building, street, area"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                <TextField
                  label="City"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. Jodhpur"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="State"
                  value={form.state}
                  onChange={(e) => updateField("state", e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. Rajasthan"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Pincode"
                  value={form.pincode}
                  onChange={(e) => updateField("pincode", e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="e.g. 342001"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
            </Box>

            {/* Shipping Address */}
            <Box sx={{ display: "grid", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Shipping Address
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    updateField("shipping_address", form.address);
                    updateField("shipping_city", form.city);
                    updateField("shipping_state", form.state);
                    updateField("shipping_pincode", form.pincode);
                    toast.success("Copied billing address to shipping");
                  }}
                  startIcon={<Box component={Copy} sx={{ width: 12, height: 12 }} />}
                  sx={{ fontSize: 11, py: 0 }}
                >
                  Same as Billing
                </Button>
              </Box>
              <TextField
                label="Shipping Address Line"
                value={form.shipping_address}
                onChange={(e) => updateField("shipping_address", e.target.value)}
                size="small"
                fullWidth
                placeholder="Delivery address (leave empty if same as billing)"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                <TextField
                  label="Shipping City"
                  value={form.shipping_city}
                  onChange={(e) => updateField("shipping_city", e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Shipping State"
                  value={form.shipping_state}
                  onChange={(e) => updateField("shipping_state", e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  label="Shipping Pincode"
                  value={form.shipping_pincode}
                  onChange={(e) => updateField("shipping_pincode", e.target.value)}
                  size="small"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
            </Box>

            {/* Commercial Terms & Notes */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField
                label="Credit Limit"
                select
                value={form.credit_limit}
                onChange={(e) => updateField("credit_limit", e.target.value)}
                size="small"
                fullWidth
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">None / Advance Payment</MenuItem>
                <MenuItem value="₹10,000">₹10,000 (Small limit)</MenuItem>
                <MenuItem value="₹25,000">₹25,000 (Standard)</MenuItem>
                <MenuItem value="₹50,000">₹50,000 (Regular B2B)</MenuItem>
                <MenuItem value="₹1,00,000">₹1,00,000 (VIP / Corporate)</MenuItem>
                <MenuItem value="₹2,50,000">₹2,50,000 (Enterprise)</MenuItem>
              </TextField>

              <TextField
                label="Account Notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                size="small"
                fullWidth
                placeholder="Payment terms, special preferences..."
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          </Box>
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
