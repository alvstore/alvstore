import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import JobSheets from "./pages/JobSheets";
import JobSheetCreate from "./pages/JobSheetCreate";
import JobSheetDetail from "./pages/JobSheetDetail";
import PublicJobSheet from "./pages/PublicJobSheet";
import CRM from "./pages/CRM";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import PublicQuotation from "./pages/PublicQuotation";
import PublicInvoice from "./pages/PublicInvoice";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import Settings from "./pages/Settings";
import POS from "./pages/POS";
import Finance from "./pages/Finance";
import Attendance from "./pages/Attendance";
import Customers from "./pages/Customers";
import Reports from "./pages/Reports";
import CustomerPortal from "./pages/CustomerPortal";
import NotFound from "./pages/NotFound";

// New Phase 10 pages
import Leads from "./pages/Leads";
import Invoices from "./pages/Invoices";
import InvoicePreview from "./pages/InvoicePreview";
import QuotationPreview from "./pages/QuotationPreview";
import CustomerProfile from "./pages/CustomerProfile";
import Tasks from "./pages/Tasks";
import Employees from "./pages/Employees";
import Payroll from "./pages/Payroll";
import AuditLogs from "./pages/AuditLogs";
import Chat from "./pages/Chat";
import ProductAdd from "./pages/ProductAdd";
import InvoiceAdd from "./pages/InvoiceAdd";
import QuotationAdd from "./pages/QuotationAdd";
import CalendarPage from "./pages/CalendarPage";
import BarcodeManager from "./pages/BarcodeManager";
import FollowUps from "./pages/FollowUps";
import Technicians from "./pages/Technicians";
import DeliveryChallans from "./pages/DeliveryChallans";
import DeliveryChallanAdd from "./pages/DeliveryChallanAdd";
import DeliveryChallanPreview from "./pages/DeliveryChallanPreview";
import LandingPage from "./pages/LandingPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/sales/public/:token" element={<PublicQuotation />} />
            <Route path="/job/public/:token" element={<PublicJobSheet />} />
            <Route path="/invoice/public/:token" element={<PublicInvoice />} />
            {/* Protected routes with layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/crm" element={<CRM />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/sales/new" element={<QuotationAdd />} />
              <Route path="/sales/:id/edit" element={<QuotationAdd />} />
              <Route path="/sales/:id" element={<QuotationPreview />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceAdd />} />
              <Route path="/invoices/:id/edit" element={<InvoiceAdd />} />
              <Route path="/invoices/:id" element={<InvoicePreview />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/inventory/add" element={<ProductAdd />} />
              <Route path="/inventory/:id/edit" element={<ProductAdd />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/repairs" element={<JobSheets />} />
              <Route path="/repairs/new" element={<JobSheetCreate />} />
              <Route path="/repairs/:id/edit" element={<JobSheetCreate />} />
              <Route path="/repairs/:id" element={<JobSheetDetail />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/payments" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/technicians/dashboard" element={<TechnicianDashboard />} />
              <Route path="/challans" element={<DeliveryChallans />} />
              <Route path="/challans/new" element={<DeliveryChallanAdd />} />
              <Route path="/challans/:id/edit" element={<DeliveryChallanAdd />} />
              <Route path="/challans/:id" element={<DeliveryChallanPreview />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/barcodes" element={<BarcodeManager />} />
              <Route path="/follow-ups" element={<FollowUps />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/templates" element={<Navigate to="/settings" replace />} />
              <Route path="/staff" element={<Navigate to="/employees" replace />} />
              <Route path="/portal" element={<CustomerPortal />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
