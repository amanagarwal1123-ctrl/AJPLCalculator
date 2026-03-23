# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Reference Normalization & Edit (March 2026)
- Robust normalize_reference() that strips ALL invisible Unicode chars (zero-width spaces, BOM, NBSP, control chars, etc.)
- Known reference lookup table for canonical forms (Instagram, Facebook, Walk-in, etc.)
- Applied at write-time (customer create, bill create, customer update, bill reference update)
- Applied at read-time (analytics dashboard, reference-breakdown, reference-report)
- POST /api/admin/normalize-references: one-time data cleanup with hex diagnostics
- GET /api/admin/reference-diagnostics: shows raw hex/char codes for debugging
- PUT /api/bills/{bill_id}/reference: admin-only bill reference update (no status change)
- Frontend inline edit UI on BillPage with dropdown + save/cancel

### Data Safety Backup (March 2026)
- AES-256-CBC encrypted .dat backup with AJPLDAT1 container format
- Excel .xlsx snapshot with one sheet per collection
- Import with merge or replace_current_year_data modes
- Dry-run preview before applying import
- Decode instructions .txt for disaster recovery
- Audit logging to `backup_audit_logs` collection
- Frontend page at `/admin/data-safety` with modals

### Session Management
- Admin sessions stored with IP/user-agent
- Grouped sessions UI with expand/collapse
- End All Sessions button

### Security & Authorization
- Bill access control, notification ownership checks
- Manager branch scoping, mandatory branch for managers
- Customer profile changes propagate to bills (write + read enrichment)

### Business Logic
- Diamond calculation on gross_weight
- Today's Sales only counts approved bills
- Multi-phone customer with customer_id on bills

### UI/UX
- Reference on bill cards, auto-refresh, URL tab state
- Home button on non-dashboard pages, feedback filter

## Key Endpoints
- `PUT /api/bills/{bill_id}/reference` - Admin edit bill reference
- `POST /api/admin/normalize-references` - Normalize all references (with hex diagnostics)
- `GET /api/admin/reference-diagnostics` - Raw hex/char codes for debugging

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
