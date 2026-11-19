"use client";

import { Box, Button, Card, CardContent, FormLabel, IconButton, MenuItem, Tab, TextField, Typography } from "@mui/material";
import { AnimatedPage, FormDialog, PageHeader, StatusChip, TabBar, TabView, confirmAction, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, Mail, MessageSquare, FileText, File } from "lucide-react";
interface Template {
    id: string;
    name: string;
    type: string;
    subject: string | null;
    body: string;
    variables: any;
    is_default: boolean;
    created_at: string;
}
const typeIcons: Record<string, any> = { email: Mail, sms: MessageSquare, invoice: FileText, quotation: File };
const typeColors = { email: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" }, sms: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, invoice: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }, quotation: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent))" } };
const variablesList = ["{{customer_name}}", "{{invoice_number}}", "{{quotation_number}}", "{{amount}}", "{{date}}", "{{company_name}}", "{{repair_status}}"];
export default function Templates() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("all");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", type: "email", subject: "", body: "" });
    const fetchTemplates = async () => {
        setLoading(true);
        let query = supabase.from("templates").select("*").order("created_at", { ascending: false });
        if (tab !== "all")
            query = query.eq("type", tab as any);
        const { data } = await query;
        setTemplates(data || []);
        setLoading(false);
    };
    useEffect(() => { fetchTemplates(); }, [tab]);
    const openNew = () => { setEditId(null); setForm({ name: "", type: "email", subject: "", body: "" }); setSheetOpen(true); };
    const openEdit = (t: Template) => { setEditId(t.id); setForm({ name: t.name, type: t.type, subject: t.subject || "", body: t.body }); setSheetOpen(true); };
    const handleSave = async () => {
        if (!form.name || !form.body) {
            toast.error("Name and body are required");
            return;
        }
        const payload = { name: form.name, type: form.type as any, subject: form.subject || null, body: form.body, created_by: user?.id };
        if (editId) {
            const { error } = await supabase.from("templates").update(payload).eq("id", editId);
            if (error)
                toast.error(error.message);
            else
                toast.success("Template updated");
        }
        else {
            const { error } = await supabase.from("templates").insert(payload);
            if (error)
                toast.error(error.message);
            else
                toast.success("Template created");
        }
        setSheetOpen(false);
        fetchTemplates();
    };
    const handleDelete = async (id: string) => {
        if (!await confirmAction("Delete this template?"))
            return;
        const { error } = await supabase.from("templates").delete().eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Deleted");
            fetchTemplates();
        }
    };
    const insertVariable = (v: string) => setForm(p => ({ ...p, body: p.body + v }));
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Templates"} subtitle={"Manage email, SMS, and document templates"} actions={<><Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Template</Button></>}/>

      <TabView value={tab} onChange={setTab}>
        <TabBar>
          <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
          <Tab value="email" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Email</Box>}/>
          <Tab value="sms" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>SMS</Box>}/>
          <Tab value="invoice" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Invoice</Box>}/>
          <Tab value="quotation" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Quotation</Box>}/>
        </TabBar>
      </TabView>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : templates.length === 0 ? (<Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>No templates yet. Create your first one!</Typography>) : (<Box sx={{ display: "grid", gap: "0.75rem" }}>
          {templates.map(t => {
                const Icon = typeIcons[t.type] || File;
                return (<Card key={t.id}>
                <CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={mergeSx({ padding: "0.625rem", borderRadius: "var(--radius)" }, typeColors[t.type] || { backgroundColor: "hsl(var(--muted))" })}>
                    <Box component={Icon} sx={{ height: "1.25rem", width: "1.25rem" }}/>
                  </Box>
                  <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                    <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{t.name}</Typography>
                    {t.subject && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</Typography>}
                  </Box>
                  <StatusChip label={t.type} variant="outlined" sx={{ textTransform: "capitalize" }}/>
                  <Box sx={{ display: "flex", gap: "0.25rem" }}>
                    <IconButton onClick={() => openEdit(t)} aria-label={"Pencil"}><Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                    <IconButton onClick={() => handleDelete(t.id)} aria-label={"Trash2"}><Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/></IconButton>
                  </Box>
                </CardContent>
              </Card>);
            })}
        </Box>)}

      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? "Edit Template" : "New Template"} description={"Create reusable message templates with variables"} paperSx={{ overflowY: "auto" }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Name *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="quotation">Quotation</MenuItem>
                </TextField>
            </Box>
            {(form.type === "email") && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} label={"Subject"} size="small" fullWidth/></Box>)}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} label={"Body *"} size="small" fullWidth multiline/>
              {form.type === "sms" && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{form.body.length}/160 characters</Typography>}
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              <FormLabel>Insert Variable</FormLabel>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {variablesList.map(v => (<Button key={v} onClick={() => insertVariable(v)} variant="outlined" size="small" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{v}</Button>))}
              </Box>
            </Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>{editId ? "Update" : "Create"} Template</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
