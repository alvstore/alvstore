import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import TechnicianDashboard from "./pages/TechnicianDashboard";
import Settings from "./pages/Settings";
import POS from "./pages/POS";
import Payments from "./pages/Payments";
import Finance from "./pages/Finance";
import Attendance from "./pages/Attendance";
import Staff from "./pages/Staff";
import Customers from "./pages/Customers";
// Templates merged into Settings
import Reports from "./pages/Reports";
import CustomerPortal from "./pages/CustomerPortal";
import NotFound from "./pages/NotFound";

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
              <Route path="/sales" element={<Sales />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/repairs" element={<JobSheets />} />
              <Route path="/repairs/new" element={<JobSheetCreate />} />
              <Route path="/repairs/:id" element={<JobSheetDetail />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/payments" element={<Finance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/technicians" element={<TechnicianDashboard />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/templates" element={<Settings />} />
              <Route path="/settings" element={<Settings />} />
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
