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
- [x] **Single-device sessions** for non-admin users (Feb 2026)
- [x] **Admin multi-login** allowed (no session restriction)
- [x] **Active sessions panel** for admin with terminate capability (Feb 2026)

### Admin Features
- [x] Dashboard with KPIs, OTP panel
- [x] **Bills grouped by date** with datetime, salesman, weight, phone, item count (Feb 2026)
- [x] **Daily serial numbers** on bills (reset to 1 each day) (Feb 2026)
- [x] **MMI entered toggle** per bill (Feb 2026)
- [x] **Active sessions management** - view/terminate user sessions (Feb 2026)
- [x] Bills tabs: Pending, Approved, Draft, All with approve buttons
- [x] Rate Management (Normal & AJPL rate cards)
- [x] Branch Management
- [x] User Management
- [x] Salesperson Management
- [x] **Item Name Management with edit/rename** (Feb 2026)
- [x] Customer List with tier-based classification
- [x] Feedback Questions Management
- [x] Customer Tier Settings
- [x] Notifications panel
- [x] Reports & Analytics

### Sales Executive Features
- [x] Customer intake with mandatory fields + 10-digit phone validation
- [x] Salesperson dropdown selection
- [x] Multi-bill tab bar showing active drafts
- [x] Gold/Diamond/MRP calculators - all items editable after saving
- [x] Photo upload with lightbox preview and removal
- [x] Send to Manager -> Feedback -> Home flow

### Manager Features
- [x] **Full bill details in Summary dialog** - gold value, making charge breakdowns (₹/g), stone, studded, MRP details, totals
- [x] Approve redirects to home dashboard
- [x] Clickable customer names linking to profile

### Making Charges Display (Feb 2026)
- [x] Percentage making: shows "x%" with subscript "₹{calculated}/g"
- [x] Per gram making: shows "₹{value}/g"
- [x] Per piece making: shows "₹{value} x{qty}pc"
- [x] Applied consistently across BillPage, ItemCalculator, ManagerDashboard, BillPrintView, PDF

### MRP Mode
- [x] Editable after saving (edit route /bill/:billId/edit-mrp/:itemIndex)
- [x] Shows MRP & Discount in print view (not Rate/10g & Gold Value)
- [x] GST-inclusive logic: after_discount / 1.03

### Feedback System (Feb 2026 update)
- [x] Admin configurable feedback questions
- [x] 1-10 rating radio buttons per question
- [x] **Additional suggestions/comments textarea** at bottom (Feb 2026)
- [x] Auto-opens after "Send to Manager"

### Reports & Analytics
- [x] MRP items handled separately in analytics
- [x] Customer spending tiers calculated from actual bills

## Key API Endpoints
- `POST /api/auth/request-otp` / `POST /api/auth/verify-otp` - OTP flow (creates session)
- `POST /api/auth/login` - Admin password login
- `GET /api/admin/sessions` / `DELETE /api/admin/sessions/{id}` - Session management
- `GET /api/bills/{id}/summary` - Full bill details
- `PUT /api/bills/{id}/approve` - Approve bill
- `PUT /api/bills/{id}/mmi` - Toggle MMI entered status
- `DELETE /api/bills/{id}/items/{idx}/photos/{pidx}` - Remove photo
- `PUT /api/item-names/{id}` - Rename item name
- `POST /api/calculate/mrp-item` - MRP calculation

## Database Collections
users, bills, customers, purities, rate_cards, item_names, branches, otps, salespeople, feedback_questions, feedbacks, notifications, settings, **sessions**

## Credentials
- **Admin:** username=admin, password=admin1123 (multi-login allowed)
- **Executive:** OTP-based (single-device session)
