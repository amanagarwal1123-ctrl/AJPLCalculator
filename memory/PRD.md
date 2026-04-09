# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Tablet Layout Optimization (April 2026)
- Redesigned NumpadModal: centered max-w-xl, 72px buttons, rounded-2xl, scale-on-press animation
- NumericInput: chevron indicator for tappability, 52px min-height on tablet
- Global CSS tablet rules (≥768px): 48px inputs, 42px buttons, 14px labels
- ItemCalculator: 56px weight inputs, larger charge buttons, bigger summary sidebar
- RateManagement: larger rate cards with 56px inputs
- JetBrains Mono font for all numeric displays

### Custom Numpad for Tablet Input (April 2026)
- Phone-style NumpadModal with 0-9, dot, backspace, Done
- NumericInput replaces all type="number" inputs app-wide
- Applied across: ItemCalculator, MrpCalculator, RateManagement, BillPage

### Old Gold (OG) Feature (April 2026)
- OG section in Bill Summary with photo upload + value
- Brown "OG" badge on Admin/Manager dashboard bill cards

### Buyback Rates (March 2026)
- "buyback" rate card alongside "normal" and "ajpl"
- Displayed on all dashboards

### Reference Normalization & Edit (March 2026)
- Aggressive Unicode normalization, admin bill reference edit

### Data Safety Backup, Session Management, Business Logic
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
