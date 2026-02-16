import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wrench, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["pending", "assigned", "in_progress", "waiting_parts", "completed", "delivered"] as const;

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  waiting_parts: "bg-accent/10 text-accent",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
};

interface Ticket {
  id: string;
  ticket_number: string;
  device_brand: string | null;
  device_model: string | null;
  issue_description: string | null;
  status: string;
  priority: string;
  created_at: string;
  customers?: { name: string } | null;
}

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("repair_tickets")
      .select("*, customers(name)")
      .eq("assigned_technician_id", user?.id || "")
      .not("status", "eq", "delivered")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchTickets(); }, [user]);

  const updateStatus = async (ticketId: string, newStatus: string) => {
    const { error } = await supabase.from("repair_tickets")
      .update({ status: newStatus as any }).eq("id", ticketId);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchTickets(); }
  };

  const active = tickets.filter(t => !["completed", "delivered"].includes(t.status));
  const completed = tickets.filter(t => t.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Repairs</h1>
        <p className="text-muted-foreground">Your assigned repair tickets</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Wrench className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-bold">{completed.length}</p><p className="text-xs text-muted-foreground">Completed</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{tickets.filter(t => t.priority === "urgent").length}</p><p className="text-xs text-muted-foreground">Urgent</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No tickets assigned to you</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">{t.ticket_number}</CardTitle>
                  <Badge className={statusColors[t.status] || ""} variant="secondary">{t.status.replace("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium">{t.customers?.name}</p>
                  <p className="text-muted-foreground">{[t.device_brand, t.device_model].filter(Boolean).join(" ") || "No device info"}</p>
                </div>
                {t.issue_description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.issue_description}</p>
                )}
                <Select value={t.status} onValueChange={v => updateStatus(t.id, v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
