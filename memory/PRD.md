# AJPL Calculator - Product Requirements Document

## Original Problem Statement
AJPL Calculator is a gold jewellery billing and sales management application for a jewellery showroom chain. The app supports Admin, Manager, and Sales Executive roles with a dual authentication system (OTP for staff, password for admin).

## Core Architecture
- **Stack:** FARM (FastAPI, React, MongoDB)
- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Backend:** FastAPI with Motor (async MongoDB driver)
- **Auth:** JWT tokens with dual login (OTP for non-admin, password for admin)
- **Design:** Royal velvet blue Kintsugi theme

## What's Been Implemented

### Authentication & Authorization
- [x] OTP-based login, admin password login, JWT tokens, role-based access control
- [x] Bill access control: check_bill_access helper enforces admin=all, manager=own branch, exec=own bills (Mar 2026)
- [x] Send bill restricted to executive owner only (Mar 2026)
- [x] Notification ownership: executives can only modify their own notifications (Mar 2026)
- [x] Feedback page route protected with PrivateRoute (Option B - internal only) (Mar 2026)
- [x] Manager creation requires branch_id (Mar 2026)

### Admin Features
- [x] Dashboard with KPIs, OTP panel, active sessions
- [x] Dashboard auto-refresh every 30s for real-time sales updates (Mar 2026)
- [x] Bills with S.No column, Reference column, `0001-DDMMYYYY` format
- [x] Bill cards show customer reference in all tabs (Mar 2026)
- [x] Rate Management with auto-heal for empty purities
- [x] Branch/User/Item Name Management
- [x] Salespeople Management with branch assignment & branch filter

### Customer Management
- [x] Customer List with Total Spent (calculated from approved bills only)
- [x] Customer History page with "Edit Details" button
- [x] Customer Profile with all fields
- [x] Phone-first customer entry with auto-lookup
- [x] Multi-phone support: bills store customer_id for canonical linkage (Mar 2026)
- [x] Customer lookup works by id, primary phone, or secondary phones array (Mar 2026)
- [x] Bills query uses customer_id + phone fallback for complete history (Mar 2026)
- [x] Analytics spending aggregation uses customer_id (Mar 2026)
- [x] Narration field on bills

### Reports & Analytics
- [x] 8 tabs with URL param persistence (?tab=xxx) (Mar 2026)
- [x] Manager branch scoping on ALL analytics endpoints (Mar 2026)
- [x] Reference breakdown refreshes when date filters change (Mar 2026)
- [x] Feedbacks: "Only with comments" checkbox + Georgia serif font for comments (Mar 2026)
- [x] Customer Profile Total Spent excludes drafts (uses API total_spent) (Mar 2026)

### Navigation & UI
- [x] Tab state persisted via URL search params - back button preserves active tab (Mar 2026)
- [x] Sidebar active-state prefix matching for nested routes (Mar 2026)
- [x] Frontend API base URL fallback to window.location.origin (Mar 2026)

### Calculator, Print, Bill Page
- [x] ErrorBoundary, Gold/Diamond/MRP flows
- [x] B&W printer friendly, Print/PDF making per gram only
- [x] Photo lightbox, admin-only making % display
- [x] Smart back navigation, navigation loop fix

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive/Manager:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Refactor server.py into route modules
- P2: Decompose large frontend components (ReportsPage.js, SalesExecDashboard.js)

## Changelog (Mar 2026 - Latest)
- Bill access control: check_bill_access helper on get/summary/pdf/photo-delete endpoints
- Send bill restricted to executive owner only (not admin/manager)
- Bills now store customer_id for canonical customer linkage
- Customer detail/bills lookup supports secondary phones in phones array
- Analytics spending aggregation uses customer_id with phone fallback
- Manager branch scoping on all analytics endpoints (customers, frequency, inactive, reference-breakdown, salesperson performance, feedbacks)
- Notification ownership checks for executives
- Manager creation requires branch_id
- Feedback page route protected with PrivateRoute
- Frontend API URL fallback to window.location.origin
- Sidebar prefix matching for nested route highlighting
- Reference breakdown refreshes on date filter changes
- Customer Profile Total Spent uses API total_spent (excludes drafts)
- Bill cards show customer reference in all dashboard tabs
- Dashboard auto-refresh every 30s
- Feedbacks "Only with comments" checkbox + Georgia serif font
- Tab state persisted via URL params across all dashboards
- React key warnings fixed in References tab
