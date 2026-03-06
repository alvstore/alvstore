import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Plus, Search, Pencil, Trash2, Users, UserPlus, MapPin, Building2 } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

// Customer interface moved below imports

interface Customer {
  id: string; name: string; phone: string | null; email: string | null;
  gst_number: string | null; address: string | null; city: string | null;
  state: string | null; pincode: string | null; notes: string | null;
  created_at: string; avatar_url?: string | null;
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
    if (error) toast.error(error.message);
    else setCustomers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      gst_number: c.gst_number || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      pincode: c.pincode || "",
      notes: c.notes || "",
    });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (editId) {
      const { error } = await supabase
        .from("customers")
        .update({ ...form })
        .eq("id", editId);
      if (error) toast.error(error.message);
      else toast.success("Customer updated");
    } else {
      const { error } = await supabase
        .from("customers")
        .insert({ ...form, created_by: user?.id });
      if (error) toast.error(error.message);
      else toast.success("Customer created");
    }
    setSheetOpen(false);
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Customer deleted");
      fetchCustomers();
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // KPI calculations
  const totalCustomers = customers.length;
  const withEmail = customers.filter(c => c.email).length;
  const withGST = customers.filter(c => c.gst_number).length;
  const cities = new Set(customers.filter(c => c.city).map(c => c.city)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CRM</h1>
          <p className="text-sm text-muted-foreground">Manage your customers</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: totalCustomers, icon: Users, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: "With Email", value: withEmail, icon: UserPlus, bg: "bg-success/10", iconColor: "text-success" },
          { label: "With GST", value: withGST, icon: Building2, bg: "bg-accent/10", iconColor: "text-accent" },
          { label: "Cities", value: cities, icon: MapPin, bg: "bg-info/10", iconColor: "text-info" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table - Materialize inspired */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">City</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">GST</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No customers found. Add your first customer!</p>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id} className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate sm:hidden">{c.phone || c.email || ""}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{c.city || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.gst_number ? (
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{c.gst_number}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Slide-over form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Customer" : "Add Customer"}</SheetTitle>
            <SheetDescription>
              {editId ? "Update customer details" : "Fill in the customer information"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {[
              { key: "name", label: "Name *", type: "text" },
              { key: "phone", label: "Phone", type: "tel" },
              { key: "email", label: "Email", type: "email" },
              { key: "gst_number", label: "GST Number", type: "text" },
              { key: "address", label: "Address", type: "text" },
              { key: "city", label: "City", type: "text" },
              { key: "state", label: "State", type: "text" },
              { key: "pincode", label: "Pincode", type: "text" },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs font-medium">{field.label}</Label>
                <Input
                  type={field.type}
                  value={(form as any)[field.key]}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={3}
              />
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editId ? "Update Customer" : "Create Customer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
