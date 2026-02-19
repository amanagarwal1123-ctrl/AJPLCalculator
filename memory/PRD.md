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
- [x] OTP-based login for non-admin users (OTPs shown on admin dashboard)
- [x] Separate password-based admin login (admin/admin1123)
- [x] JWT token with 10 PM IST expiry for managers/executives
- [x] Role-based access control (admin, manager, executive)
- [x] Single-device sessions for non-admin users
- [x] Admin multi-login allowed (no session restriction)
- [x] Active sessions panel for admin with terminate capability

### Admin Features
- [x] Dashboard with KPIs, OTP panel
- [x] Bills grouped by date with datetime, salesman, weight, phone, item count
- [x] Daily serial numbers on bills (reset to 1 each day)
- [x] Simple bill numbers: `0001-DDMMYYYY` format
- [x] S.No column in All Bills table showing daily_serial (Feb 2026)
- [x] MMI entered toggle per bill
- [x] Active sessions management - view/terminate user sessions
- [x] Bills tabs: Pending, Approved, Draft, All with approve buttons
- [x] Rate Management - Normal & AJPL rates, auto-heal for empty purities (Feb 2026)
- [x] Branch Management, User Management, Salesperson Management
- [x] Item Name Management with edit/rename
- [x] Customer List with tier-based classification
- [x] Feedback Questions Management, Customer Tier Settings
- [x] Notifications panel

### Reports & Analytics
- [x] Overview, KT Analysis, Branches, Executives, References, Customers, Top Items tabs
- [x] Feedbacks tab with date range filter (from/to) + ascending/descending sort by bill value (Feb 2026)
- [x] CSV export for all reports
- [x] TabsList with flex-wrap for 8 tabs

### Manager Dashboard
- [x] KPI cards with overflow-hidden, Bill table with fixed widths, Summary dialog

### Sales Executive Features
- [x] Customer intake, Salesperson dropdown, Multi-bill tab bar
- [x] Gold/Diamond/MRP calculators, Photo upload, Feedback flow

## Key API Endpoints
- `POST /api/auth/login` / `POST /api/auth/request-otp` / `POST /api/auth/verify-otp`
- `GET/PUT /api/rates/{rate_type}` - Rate management with auto-heal
- `GET /api/feedbacks` - All feedbacks with bill details
- `GET /api/bills` - All bills with daily_serial field
- `POST /api/upload/photo` / `GET /api/uploads/{filename}`

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive/Manager:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Refactor server.py into route modules (admin, billing, reports)
- P2: Decompose large frontend components (AdminDashboard, SalesExecDashboard)
