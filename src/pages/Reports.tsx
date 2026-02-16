import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Download, TrendingUp, Package, Wrench, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Business analytics and data exports</p>
      </div>

      <div className="flex gap-3 items-center">
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-auto" />
        <span className="text-muted-foreground">to</span>
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-auto" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sales"><TrendingUp className="h-4 w-4 mr-1" />Sales</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-1" />Inventory</TabsTrigger>
          <TabsTrigger value="repairs"><Wrench className="h-4 w-4 mr-1" />Repairs</TabsTrigger>
          <TabsTrigger value="payments"><DollarSign className="h-4 w-4 mr-1" />Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="sales"><SalesReport start={startDate} end={endDate} /></TabsContent>
        <TabsContent value="inventory"><InventoryReport /></TabsContent>
        <TabsContent value="repairs"><RepairsReport start={startDate} end={endDate} /></TabsContent>
        <TabsContent value="payments"><PaymentsReport start={startDate} end={endDate} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SalesReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("pos_transactions").select("*").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
  }, [start, end]);

  const totalSales = data.reduce((s, d) => s + (d.total || 0), 0);
  const exportCSV = () => {
    const csv = "Transaction,Total,Method,Date\n" + data.map(d => `${d.transaction_number},${d.total},${d.payment_method},${d.created_at}`).join("\n");
    downloadCSV(csv, "sales-report.csv");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-between items-center">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-2xl font-bold">₹{totalSales.toLocaleString()}</p></CardContent></Card>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Transaction #</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Method</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.id}><TableCell>{d.transaction_number}</TableCell><TableCell className="text-right">₹{d.total}</TableCell><TableCell className="capitalize">{d.payment_method}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No sales data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InventoryReport() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("products").select("name,stock_quantity,low_stock_threshold,selling_price,category").order("stock_quantity").then(({ data }) => setData(data || []));
  }, []);

  const exportCSV = () => {
    const csv = "Product,Stock,Threshold,Price,Category\n" + data.map(d => `"${d.name}",${d.stock_quantity},${d.low_stock_threshold},${d.selling_price},"${d.category || ""}"`).join("\n");
    downloadCSV(csv, "inventory-report.csv");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end"><Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button></div>
      <Card>
        <CardHeader><CardTitle className="text-base">Stock Levels</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={80} stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="stock_quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Threshold</TableHead><TableHead>Category</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((d, i) => (
              <TableRow key={i}><TableCell className={d.stock_quantity <= d.low_stock_threshold ? "text-destructive font-medium" : ""}>{d.name}</TableCell><TableCell className="text-right">{d.stock_quantity}</TableCell><TableCell className="text-right">{d.low_stock_threshold}</TableCell><TableCell>{d.category || "—"}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RepairsReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("repair_tickets").select("ticket_number,status,priority,device_type,device_brand,created_at").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
  }, [start, end]);

  const exportCSV = () => {
    const csv = "Ticket,Status,Priority,Device,Date\n" + data.map(d => `${d.ticket_number},${d.status},${d.priority},"${d.device_brand || ""} ${d.device_type || ""}",${d.created_at}`).join("\n");
    downloadCSV(csv, "repairs-report.csv");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end"><Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button></div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Ticket #</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Device</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.ticket_number}><TableCell>{d.ticket_number}</TableCell><TableCell className="capitalize">{d.status?.replace("_", " ")}</TableCell><TableCell className="capitalize">{d.priority}</TableCell><TableCell>{d.device_brand} {d.device_type}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No repair data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PaymentsReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("payments").select("payment_number,amount,payment_method,status,type,created_at").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
  }, [start, end]);

  const exportCSV = () => {
    const csv = "Payment,Amount,Method,Status,Type,Date\n" + data.map(d => `${d.payment_number},${d.amount},${d.payment_method},${d.status},${d.type},${d.created_at}`).join("\n");
    downloadCSV(csv, "payments-report.csv");
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end"><Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button></div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map(d => (
              <TableRow key={d.payment_number}><TableCell>{d.payment_number}</TableCell><TableCell className="text-right">₹{d.amount}</TableCell><TableCell className="capitalize">{d.payment_method}</TableCell><TableCell className="capitalize">{d.status}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payment data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}
