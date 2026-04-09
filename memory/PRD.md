# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Custom Numpad for Tablet Input (April 2026)
- Phone-style NumpadModal with 0-9, dot, backspace, Done button
- NumericInput component replaces all type="number" inputs
- Opens on tap, shows current value, confirms on Done
- Re-opening preserves existing value for editing
- JetBrains Mono font for improved number legibility
- Applied across: ItemCalculator, MrpCalculator, RateManagement, BillPage

### Old Gold (OG) Feature (April 2026)
- OG section in Bill Summary: checkbox toggle after Grand Total
- Photo upload + value input (display-only, not in calculations)
- Brown "OG ₹X" badge on Admin/Manager dashboard bill cards

### Buyback Rates (March 2026)
- "buyback" rate card alongside "normal" and "ajpl"
- Displayed on Admin, Manager, and Sales Exec dashboards

### Reference Normalization & Edit (March 2026)
- Aggressive Unicode normalization for references
- Admin can edit bill reference inline

### Data Safety Backup (March 2026)
- AES-256-CBC encrypted .dat backup, Excel snapshots, import modes

### Session Management
- Admin sessions with IP/user-agent, End All Sessions

## Key Files
- `context/NumpadContext.js` - Global numpad state management
- `components/NumpadModal.js` - Phone-style numpad overlay
- `components/NumericInput.js` - Drop-in number input replacement

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
