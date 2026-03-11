# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (Beanie ODM)
- **Frontend**: React + Shadcn/UI + Tailwind
- **Auth**: JWT-based with OTP for sales execs, password for admin

## What's Been Implemented

### Session Management (Latest - March 2026)
- Admin sessions now stored in active sessions (previously skipped)
- Sessions capture IP address and user-agent on login
- Sessions API returns grouped data by user with session count
- Frontend shows expandable accordion per user with device, IP, and login time

### Security & Authorization
- Bill access control with `assert_bill_access` helper
- Notification ownership checks
- Manager branch scoping on all analytics endpoints
- Mandatory branch for manager role

### Business Logic
- Diamond calculation uses gross_weight for making charges
- Today's Sales KPI only counts approved bills
- Multi-phone customer flow with `customer_id` on bills

### UI/UX
- Reference displayed on bill cards
- 30-second auto-refresh on dashboards
- URL-based tab state persistence (back button fix)
- Home button on all non-dashboard pages
- Feedback filter for comments with distinct styling

## Prioritized Backlog
### P1 - Refactoring (CRITICAL)
- [ ] Break `backend/server.py` into modular FastAPI routers
- [ ] Decompose `Reports.js` into sub-components

### P2 - Medium Priority
- [ ] Refactor `SalesExecDashboard.js` state logic
- [ ] Implement real OTP delivery (currently mocked)

## Credentials
- Admin: `admin` / `admin1123`
- Sales exec test phone: `8989898989`
