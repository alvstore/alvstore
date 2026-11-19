"use client";

import { Box, Button, Card, CardContent, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatCard, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, } from "recharts";
import { Download, TrendingUp, Package, Wrench, DollarSign } from "lucide-react";
import { format, subDays } from "date-fns";
export default function Reports() {
    const [tab, setTab] = useState("sales");
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Reports"} subtitle={"Business analytics and data exports"}/>

      <Box sx={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <TextField type="date" value={startDate} onChange={e => setStartDate(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "auto" }}/>
        <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>to</Box>
        <TextField type="date" value={endDate} onChange={e => setEndDate(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "auto" }}/>
      </Box>

      <TabView value={tab} onChange={setTab}>
        <TabBar>
          <Tab value="sales" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={TrendingUp} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/>Sales</Box>}/>
          <Tab value="inventory" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Package} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/>Inventory</Box>}/>
          <Tab value="repairs" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Wrench} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/>Repairs</Box>}/>
          <Tab value="payments" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={DollarSign} sx={{ height: "1rem", width: "1rem", marginRight: "0.25rem" }}/>Payments</Box>}/>
        </TabBar>

        <TabPanel value="sales"><SalesReport start={startDate} end={endDate}/></TabPanel>
        <TabPanel value="inventory"><InventoryReport /></TabPanel>
        <TabPanel value="repairs"><RepairsReport start={startDate} end={endDate}/></TabPanel>
        <TabPanel value="payments"><PaymentsReport start={startDate} end={endDate}/></TabPanel>
      </TabView>
    </Box></AnimatedPage>;
}
function SalesReport({ start, end }: {
    start: string;
    end: string;
}) {
    const [data, setData] = useState<any[]>([]);
    useEffect(() => {
        supabase.from("pos_transactions").select("*").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
    }, [start, end]);
    const totalSales = data.reduce((s, d) => s + (d.total || 0), 0);
    const exportCSV = () => {
        const csv = "Transaction,Total,Method,Date\n" + data.map(d => `${d.transaction_number},${d.total},${d.payment_method},${d.created_at}`).join("\n");
        downloadCSV(csv, "sales-report.csv");
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <StatCard label={"Total Sales"} value={totalSales} formatter={amount => "\u20B9" + amount.toLocaleString()}/>
        <Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button>
      </Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={4}>
          <TableHead><TableRow><TableCell>Transaction #</TableCell><TableCell sx={{ textAlign: "right" }}>Total</TableCell><TableCell>Method</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
          <TableBody>
            {data.map(d => (<TableRow key={d.id}><TableCell>{d.transaction_number}</TableCell><TableCell sx={{ textAlign: "right" }}>₹{d.total}</TableCell><TableCell sx={{ textTransform: "capitalize" }}>{d.payment_method}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>))}
            {data.length === 0 && <TableRow><TableCell colSpan={4} sx={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem", color: "hsl(var(--muted-foreground))" }}>No sales data</TableCell></TableRow>}
          </TableBody>
        </DataTable>
      </Box>
    </Box>);
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
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button></Box>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Stock Levels</Typography></Box>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
              <XAxis dataKey="name" fontSize={11} angle={-30} textAnchor="end" height={80} stroke="hsl(var(--muted-foreground))"/>
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}/>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}/>
              <Bar dataKey="stock_quantity" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={4}>
          <TableHead><TableRow><TableCell>Product</TableCell><TableCell sx={{ textAlign: "right" }}>Stock</TableCell><TableCell sx={{ textAlign: "right" }}>Threshold</TableCell><TableCell>Category</TableCell></TableRow></TableHead>
          <TableBody>
            {data.map((d, i) => (<TableRow key={i}><TableCell sx={d.stock_quantity <= d.low_stock_threshold ? { color: "hsl(var(--destructive))", fontWeight: "500" } : {}}>{d.name}</TableCell><TableCell sx={{ textAlign: "right" }}>{d.stock_quantity}</TableCell><TableCell sx={{ textAlign: "right" }}>{d.low_stock_threshold}</TableCell><TableCell>{d.category || "—"}</TableCell></TableRow>))}
          </TableBody>
        </DataTable>
      </Box>
    </Box>);
}
function RepairsReport({ start, end }: {
    start: string;
    end: string;
}) {
    const [data, setData] = useState<any[]>([]);
    useEffect(() => {
        supabase.from("repair_tickets").select("ticket_number,status,priority,device_type,device_brand,created_at").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
    }, [start, end]);
    const exportCSV = () => {
        const csv = "Ticket,Status,Priority,Device,Date\n" + data.map(d => `${d.ticket_number},${d.status},${d.priority},"${d.device_brand || ""} ${d.device_type || ""}",${d.created_at}`).join("\n");
        downloadCSV(csv, "repairs-report.csv");
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button></Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={5}>
          <TableHead><TableRow><TableCell>Ticket #</TableCell><TableCell>Status</TableCell><TableCell>Priority</TableCell><TableCell>Device</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
          <TableBody>
            {data.map(d => (<TableRow key={d.ticket_number}><TableCell>{d.ticket_number}</TableCell><TableCell sx={{ textTransform: "capitalize" }}>{d.status?.replace("_", " ")}</TableCell><TableCell sx={{ textTransform: "capitalize" }}>{d.priority}</TableCell><TableCell>{d.device_brand} {d.device_type}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} sx={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem", color: "hsl(var(--muted-foreground))" }}>No repair data</TableCell></TableRow>}
          </TableBody>
        </DataTable>
      </Box>
    </Box>);
}
function PaymentsReport({ start, end }: {
    start: string;
    end: string;
}) {
    const [data, setData] = useState<any[]>([]);
    useEffect(() => {
        supabase.from("payments").select("payment_number,amount,payment_method,status,type,created_at").gte("created_at", start).lte("created_at", end + "T23:59:59").order("created_at", { ascending: false }).then(({ data }) => setData(data || []));
    }, [start, end]);
    const exportCSV = () => {
        const csv = "Payment,Amount,Method,Status,Type,Date\n" + data.map(d => `${d.payment_number},${d.amount},${d.payment_method},${d.status},${d.type},${d.created_at}`).join("\n");
        downloadCSV(csv, "payments-report.csv");
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1rem" }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}><Button onClick={exportCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Export CSV</Button></Box>
      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
        <DataTable columnsCount={5}>
          <TableHead><TableRow><TableCell>Payment #</TableCell><TableCell sx={{ textAlign: "right" }}>Amount</TableCell><TableCell>Method</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
          <TableBody>
            {data.map(d => (<TableRow key={d.payment_number}><TableCell>{d.payment_number}</TableCell><TableCell sx={{ textAlign: "right" }}>₹{d.amount}</TableCell><TableCell sx={{ textTransform: "capitalize" }}>{d.payment_method}</TableCell><TableCell sx={{ textTransform: "capitalize" }}>{d.status}</TableCell><TableCell>{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell></TableRow>))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} sx={{ textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem", color: "hsl(var(--muted-foreground))" }}>No payment data</TableCell></TableRow>}
          </TableBody>
        </DataTable>
      </Box>
    </Box>);
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
