

# ERP-CRM Master System — Phase 1: Foundation, Dashboard & CRM

## Overview
Build a modern, full-stack ERP-CRM system using Lovable with Supabase as the backend. Phase 1 focuses on the core foundation: authentication, role-based access, the main dashboard, and CRM module. Future phases will add POS, inventory, repair management, payments, attendance, and more.

---

## 1. App Shell & Navigation
- **Collapsible side drawer** with all module links: Dashboard, CRM, Sales, POS, Inventory, Repair Management, Attendance, Payments, Reports, Customers, Technicians, Staff, Templates, Settings
- **Fixed top header** with user avatar, notifications bell, and search
- **Modern 2026 SaaS styling** — clean, professional, dark sidebar with light content area
- Fully **responsive** — mobile hamburger menu, tablet-friendly layouts

## 2. Authentication & Role-Based Access (RBAC)
- **Supabase Auth** with email/password login
- **Four roles**: Admin, Staff, Technician, Customer
- Roles stored in a dedicated `user_roles` table (security best practice)
- Protected routes — each module only accessible by permitted roles
- Login, signup, and password reset pages

## 3. KPI Dashboard
- **KPI cards** at the top: Sales Today, Sales This Month, Pending Payments, Cash Balance, Low Stock Items, Active Repairs, Completed Repairs Today, Total Customers
- **Charts**: Sales trend (line chart), Revenue vs Expenses (bar chart), Top Selling Products (horizontal bar), Repair Status Breakdown (donut chart)
- Fast-loading with real-time refresh support
- Data sourced from Supabase tables

## 4. CRM / Customer Management Module
- **Customer list** with search, filters, and pagination
- **Customer profiles** with: Name, Phone, Email, GST Number, Address, Notes, Purchase History
- **Add/Edit customers** via slide-over panel (not popup modals)
- Full CRUD operations backed by Supabase with RLS policies

## 5. Database Schema (Phase 1)
- `profiles` table (linked to auth.users)
- `user_roles` table with RBAC security-definer function
- `customers` table with all CRM fields
- Proper RLS policies for role-based data access

## 6. Placeholder Pages for Future Modules
- Sales, POS, Inventory, Repair Management, Attendance, Payments, Reports, Technicians, Staff, Templates, Settings — all routed with "Coming Soon" placeholders so the full navigation works from day one

---

*Future phases will add: Quotations & Sales, POS with barcode support, Inventory management, Repair ticket system, Payment gateway integrations (Razorpay, CCAvenue, PhonePe), Attendance module, SMS/Email notifications, Customer portal, and reporting.*

