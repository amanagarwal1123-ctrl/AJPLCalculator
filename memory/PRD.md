# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Bill List Pagination (April 2026)
- 8-day pages for all Admin Dashboard tabs (Pending, Approved, Drafts, All)
- Cyclops lens wheel paginator at top and bottom of bill list
- Active page shown as large golden circle, adjacent pages scale down
- Page resets to 1 when switching tabs
- Shows "Showing X days (Y bills) · Page N of M" info

### Tablet Layout Optimization (April 2026)
- Redesigned NumpadModal: centered max-w-xl, 72px buttons, scale-on-press
- NumericInput: chevron indicator, 52px min-height on tablet
- Global CSS tablet rules: larger inputs/buttons/labels
- ItemCalculator/RateManagement: larger inputs and buttons

### Custom Numpad, Old Gold, Buyback Rates, Reference Normalization
- All previously implemented features intact

## Prioritized Backlog
### P1 - Refactoring
- [ ] Break `backend/server.py` into modular FastAPI routers
- [ ] Decompose `Reports.js` into sub-components

### P2 - Medium Priority
- [ ] Refactor `SalesExecDashboard.js`
- [ ] Implement real OTP delivery

## Credentials
- Admin: `admin` / `admin1123`
- Sales exec test phone: `8989898989`
