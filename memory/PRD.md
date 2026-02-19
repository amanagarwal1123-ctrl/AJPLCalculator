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
- [x] **Simple bill numbers**: `0001-DDMMYYYY` format (sequential + date suffix, Feb 2026)
- [x] MMI entered toggle per bill
- [x] Active sessions management - view/terminate user sessions
- [x] Bills tabs: Pending, Approved, Draft, All with approve buttons
- [x] Rate Management - Normal & AJPL rates, **multiple edits per day supported**, fixed save state bug (Feb 2026)
- [x] Branch Management
- [x] User Management
- [x] Salesperson Management
- [x] Item Name Management with edit/rename (verified Feb 2026)
- [x] Customer List with tier-based classification
- [x] Feedback Questions Management
- [x] Customer Tier Settings
- [x] Notifications panel
- [x] Reports & Analytics

### Photo Management (verified Feb 2026)
- [x] Photo upload for bill items
- [x] Photo thumbnail display on bill page
- [x] Lightbox dialog for full-size photo viewing (all roles)
- [x] Photo removal by authorized users

### Manager Dashboard (formatting fixed Feb 2026)
- [x] KPI cards with overflow-hidden for currency values
- [x] Bill table with fixed column widths and truncation
- [x] Bill cards with overflow handling on mobile
- [x] Summary dialog with proper mobile width and scrollable content
- [x] Item detail rendering with proper overflow/truncate classes

### Sales Executive Features
- [x] Customer intake with mandatory fields + 10-digit phone validation
- [x] Salesperson dropdown selection
- [x] Multi-bill tab bar showing active drafts
- [x] Gold/Diamond/MRP calculators - all items editable after saving
- [x] Photo upload with lightbox preview and removal
- [x] Send to Manager -> Feedback -> Home flow

### Making Charges Display
- [x] Percentage making: shows "x%" with subscript showing per-gram rate
- [x] Per gram making: shows per-gram value
- [x] Per piece making: shows value with quantity

### MRP Mode
- [x] Editable after saving
- [x] Shows MRP & Discount in print view
- [x] GST-inclusive logic

### Feedback System
- [x] Admin configurable feedback questions
- [x] 1-10 rating radio buttons per question
- [x] Additional suggestions/comments textarea
- [x] Auto-opens after "Send to Manager"

## Key API Endpoints
- `POST /api/auth/request-otp` / `POST /api/auth/verify-otp` - OTP flow
- `POST /api/auth/login` - Admin password login
- `GET/PUT /api/rates/{rate_type}` - Rate management (unlimited saves)
- `PUT /api/item-names/{id}` - Rename item name
- `POST /api/upload/photo` / `GET /api/uploads/{filename}` - Photo management
- `GET /api/bills/{id}/summary` - Full bill details for manager/admin

## Database Collections
users, bills, customers, purities, rate_cards, item_names, branches, otps, salespeople, feedback_questions, feedbacks, notifications, settings, sessions

## Credentials
- **Admin:** username=admin, password=admin1123 (multi-login allowed)
- **Executive:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Bug fixes from user verification feedback
- P2: Refactoring server.py into route modules
- P2: Decomposing large frontend components (AdminDashboard, SalesExecDashboard)
