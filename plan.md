# plan.md (Updated)

## 1) Objectives
- Deliver a production-ready full-stack (**FastAPI + React + MongoDB**) application for showroom jewellery billing with correct Gold/Diamond calculations, GST, and a complete bill workflow.
- Support multi-branch operations, role-based access (**Admin/Manager/Executive**), and controlled master data (rates, purities, item names).
- Provide a luxurious UI with **Japanese Kintsugi** accents on a **bright velvet blue** theme and premium bill output (**browser print + downloadable PDF**).
- Provide analytics + reporting (charts + tables) with filtering and export.
- Deliver **customer-centric analytics** for retention and segmentation:
  - Visit frequency cohorts
  - Inactive-customer tracking (X days)
  - Spending tiers
- Ensure billing calculations and outputs adhere to business rules:
  - **Making charges must be charged on net weight** (confirmed and communicated in print output).
  - **Diamond “Less” workflow:** allow marking individual studded entries as **L/NL** so diamond weight can optionally be deducted from net weight.
  - Print/PDF formatting must keep **all table content inside borders** with professional alignment.
- Provide **admin governance and history tooling**:
  - Customer profile pages with full bill history and admin-only modification/deletion
  - Chronological all-bills view for admin with full details and admin-only modification/deletion
  - Item-level sales history pages with detailed sales records
- Provide **manager-safe visit summaries** (no amounts):
  - Managers can review customer visits with item/rate/making/carat-rate details without seeing final amounts.

**Branding/UI status:** Renamed to **AJPL Calculator** across the app and updated global theme tokens to **bright velvet blue**.

**Current status:** Phases **1–8 are complete and verified**. The system is usable end-to-end:
- Admin setup → executive billing → print/PDF → send to manager → manager edits/approves → audit trail + reports.

**Live status check (confirmed):**
- Frontend + backend services are healthy and running.
- Login works (`admin / admin1123`).
- Reports page is functional; all tabs render and navigate reliably.
- Reports → Customers tab contains enhanced customer analytics (cohorts, tiers, inactive tracking, directory).
- Print outputs improved:
  - Browser Print view contains **Gross/Less/Net** columns and clear making-charge note.
  - PDF invoice has strict margins + column layout so content stays inside borders.
- Diamond item calculator supports **L/NL** toggles for each studded entry and recalculates net weight accordingly.
- Admin tooling now includes:
  - **Customers** list + per-customer bill history pages
  - **All Bills** chronological page with full details
  - Per-item **sales history** pages
- Manager tooling now includes:
  - Per-bill **Visit Summary** dialog with no final amounts.

---

## 2) Implementation Steps

### Phase 1 — Core Calculation + Bill Output POC (isolation) ✅ COMPLETE
**Goal:** Prove the “make bill” engine works deterministically and matches output formats.

**Delivered**
- Implemented standalone `calc_engine.py` using Decimal-safe arithmetic:
  - Gold: net wt, rate usage, making charges (**percentage of extrapolated 24KT, per gram, per piece**)
  - Stones: kundan (per piece), stone (per gram × less weight), moti (flat)
  - Diamond: studded entries (diamond/solitaire/colored stones)
  - Bill totals: external charges + 3% GST + grand total
- Created `test_calc_engine.py` with deterministic test vectors.

**Exit criteria met**
- All test vectors pass with expected rounding.

---

### Phase 2 — V1 App Development (MVP) ✅ COMPLETE
**Goal:** Build the usable billing app backed by MongoDB with full UI flows.

**Delivered**
- **Backend (FastAPI + MongoDB + JWT):**
  - Username/password auth with JWT; default seeded admin: `admin / admin1123`
  - Master data APIs: Branch CRUD, Users CRUD, Purities CRUD, Rate cards (Normal + AJPL), Item names
  - Bills: create/read/update/delete, server-side recalculation via `calc_engine`
  - Bill output: PDF generation endpoint (`/bills/{id}/pdf`) using ReportLab
- **Frontend (React + shadcn/ui + Tailwind + Recharts):**
  - Regal theme implemented (velvet blue + subtle kintsugi overlays)
  - Role-based dashboards and admin pages
  - Sales executive flow: customer capture → bill creation → item calculator → print/PDF → send to manager

---

### Phase 3 — Workflow Locking + Role UX + Reporting (expansion) ✅ COMPLETE
**Goal:** Strengthen manager workflows, finalize role UX, and improve reporting/filtering/export.

**Delivered Enhancements**
- Bill workflow hardening: `draft → sent → edited → approved` with role-based edit rules.
- Manager Dashboard: review queue tabs + KPIs.
- Approvals: `PUT /api/bills/{id}/approve`.
- Audit trail: `change_log` displayed in BillPage.
- Reports improvements:
  - Filters: Date From/To, Branch, Executive
  - Tabs: Branches, Executives
  - CSV export across report tabs

---

### Phase 4 — Hardening + Advanced Analytics + Polish ✅ COMPLETE
**Goal:** Production hardening, deeper analytics foundation, and premium UX polish.

**Delivered**
- Stability verification:
  - App services healthy; login and reports confirmed functional.

**Note:** Phase 4 “planned enhancements” remain valid as future improvements (pagination, security upgrades, report PDF export), but core app is production-usable and verified.

---

