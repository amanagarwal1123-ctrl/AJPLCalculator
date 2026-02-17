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

### Admin Features
- [x] Dashboard with KPIs, OTP panel, recent bills
- [x] **Bills with tabs: Pending, Approved, Draft, All** (Feb 2026)
- [x] **Admin can approve pending bills directly** (Feb 2026)
- [x] Rate Management (Normal & AJPL rate cards)
- [x] Branch Management
- [x] User Management
- [x] Salesperson Management
- [x] Item Name Management
- [x] Customer List with tier-based classification
- [x] All Bills view
- [x] Feedback Questions Management
- [x] Customer Tier Settings (Bronze/Silver/Gold/Platinum/Diamond, admin-editable)
- [x] Notifications panel (birthday/anniversary reminders)
- [x] Reports & Analytics

### Sales Executive Features
- [x] Customer intake form with mandatory fields (name, phone, location, reference, salesperson)
- [x] **Phone number 10-digit validation** (Feb 2026)
- [x] Salesperson dropdown selection (admin manages salesperson list)
- [x] **Multi-bill tab bar** showing active drafts at top of dashboard (Feb 2026)
- [x] Gold item calculator with making/stone charges
- [x] Diamond item calculator with studded charges (L/NL weight deduction)
- [x] **MRP Calculator mode - now editable after saving** (Feb 2026)
- [x] Tag number field on items (optional)
- [x] Photo upload with items (camera + gallery)
- [x] **Photos: openable in lightbox, removable per photo** (Feb 2026)
- [x] Send to Manager with auto-redirect to feedback page
- [x] Customer profile access from bill page

### Manager Features
- [x] Bill review with Summary/View/Approve actions
- [x] **Full bill details in Summary dialog** - gold value, making charge breakdowns, stone, studded, MRP details, totals (Feb 2026)
- [x] Clickable customer names linking to profile page
- [x] Notifications for birthday/anniversary reminders
- [x] Bill status tabs (Pending, Approved, Draft, All)
- [x] **Approve redirects to home dashboard** (Feb 2026)

### Navigation & UX Fixes (Feb 2026)
- [x] **Back button loop fixed** - Bill page back button goes to role-specific home
- [x] Item calculator back button goes to bill page on first step
- [x] Manager/Admin approve bill -> redirects to dashboard

### Customer Management
- [x] Customer database with extended fields (email, DOB, anniversary, address, notes)
- [x] **Customer tier classification calculated from actual bills** (Feb 2026 fix)
- [x] Purchase history view
- [x] Birthday/anniversary notification system with task tracking

### Feedback System
- [x] Admin configurable feedback questions
- [x] 1-10 rating radio buttons per question
- [x] Auto-opens after "Send to Manager"
- [x] Optional skip option

### MRP Mode
- [x] Tag number, item name, gross weight
- [x] Studded weight section (diamond/solitaire/colored stones) in carats
- [x] Net weight = gross - sum(studded * 0.2)
- [x] MRP field (in rupees, includes GST)
- [x] Discount section: percentage or flat
- [x] After discount = MRP - discounts (with GST)
- [x] Amount without GST = after_discount / 1.03
- [x] **Editable after saving** (Feb 2026)

### Bill Printing & PDF (Feb 2026 fixes)
- [x] **Complete calculations shown** - making charge details, stone, studded breakdown
- [x] **MRP items show MRP & Discount** instead of Rate/10g & Gold Value
- [x] GST breakdown in totals section

### Reports & Analytics (Feb 2026 fixes)
- [x] **MRP items handled separately in analytics** - not counted as "Unknown" purity
- [x] **Customer spending tiers calculated from actual bills** not cached total_spent

## Key API Endpoints
- `POST /api/auth/request-otp` - Generate OTP
- `POST /api/auth/verify-otp` - Verify OTP, get JWT
- `POST /api/auth/login` - Admin password login
- `GET/POST/DELETE /api/salespeople` - Salesperson CRUD
- `GET/POST/DELETE /api/feedback-questions` - Feedback question CRUD
- `POST /api/bills/{id}/feedback` - Submit customer feedback
- `GET /api/bills/{id}/feedback` - Get bill feedback
- `GET /api/bills/{id}/summary` - **Full bill details** (Feb 2026)
- `PUT /api/bills/{id}/approve` - Approve bill (admin + manager)
- `DELETE /api/bills/{id}/items/{idx}/photos/{pidx}` - **Remove photo** (Feb 2026)
- `GET/PUT /api/settings/tiers` - Customer tier settings
- `GET /api/notifications` - Notifications with auto-generation
- `POST /api/upload/photo` - Upload item photo
- `POST /api/calculate/mrp-item` - MRP calculation

## Database Collections
users, bills, customers, purities, rate_cards, item_names, branches, otps, salespeople, feedback_questions, feedbacks, notifications, settings

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive:** OTP-based (e.g., exec1)
