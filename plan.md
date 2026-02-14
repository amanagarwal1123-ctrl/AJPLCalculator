# plan.md

## 1) Objectives
- Deliver an MVP full-stack (FastAPI + React + MongoDB) for showroom jewellery sales billing with correct Gold/Diamond calculations, GST, and bill workflow (draft → sent → manager/admin editable).
- Support multi-branch operations, role-based access (Admin/Manager/Executive), and controlled master data (rates, purities, item names).
- Provide regal UI (royal velvet blue + Japanese Kintsugi backgrounds) and high-quality bill output (browser print + PDF).
- Provide analytics + reporting (charts + tables) with CSV/PDF export.

## 2) Implementation Steps

### Phase 1 — Core Calculation + Bill Output POC (isolation)
**Goal:** Prove the “make bill” engine + print/PDF works end-to-end with deterministic totals.
- Web-search best practices for:
  - Monetary arithmetic (Decimal handling), rounding rules for GST
  - HTML-to-PDF in web apps (Playwright/Puppeteer vs WeasyPrint vs browser print CSS)
- Implement a standalone `calc_engine` module (no DB/UI) covering:
  - Gold item totals: net wt, rate selection, making charges (percent / per g / per piece), stone charges (kundan/stone/moti)
  - Diamond item totals: studded entries (diamond/solitaire/colored) + gold base
  - Bill totals: external charges, 3% GST, grand total
- Write Python tests (pytest) with fixed fixtures for each charge type + mixed items; verify totals and rounding.
- Create minimal FastAPI POC endpoints:
  - `POST /poc/calc` returns full breakdown JSON
  - `GET /poc/bill/print` HTML template + print CSS
  - `GET /poc/bill/pdf` downloadable PDF
- Exit criteria: all test vectors pass; PDF/print render matches the same numbers as JSON.

**User stories (Phase 1)**
1. As a developer, I want repeatable calculation tests so totals never drift.
2. As a sales exec, I want net weight auto-calculated so I don’t do manual subtraction.
3. As a sales exec, I want multiple making/stone charges so complex items are modeled accurately.
4. As a manager, I want the same totals across screen, print, and PDF so auditing is consistent.
5. As an admin, I want GST shown separately so compliance is clear.

### Phase 2 — V1 App Development (MVP, core flows first; delay auth)
**Goal:** Build usable billing app with branches + draft bills, backed by MongoDB.
- Backend (FastAPI):
  - Data models: Branch, User (role), Customer, RateCard (Normal/AJPL + purities), ItemName, Bill (status), BillItem (gold/diamond), Charges
  - CRUD APIs for: customers, bills (draft), bill items, external charges
  - Server-side calculation: store inputs; compute totals via `calc_engine` on read/save
  - Basic filtering: by date, branch, executive
- Frontend (React):
  - Regal theme (velvet blue) + Kintsugi background layout system
  - Flows:
    - Customer capture screen → Make Bill → Items list → Add Gold/Diamond → Charges → Totals
    - Rate mode selection (Normal/AJPL/Manual) + purity selection
    - Item name dropdown sourced from backend
    - Inline edit/remove items while in draft
  - Print view + PDF download buttons wired to backend
- Seed data:
  - Default admin user placeholder (auth still delayed), sample branch, default purities
- End Phase test: run 1 full E2E manual pass (create customer → add gold + diamond → external charges → totals → print/PDF).

**User stories (Phase 2)**
1. As a sales exec, I want to start with customer details so every bill is traceable.
2. As a sales exec, I want to add multiple items and edit them before finalizing.
3. As a sales exec, I want to choose Normal/AJPL/Manual rates so I can handle special cases.
4. As a sales exec, I want a beautiful printable bill so customers get a premium experience.
5. As a manager, I want to view all bills for my branch/day so I can reconcile quickly.

### Phase 3 — Workflow Locking + Role UX + Reporting (still minimal auth gating)
**Goal:** Add “Send to Manager” workflow and build reporting foundations.
- Bill workflow:
  - Statuses: Draft (exec editable) → Sent (exec read-only) → Edited/Final (manager/admin)
  - Audit fields: created_by, sent_at, last_modified_by, change log (minimal)
- Admin/master data screens:
  - Rate management: Normal/AJPL rates for purities + ability to add purity
  - Item name allow-list management
  - Branch management UI + assignment (manager/executive)
- Reporting MVP:
  - Daily sales tables + filters (date range, branch, exec, KT)
  - Exports: CSV for tables, PDF export of report view
  - Initial charts: sales over time, KT mix, gold vs diamond
- End Phase test: E2E (exec drafts → sends → manager edits → exports report).

**User stories (Phase 3)**
1. As a sales exec, I want “Send to Manager” to lock my bill so mistakes aren’t introduced later by me.
2. As a manager, I want to edit sent bills so corrections can be made with oversight.
3. As an admin, I want to manage rates/purities so pricing stays current.
4. As an admin, I want branch-level reporting so each showroom is measurable.
5. As a manager, I want CSV/PDF exports so I can share reports externally.

### Phase 4 — Authentication/Authorization (JWT) + Hardening + Advanced Analytics
**Goal:** Production-ready access control + requested analytics.
- Auth:
  - Username/password login with JWT (access/refresh)
  - Password hashing (bcrypt/argon2)
  - Seed default admin: `admin / admin1123`
- RBAC enforcement:
  - Exec: create/edit drafts; view own sent
  - Manager: view/edit bills for assigned branch
  - Admin: global access + master data + deletes
- Advanced analytics:
  - Customer visit frequency, days since last visit
  - Reference tracking (instagram/friends/repeat/etc.)
  - Item popularity per KT, KT category sales analysis
  - Diamond vs gold sales by period/branch
- Hardening:
  - Input validation, Decimal-safe money handling end-to-end
  - Pagination, indexes, backup-friendly data shapes
  - Error states UX (offline, validation, permission denied)
- End Phase test: multi-user role testing + regression on calc/print/PDF.

**User stories (Phase 4)**
1. As a user, I want secure login so my work and branch data are protected.
2. As an admin, I want seeded admin access on day 1 so deployment is simple.
3. As a manager, I want branch-only visibility so I don’t see other branches.
4. As an admin, I want customer frequency analytics so marketing decisions improve.
5. As an admin, I want diamond vs gold breakdown so inventory strategy is data-driven.

## 3) Next Actions
- Confirm rounding rules (paise precision) and any shop-specific conventions (round per line-item vs final total).
- Execute Phase 1: implement `calc_engine` + pytest vectors + HTML print + PDF endpoint.
- Review POC output screenshots + sample PDF with you; lock calculation rules.
- Proceed to Phase 2 V1 build once POC is green.

## 4) Success Criteria
- Calculation correctness: all predefined test vectors pass; identical totals in UI, print, and PDF.
- Workflow correctness: exec cannot edit after “Sent”; manager/admin can edit/delete sent bills.
- Usability: end-to-end bill creation < 2 minutes with minimal clicks; errors are actionable.
- Reporting: daily/period sales available with filters + CSV/PDF export.
- Security (post-Phase 4): JWT auth + RBAC enforced; default admin works; no cross-branch data leaks.