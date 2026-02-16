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
import CRM from "./pages/CRM";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import PublicQuotation from "./pages/PublicQuotation";
import Repairs from "./pages/Repairs";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import ComingSoon from "./pages/ComingSoon";
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
              <Route path="/pos" element={<ComingSoon />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/repairs" element={<Repairs />} />
              <Route path="/attendance" element={<ComingSoon />} />
              <Route path="/payments" element={<ComingSoon />} />
              <Route path="/reports" element={<ComingSoon />} />
              <Route path="/customers" element={<ComingSoon />} />
              <Route path="/technicians" element={<TechnicianDashboard />} />
              <Route path="/staff" element={<ComingSoon />} />
              <Route path="/templates" element={<ComingSoon />} />
              <Route path="/settings" element={<ComingSoon />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
