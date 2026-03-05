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

### Admin Features
- [x] Dashboard with KPIs, OTP panel, active sessions
- [x] Bills with S.No column, Reference column, `0001-DDMMYYYY` format
- [x] Rate Management with auto-heal for empty purities
- [x] Branch/User/Item Name Management
- [x] Salespeople Management with branch assignment & branch filter (Feb 2026)
- [x] Salesperson Performance Page: total sales, day-wise breakdown, charts, trend analysis (Feb 2026)

### Customer Management
- [x] Customer List with Total Spent (calculated from approved bills only) (Feb 2026)
- [x] Customer History page with "Edit Details" button (Feb 2026)
- [x] Customer Profile with all fields: Name, Phone, Email, Location, Reference, DOB, Anniversary, Address, Notes

### Reports & Analytics
- [x] 8 tabs: Overview, KT Analysis, Branches, Executives, References, Customers, Top Items, Feedbacks
- [x] Customer analytics uses actual approved bill spending (not cached values) (Feb 2026)
- [x] Dashboard date filters now correctly update all fields including Total Customers (Mar 2026)
- [x] Reference analysis shows unique customers vs bills count (Mar 2026)
- [x] Frequency cohorts & spending tiers based on approved/sent/edited bills only
- [x] Feedbacks tab with date range filter + asc/desc sort
- [x] Inactive Customers with user-specified days threshold
- [x] Inactive Customers total_spent calculated from approved bills (not cached) (Feb 2026)
- [x] Inactive Customers shows "X out of Y customers" ratio (Mar 2026)

### Reference Analytics
- [x] Reference analysis shows unique customers vs bills count (Mar 2026)
- [x] Gold vs Diamond breakdown by multi-select references with combined summary, chart, and table (Mar 2026)

### Calculator Pages
- [x] ErrorBoundary, loading states, Gold/Diamond/MRP flows

### Bill Print View
- [x] B&W printer friendly: white bg, black borders, grayscale logo, "TENTATIVE INVOICE"
- [x] Print/PDF shows only making per gram (no percentage) for all making charge types (Mar 2026)

### Bill Page Features
- [x] Photo lightbox: Simple overlay for viewing item photos without Dialog crashes (Mar 2026)
- [x] Admin-only making % display: Admin sees % and ₹/g only for actual percentage-type charges; per_gram shows only ₹/g (Mar 2026)
- [x] Admin bill summary sidebar shows per-item making breakdown (Mar 2026)
- [x] Smart back navigation: Back button returns to previous page instead of always going to dashboard (Mar 2026)
- [x] Navigation loop fix: Edit Item/MRP Calculator use replace:true to prevent Bill↔Edit loop (Mar 2026)
- [x] Making charge type preservation: Percentage charges saved correctly as percentage type going forward (Mar 2026)

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive/Manager:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Refactor server.py into route modules
- P2: Decompose large frontend components (ReportsPage.js)

## Changelog
- Mar 2026: Fixed photo lightbox (replaced Dialog with simple overlay)
- Mar 2026: Admin-only making % display in bill details and summary (percentage type only, not calculated for per_gram)
- Mar 2026: Smart back navigation on bill page
- Mar 2026: Print/PDF shows only making per gram
- Mar 2026: Fixed navigation loop (Bill↔Edit Item) using replace:true
- Mar 2026: Making charge type correctly preserved as percentage during save/edit
