# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Old Gold (OG) Feature (April 2026)
- OG section in Bill Summary: checkbox toggle after Grand Total, before action buttons
- Expands to show photo upload + value input (display-only, not in calculations)
- Brown/amber color scheme (hsl 30 range)
- PUT /api/bills/{bill_id}/old-gold endpoint
- OG badge visible on Admin Dashboard and Manager Dashboard bill cards
- OG shown in Manager summary dialog
- Bill summary endpoint includes old_gold field

### Buyback Rates (March 2026)
- "buyback" rate card alongside "normal" and "ajpl"
- Buyback Rates tab in Rate Management page (admin)
- Buyback rates display on Admin, Manager, and Sales Exec dashboards

### Reference Normalization & Edit (March 2026)
- Aggressive Unicode normalization (zero-width chars, NBSP, BOM etc.)
- Known reference lookup table for canonical forms
- PUT /api/bills/{bill_id}/reference: admin-only bill reference update
- POST /api/admin/normalize-references: one-time data cleanup

### Data Safety Backup (March 2026)
- AES-256-CBC encrypted .dat backup, Excel snapshots, import modes

### Session Management
- Admin sessions with IP/user-agent, End All Sessions

### Business Logic
- Diamond calculation, multi-phone customers, today's sales approved-only

## Key Endpoints
- `PUT /api/bills/{bill_id}/old-gold` - Set OG data (enabled, photo, value)
- `GET/PUT /api/rates/buyback` - Buyback rate card CRUD
- `PUT /api/bills/{bill_id}/reference` - Admin edit bill reference

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
