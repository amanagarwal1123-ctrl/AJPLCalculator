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
- [x] MMI entered toggle per bill
- [x] Active sessions management - view/terminate user sessions
- [x] Bills tabs: Pending, Approved, Draft, All with approve buttons
- [x] Rate Management - Normal & AJPL rates, auto-heal for empty purities (Feb 2026)
- [x] Branch Management
- [x] User Management
- [x] Salesperson Management
- [x] Item Name Management with edit/rename
- [x] Customer List with tier-based classification
- [x] Feedback Questions Management
- [x] Customer Tier Settings
- [x] Notifications panel
- [x] Reports & Analytics with Feedbacks tab (Feb 2026)

### Photo Management
- [x] Photo upload for bill items
- [x] Photo thumbnail display on bill page
- [x] Lightbox dialog for full-size photo viewing (all roles)
- [x] Photo removal by authorized users

### Manager Dashboard
- [x] KPI cards with overflow-hidden for currency values
- [x] Bill table with fixed column widths and truncation
- [x] Bill cards with overflow handling on mobile
- [x] Summary dialog with proper mobile width and scrollable content

### Sales Executive Features
- [x] Customer intake with mandatory fields + 10-digit phone validation
- [x] Salesperson dropdown selection
- [x] Multi-bill tab bar showing active drafts
- [x] Gold/Diamond/MRP calculators - all items editable after saving
- [x] Photo upload with lightbox preview and removal
- [x] Send to Manager -> Feedback -> Home flow

### Reports & Analytics
- [x] Overview with daily sales trend and gold vs diamond charts
- [x] KT Analysis with bar chart and summary table
- [x] Branch-wise and Executive-wise sales
- [x] Customer frequency and spending tier analytics
- [x] Inactive customers tracker
- [x] Top selling items
- [x] Feedbacks tab with sort by date/value (Feb 2026)
- [x] CSV export for all reports

## Key API Endpoints
- `POST /api/auth/request-otp` / `POST /api/auth/verify-otp` - OTP flow
- `POST /api/auth/login` - Admin password login
- `GET/PUT /api/rates/{rate_type}` - Rate management (with auto-heal)
- `GET /api/feedbacks` - All feedbacks with bill details
- `POST /api/upload/photo` / `GET /api/uploads/{filename}` - Photo management
- `GET /api/bills/{id}/summary` - Full bill details

## Database Collections
users, bills, customers, purities, rate_cards, item_names, branches, otps, salespeople, feedback_questions, feedbacks, notifications, settings, sessions

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive/Manager:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Refactor server.py into route modules (admin, billing, reports)
- P2: Decompose large frontend components (AdminDashboard, SalesExecDashboard)
