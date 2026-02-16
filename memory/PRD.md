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
- [x] Rate Management (Normal & AJPL rate cards)
- [x] Branch Management
- [x] User Management
- [x] Salesperson Management (NEW)
- [x] Item Name Management
- [x] Customer List with tier-based classification
- [x] All Bills view
- [x] Feedback Questions Management (NEW)
- [x] Customer Tier Settings (Bronze/Silver/Gold/Platinum/Diamond) (NEW)
- [x] Notifications panel (birthday/anniversary reminders) (NEW)
- [x] Reports & Analytics

### Sales Executive Features
- [x] Customer intake form with mandatory fields (name, phone, location, reference)
- [x] Salesperson dropdown selection (NEW)
- [x] Multi-bill management (active drafts)
- [x] Gold item calculator with making/stone charges
- [x] Diamond item calculator with studded charges
- [x] MRP Calculator mode (NEW) - tag-based pricing with discounts & GST
- [x] Tag number field on items (NEW)
- [x] Photo upload with items (NEW)
- [x] Send to Manager with auto-redirect to feedback page (NEW)
- [x] Customer profile access from bill page (NEW)

### Manager Features
- [x] Bill review with Summary/View/Approve actions
- [x] Clickable customer names linking to profile page (NEW)
- [x] Notifications for birthday/anniversary reminders (NEW)
- [x] Bill status tabs (Pending, Approved, Draft, All)

### Customer Management
- [x] Customer database with extended fields (email, DOB, anniversary, address, notes) (NEW)
- [x] Customer tier classification (Bronze to Diamond based on spending) (NEW)
- [x] Purchase history view
- [x] Birthday/anniversary notification system (NEW)

### Feedback System (NEW)
- [x] Admin configurable feedback questions
- [x] 1-10 rating radio buttons per question
- [x] Auto-opens after "Send to Manager"
- [x] Optional skip option
- [x] Feedback attached to bill for manager/admin review

### UI/UX
- [x] Mobile-responsive layouts across all dashboards
- [x] Fixed mobile menu button (44px touch target) (FIXED)
- [x] Bigger logos throughout app (sidebar, login, headers) (IMPROVED)
- [x] "Made with Emergent" badge hidden
- [x] AJPL Calculator branding with custom logo
- [x] Kintsugi design theme

### Billing Features
- [x] Gold calculation (net weight, gold value, making, stone charges)
- [x] Diamond calculation (studded charges with L/NL weight deduction)
- [x] MRP mode (tag number, gross weight, studded weights, MRP, discounts, GST breakdown) (NEW)
- [x] External charges
- [x] Bill PDF generation
- [x] Print view

## Key API Endpoints
- `POST /api/auth/request-otp` - Generate OTP for user
- `POST /api/auth/verify-otp` - Verify OTP and get JWT
- `POST /api/auth/login` - Admin password login
- `GET/POST /api/salespeople` - Salesperson CRUD
- `GET/POST /api/feedback-questions` - Feedback question CRUD
- `POST /api/bills/{id}/feedback` - Submit customer feedback
- `GET/PUT /api/settings/tiers` - Customer tier settings
- `GET /api/notifications` - Get notifications with auto-generation
- `PUT /api/notifications/{id}/done` - Mark notification done
- `POST /api/upload/photo` - Upload item photo
- `POST /api/calculate/mrp-item` - MRP calculation
- `PUT /api/customers/{id}` - Update customer details
- `GET /api/customers/{id}` - Get customer profile

## Database Collections
- users, bills, customers, purities, rate_cards, item_names, branches
- otps, salespeople, feedback_questions, feedbacks, notifications, settings

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive:** OTP-based (e.g., exec1)