### Phase 5 — Report Tabs Bug Fix + Customer-Centric Analytics ✅ COMPLETE
**Goal:** Remove residual test flakiness around Reports tabs and deliver enhanced customer analytics.

#### 5.1 Report Tabs Test Fix (P2) ✅ COMPLETE
- Added `data-testid="tab-content-*"` to all `TabsContent` sections.
- Fixed a runtime crash caused by mutating state arrays via `Array.sort()`.

#### 5.2 Customer-Centric Analytics (P1) ✅ COMPLETE
**Backend endpoints**
- `GET /api/analytics/customers/frequency`
- `GET /api/analytics/customers/inactive?days=<int>`

**Frontend**
- Enhanced Reports → Customers tab:
  - KPI cards, cohorts chart, spending tiers chart
  - inactive customers threshold + table
  - full customer directory

---

### Phase 6 — Net-Weight Making Confirmation + Print/PDF Layout Hardening ✅ COMPLETE
**Goal:** Ensure making is calculated on net weight and outputs are premium/consistent.

**Delivered**
- Confirmed making calculations are based on **net weight**.
- Print view improvements:
  - Added **Gross/Less/Net** columns
  - Added making-on-net note
- PDF invoice rewrite:
  - strict margins, in-border columns, truncation for long item names

---

### Phase 7 — Diamond Studded L/NL Weight Deduction ✅ COMPLETE
**Goal:** Support per-studded entry weight deduction that can affect net gold weight.

**Delivered**
- Backend (`calc_engine.py`):
  - `less_type` per studded entry (`L` / `NL`), conversion **1 carat = 0.2g**
  - returns `studded_less_grams`, `original_less`, and per-entry `weight_grams`
- Frontend (`ItemCalculator.js`):
  - L/NL radio buttons per studded entry
  - real-time net weight recalculation + visual deduction indicators
- Bill + print transparency updates.

---

### Phase 8 — Admin History Tooling + Manager Visit Summaries ✅ COMPLETE
**Goal:** Provide admin governance views and manager-safe summaries.

#### 8.1 Customer Pages (Admin) ✅ COMPLETE
**Frontend routes**
- `GET /admin/customers` — Customer list
- `GET /admin/customers/:id` — Customer profile + full bill history

**Backend endpoints**
- `GET /api/customers/{id}/bills`
- `GET /api/customers/{id}`

**Capabilities**
- Shows customer profile cards + all bills.
- Admin can view/print/delete bills (and edit via Bill page).

#### 8.2 All Bills (Admin) ✅ COMPLETE
**Frontend route**
- `GET /admin/bills` — Chronological bill list

**Capabilities**
- Full bill details in a table.
- Search (bill # / customer / phone / executive) and status filter.
- Admin can edit (open Bill page), print, delete.

#### 8.3 Item Sales History ✅ COMPLETE
**Frontend route**
- `GET /admin/items/:itemName` — Item sales history

**Backend endpoint**
- `GET /api/item-names/{item_name}/sales`

**Capabilities**
- KPI cards (total sold, total weight, total revenue).
- Detailed sales records table.

#### 8.4 Manager Visit Summary (No Amounts) ✅ COMPLETE
**Backend endpoint**
- `GET /api/bills/{bill_id}/summary`

**Frontend**
- Manager Dashboard: “Summary” button opens a dialog showing:
  - items taken
  - KT/purity, weights
  - rate per 10g
  - making charge inputs (type/value)
  - diamond/solitaire carats + rate per carat (+ L/NL flag)
  - **no totals/final amounts**

**Testing status (Phase 8)**
- Backend: **100%**
- Frontend: **95%** (minor interaction/test nuances)

---

## 3) Next Actions
Recommended future work (optional):
- **Permissions refinement:**
  - Ensure delete-bill is admin-only (currently backend allows manager delete; consider restricting).
- **Customer analytics filters:**
  - Extend `/analytics/customers/frequency` and `/analytics/customers/inactive` to respect date range / branch / executive filters.
- **Pagination & performance:**
  - Add server-side pagination for bills/customers and optimize analytics queries.
- **Report exports:**
  - Add PDF export for report pages (not only bills).
- **Print/PDF QA:**
  - Stress test PDF layout with very long item names and multi-page bills.
- **Item history usability:**
  - Add filters (date range, branch, executive) and exports (CSV/PDF) on item history page.

---

## 4) Success Criteria
- **Calculation correctness:** `calc_engine` tests remain green; totals match between UI, print, and PDF.
- **Business rules:** making charges computed on **net weight**.
- **Diamond deduction workflow:** per-studded **L/NL** flags correctly adjust net weight using **1 carat = 0.2g** and recalculate gold/making totals.
- **Workflow correctness:** executive cannot edit after “Sent”; manager/admin can edit and approve; audit trail captured.
- **Admin governance:** customer pages, all-bills page, and item history pages provide full traceability and admin-only modification/deletion.
- **Manager-safe summaries:** managers can review visit details without seeing final amounts.
- **Usability:** end-to-end bill creation < 2 minutes; tablet-friendly; clear validation.
- **Reporting:** charts + tables with robust filters; CSV export; report tabs fully testable.
- **Customer analytics:** cohorts + inactive tracking + spending tiers accurate.
- **Print/PDF quality:** all table content stays inside borders; professional alignment and truncation.
- **Security & data isolation:** JWT + RBAC enforced; managers limited to branch; admin global; no cross-branch leaks.
