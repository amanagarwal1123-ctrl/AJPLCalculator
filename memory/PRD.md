# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Buyback Rates (March 2026)
- New "buyback" rate card alongside "normal" and "ajpl"
- Buyback Rates tab in Rate Management page (admin)
- Buyback rates display on Admin, Manager, and Sales Exec dashboards
- Only purities with rate > 0 shown; auto-synced with purity additions/deletions

### Reference Normalization & Edit (March 2026)
- Aggressive Unicode normalization (zero-width chars, NBSP, BOM etc.)
- Known reference lookup table for canonical forms
- PUT /api/bills/{bill_id}/reference: admin-only bill reference update
- POST /api/admin/normalize-references: one-time data cleanup
- GET /api/admin/reference-diagnostics: raw hex debugging

### Data Safety Backup (March 2026)
- AES-256-CBC encrypted .dat backup with AJPLDAT1 container format
- Excel .xlsx snapshot, import with merge/replace modes
- Audit logging, decode instructions for disaster recovery

### Session Management
- Admin sessions with IP/user-agent, End All Sessions button

### Security & Authorization
- Bill access control, manager branch scoping
- Customer profile → bills sync (write + read enrichment)

### Business Logic
- Diamond calculation on gross_weight, multi-phone customers
- Today's Sales only counts approved bills

## Key Endpoints
- `GET/PUT /api/rates/buyback` - Buyback rate card CRUD
- `PUT /api/bills/{bill_id}/reference` - Admin edit bill reference
- `POST /api/admin/normalize-references` - Normalize all references

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
