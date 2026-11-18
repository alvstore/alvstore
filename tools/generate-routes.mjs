/**
 * Generates src/app/** /page.tsx wrappers for every route that existed in the
 * react-router App.tsx. Each wrapper is a client component that lazy-loads the
 * original page component (ssr:false — the pages assume a browser).
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const appDir = path.join(repoRoot, "src", "app");

// [routePath, importPath, group] — group: "public" | "app" | "redirect"
const routes = [
  // public
  ["/", "@/screens/public/HomeTheaterHome", "public"],
  ["/landing", "@/screens/LandingPage", "public"],
  ["/login", "@/screens/Login", "public"],
  ["/signup", "@/screens/Signup", "public"],
  ["/forgot-password", "@/screens/ForgotPassword", "public"],
  ["/reset-password", "@/screens/ResetPassword", "public"],
  ["/sales/public/[token]", "@/screens/PublicQuotation", "public"],
  ["/job/public/[token]", "@/screens/PublicJobSheet", "public"],
  ["/invoice/public/[token]", "@/screens/PublicInvoice", "public"],
  ["/delivery-report/[token]", "@/screens/PublicDeliveryReport", "public"],
  ["/home-theater", "@/screens/public/HomeTheaterHome", "public"],
  ["/contact", "@/screens/public/HomeTheaterContact", "public"],

  // protected (app group)
  ["/dashboard", "@/screens/Dashboard", "app"],
  ["/crm", "@/screens/CRM", "app"],
  ["/leads", "@/screens/Leads", "app"],
  ["/sales", "@/screens/Sales", "app"],
  ["/sales/new", "@/screens/QuotationAdd", "app"],
  ["/sales/[id]/edit", "@/screens/QuotationAdd", "app"],
  ["/sales/[id]", "@/screens/QuotationPreview", "app"],
  ["/invoices", "@/screens/Invoices", "app"],
  ["/invoices/new", "@/screens/InvoiceAdd", "app"],
  ["/invoices/[id]/edit", "@/screens/InvoiceAdd", "app"],
  ["/invoices/[id]", "@/screens/InvoicePreview", "app"],
  ["/customers/[id]", "@/screens/CustomerProfile", "app"],
  ["/pos", "@/screens/POS", "app"],
  ["/inventory", "@/screens/Inventory", "app"],
  ["/inventory/add", "@/screens/ProductAdd", "app"],
  ["/inventory/[id]/edit", "@/screens/ProductAdd", "app"],
  ["/chat", "@/screens/Chat", "app"],
  ["/repairs", "@/screens/JobSheets", "app"],
  ["/repairs/new", "@/screens/JobSheetCreate", "app"],
  ["/repairs/[id]/edit", "@/screens/JobSheetCreate", "app"],
  ["/repairs/[id]", "@/screens/JobSheetDetail", "app"],
  ["/attendance", "@/screens/Attendance", "app"],
  ["/finance", "@/screens/Finance", "app"],
  ["/payments", "@/screens/Finance", "app"],
  ["/reports", "@/screens/Reports", "app"],
  ["/customers", "@/screens/Customers", "app"],
  ["/technicians", "@/screens/Technicians", "app"],
  ["/technicians/dashboard", "@/screens/TechnicianDashboard", "app"],
  ["/challans", "@/screens/DeliveryChallans", "app"],
  ["/challans/new", "@/screens/DeliveryChallanAdd", "app"],
  ["/challans/[id]/edit", "@/screens/DeliveryChallanAdd", "app"],
  ["/challans/[id]", "@/screens/DeliveryChallanPreview", "app"],
  ["/employees", "@/screens/Employees", "app"],
  ["/payroll", "@/screens/Payroll", "app"],
  ["/tasks", "@/screens/Tasks", "app"],
  ["/audit-logs", "@/screens/AuditLogs", "app"],
  ["/calendar", "@/screens/CalendarPage", "app"],
  ["/barcodes", "@/screens/BarcodeManager", "app"],
  ["/follow-ups", "@/screens/FollowUps", "app"],
  ["/settings", "@/screens/Settings", "app"],
  ["/portal", "@/screens/CustomerPortal", "app"],
  ["/suppliers", "@/screens/Suppliers", "app"],
  ["/purchase-orders", "@/screens/PurchaseOrders", "app"],
  ["/purchase-bills", "@/screens/PurchaseBills", "app"],
  ["/purchase-returns", "@/screens/PurchaseReturns", "app"],
  ["/payment-register", "@/screens/PaymentRegister", "app"],
  ["/apple-pricing", "@/screens/ApplePricing", "app"],

  // redirects
  ["/templates", "/settings", "redirect"],
  ["/staff", "/employees", "redirect"],
];

const wrapperTemplate = (importPath, route) => `"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const Page = dynamic(() => import(${JSON.stringify(importPath)}), { ssr: false });

export default function RoutePage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
`;

const redirectTemplate = (target) => `import { redirect } from "next/navigation";

export default function Page() {
  redirect(${JSON.stringify(target)});
}
`;

let count = 0;
for (const [route, target, group] of routes) {
  const segs = route.split("/").filter(Boolean);
  const dirParts = group === "app" ? ["(app)", ...segs] : segs;
  const dir = path.join(appDir, ...dirParts);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "page.tsx");
  const content = group === "redirect" ? redirectTemplate(target) : wrapperTemplate(target, route);
  fs.writeFileSync(file, content);
  count++;
}
console.log(`[gen-routes] wrote ${count} route wrappers`);
