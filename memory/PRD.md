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
- [x] OTP-based login, admin password login, JWT tokens
- [x] Role-based access control, single-device sessions, admin multi-login

### Admin Features
- [x] Dashboard with KPIs, OTP panel, active sessions
- [x] Bills with daily serial numbers, `0001-DDMMYYYY` bill format
- [x] S.No column + Reference column in All Bills table (Feb 2026)
- [x] Rate Management with auto-heal for empty purities
- [x] Branch/User/Salesperson/Item Name Management
- [x] Customer List with Total Spent, Feedback Questions, Notifications

### Customer Management
- [x] Customer List with Total Spent column
- [x] Customer Profile with all fields: Name, Phone, Email, Location, Reference, DOB, Anniversary, Address, Notes (Feb 2026)
- [x] Customer tier classification

### Reports & Analytics
- [x] 8 tabs: Overview, KT Analysis, Branches, Executives, References, Customers, Top Items, Feedbacks
- [x] Feedbacks tab with date range filter + asc/desc sort by bill value
- [x] Inactive Customers section with user-specified days threshold
- [x] CSV export for all reports

### Calculator Pages
- [x] ErrorBoundary wrapping all routes
- [x] Loading state in ItemCalculator and MrpCalculator
- [x] Gold/Diamond/MRP calculation flows with making/stone/studded charges

### Bill Print View
- [x] B&W printer friendly: white bg, black borders, grayscale logo (Feb 2026)
- [x] Heading: "TENTATIVE INVOICE"
- [x] High contrast for legible B&W output

### Manager Dashboard
- [x] KPI cards, Bill table with fixed widths, Summary dialog

### Sales Executive Features
- [x] Customer intake, multi-bill tab bar, calculators, photo upload, feedback flow

## Credentials
- **Admin:** username=admin, password=admin1123
- **Executive/Manager:** OTP-based (single-device session)

## Mocked Features
- OTP delivery: codes shown on admin dashboard instead of SMS/email

## Prioritized Backlog
- P1: Refactor server.py into route modules (admin, billing, reports)
- P2: Decompose large frontend components
