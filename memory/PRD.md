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
- [x] Salesperson dropdown selection (admin manages salesperson list)
- [x] Multi-bill management (active drafts, tab-like switching)
- [x] Gold item calculator with making/stone charges
- [x] Diamond item calculator with studded charges (L/NL weight deduction)
- [x] MRP Calculator mode - tag-based pricing with discounts & GST breakdown
- [x] Tag number field on items (optional)
- [x] Photo upload with items (camera + gallery)
- [x] Send to Manager with auto-redirect to feedback page
- [x] Customer profile access from bill page

### Manager Features
- [x] Bill review with Summary/View/Approve actions
- [x] Clickable customer names linking to profile page
- [x] Notifications for birthday/anniversary reminders
- [x] Bill status tabs (Pending, Approved, Draft, All)

### Customer Management
- [x] Customer database with extended fields (email, DOB, anniversary, address, notes)
- [x] Customer tier classification (Bronze to Diamond based on spending)
- [x] Purchase history view
- [x] Birthday/anniversary notification system with task tracking (done/pending)
- [x] Pending tasks re-reminded next day if not completed

### Feedback System
- [x] Admin configurable feedback questions
- [x] 1-10 rating radio buttons per question
- [x] Auto-opens after "Send to Manager"
- [x] Optional skip option
- [x] Feedback attached to bill for manager/admin review

### MRP Mode (New)
- [x] Tag number, item name, gross weight
- [x] Studded weight section (diamond/solitaire/colored stones) - only weights, deducted from gross
- [x] Net weight = gross - sum of studded weights
- [x] MRP field (in rupees, includes GST)
- [x] Discount section: percentage or flat rupees (or both)
- [x] After discount amount = MRP - discounts (this is WITH GST)
- [x] Amount without GST = after_discount / 1.03
- [x] In items list, shows amount without GST (3% added at bill total)

### UI/UX
- [x] Mobile-responsive layouts across all dashboards
- [x] Pure CSS mobile sidebar (replaced Radix Sheet for reliability)
- [x] Bigger logos throughout app
- [x] "Made with Emergent" badge hidden
- [x] AJPL Calculator branding with custom logo

## Key API Endpoints
- `POST /api/auth/request-otp` - Generate OTP
- `POST /api/auth/verify-otp` - Verify OTP, get JWT
- `POST /api/auth/login` - Admin password login
- `GET/POST/DELETE /api/salespeople` - Salesperson CRUD
- `GET/POST/DELETE /api/feedback-questions` - Feedback question CRUD
- `POST /api/bills/{id}/feedback` - Submit customer feedback
- `GET /api/bills/{id}/feedback` - Get bill feedback
- `GET/PUT /api/settings/tiers` - Customer tier settings
- `GET /api/notifications` - Notifications with auto-generation
- `PUT /api/notifications/{id}/done|pending` - Task management
- `POST /api/upload/photo` - Upload item photo
- `POST /api/calculate/mrp-item` - MRP calculation
- `PUT /api/customers/{id}` - Update customer details

## Database Collections
users, bills, customers, purities, rate_cards, item_names, branches, otps, salespeople, feedback_questions, feedbacks, notifications, settings

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive:** OTP-based (e.g., exec1)
