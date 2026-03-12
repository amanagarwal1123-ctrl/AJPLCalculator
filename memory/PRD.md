# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

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

## New Endpoints (Data Safety)
- `GET /api/admin/backup/status` - Backup status with last export info
- `POST /api/admin/backup/export` - Export encrypted .dat
- `POST /api/admin/backup/export-excel` - Export Excel snapshot
- `POST /api/admin/backup/import/preview` - Dry-run import preview
- `POST /api/admin/backup/import/apply` - Apply import
- `GET /api/admin/backup/decode-instructions` - Download instructions

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
