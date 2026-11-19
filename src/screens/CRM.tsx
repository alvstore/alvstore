"use client";

import { Avatar, Box, Button, Card, IconButton, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, SearchToolbar, StatCard, confirmAction, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, Pencil, Trash2, Users, UserPlus, MapPin, Building2 } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
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
    notes: string | null;
    created_at: string;
    avatar_url?: string | null;
}
const emptyForm = {
    name: "", phone: "", email: "", gst_number: "",
    address: "", city: "", state: "", pincode: "", notes: "", avatar_url: "",
};
export default function CRM() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const fetchCustomers = async () => {
        setLoading(true);
        let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
        if (search) {
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        }
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setCustomers(data || []);
        setLoading(false);
    };
    useEffect(() => { fetchCustomers(); }, [search]);
    const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
    const openEdit = (c: Customer) => {
        setEditId(c.id);
        setForm({
            name: c.name, phone: c.phone || "", email: c.email || "",
            gst_number: c.gst_number || "", address: c.address || "",
            city: c.city || "", state: c.state || "", pincode: c.pincode || "",
            notes: c.notes || "", avatar_url: c.avatar_url || "",
        });
        setSheetOpen(true);
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
        if (editId) {
            const { error } = await supabase.from("customers").update({ ...form }).eq("id", editId);
            if (error)
                toast.error(error.message);
            else
                toast.success("Customer updated");
        }
        else {
            const { error } = await supabase.from("customers").insert({ ...form, created_by: user?.id });
            if (error)
                toast.error(error.message);
            else
                toast.success("Customer created");
        }
        setSheetOpen(false);
        fetchCustomers();
    };
    const handleDelete = async (id: string) => {
        if (!await confirmAction("Delete this customer?"))
            return;
        const { error } = await supabase.from("customers").delete().eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Customer deleted");
            fetchCustomers();
        }
    };
    const updateField = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };
    const totalCustomers = customers.length;
    const withEmail = customers.filter(c => c.email).length;
    const withGST = customers.filter(c => c.gst_number).length;
    const cities = new Set(customers.filter(c => c.city).map(c => c.city)).size;
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"CRM"} subtitle={"Manage your customers"} actions={<><Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Add Customer</Button></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        {[
            { label: "Total Customers", value: totalCustomers, icon: Users, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" }, iconColor: { color: "hsl(var(--primary))" } },
            { label: "With Email", value: withEmail, icon: UserPlus, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" }, iconColor: { color: "hsl(var(--success))" } },
            { label: "With GST", value: withGST, icon: Building2, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }, iconColor: { color: "hsl(var(--accent))" } },
            { label: "Cities", value: cities, icon: MapPin, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)" }, iconColor: { color: "hsl(var(--info))" } },
        ].map(kpi => (<StatCard label={kpi.label} value={kpi.value} icon={<Box component={kpi.icon} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, kpi.iconColor)}/>} key={kpi.label} sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}/>))}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", alignItems: "flex-start" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search by name, phone, email..." sx={{ maxWidth: "24rem", width: "100%" }}/>
      </Box>

      <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", overflow: "hidden" }}>
        <DataTable columnsCount={6} loading={loading} empty={customers.length === 0} emptyMessage={<>
                <Box component={Users} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.2" }}/>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>No customers found. Add your first customer!</Typography>
              </>}>
          <TableHead>
            <TableRow sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Customer</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Phone</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Email</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>City</TableCell>
              <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>GST</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", textAlign: "right" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{(customers.map((c) => (<TableRow key={c.id} onClick={() => navigate(`/customers/${c.id}`)} sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", cursor: "pointer" }}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar src={c.avatar_url ?? undefined} alt={c.name} sx={mergeSx({ height: "2.25rem", width: "2.25rem", borderWidth: "1px", borderColor: "hsl(var(--border))" }, { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600" })}>
                          {c.name.slice(0, 2).toUpperCase()}
                        </Avatar>
                      <Box sx={{ minWidth: "0px" }}>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</Typography>
                        <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "@media (min-width: 640px)": { display: "none" } }}>{c.phone || c.email || ""}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{c.phone || "—"}</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{c.email || "—"}</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{c.city || "—"}</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>
                    {c.gst_number ? (<Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontFamily: "JetBrains Mono, monospace", backgroundColor: "hsl(var(--muted))", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", color: "hsl(var(--muted-foreground))" }}>{c.gst_number}</Box>) : <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>—</Box>}
                  </TableCell>
                  <TableCell>
                    <Box onClick={e => e.stopPropagation()} sx={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                      <IconButton onClick={() => openEdit(c)} aria-label={"Pencil"} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}><Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                      <IconButton onClick={() => handleDelete(c.id)} aria-label={"Trash2"} sx={{ height: "2rem", width: "2rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--destructive))" } }}><Box component={Trash2} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                    </Box>
                  </TableCell>
                </TableRow>)))}</TableBody>
        </DataTable>
      </Card>

      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? "Edit Customer" : "Add Customer"} description={editId ? "Update customer details" : "Fill in the customer information"} paperSx={{ overflowY: "auto" }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            {/* Avatar Upload */}
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <AvatarUpload currentUrl={form.avatar_url || null} name={form.name || "New"} folder="customers" entityId={editId || undefined} onUploaded={(url) => updateField("avatar_url", url)} size="lg"/>
            </Box>
            {[
            { key: "name", label: "Name *", type: "text" },
            { key: "phone", label: "Phone", type: "tel" },
            { key: "email", label: "Email", type: "email" },
            { key: "gst_number", label: "GST Number", type: "text" },
            { key: "address", label: "Address", type: "text" },
            { key: "city", label: "City", type: "text" },
            { key: "state", label: "State", type: "text" },
            { key: "pincode", label: "Pincode", type: "text" },
        ].map((field) => (<Box key={field.key} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField type={field.type} value={(form as any)[field.key]} onChange={(e) => updateField(field.key, e.target.value)} label={field.label} size="small" fullWidth/>
              </Box>))}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={3} label={"Notes"} size="small" fullWidth multiline/>
            </Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>{editId ? "Update Customer" : "Create Customer"}</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
