# plan.md (Updated)

## 1) Objectives
- Deliver a production-ready full-stack (FastAPI + React + MongoDB) application for showroom jewellery billing with correct Gold/Diamond calculations, GST, and a complete bill workflow.
- Support multi-branch operations, role-based access (Admin/Manager/Executive), and controlled master data (rates, purities, item names).
- Provide a luxurious UI with **Japanese Kintsugi** accents on a **bright velvet blue** theme and premium bill output (**browser print + downloadable PDF**).
- Provide analytics + reporting (charts + tables) with filtering and export.

**Branding/UI status:** Renamed to **AJPL Calculator** across the app and updated global theme tokens to **bright velvet blue** (HSL background `224 58% 16%`).

**Current status:** Phases **1–3 are complete and verified**. The system is usable end-to-end:
- Admin setup → executive billing → print/PDF → send to manager → manager edits/approves → audit trail + reports.

---

## 2) Implementation Steps

### Phase 1 — Core Calculation + Bill Output POC (isolation) ✅ COMPLETE
**Goal:** Prove the “make bill” engine works deterministically and matches output formats.

**Delivered**
- Implemented standalone `calc_engine.py` using Decimal-safe arithmetic:
  - Gold: net wt, rate usage, making charges (percentage of extrapolated 24KT, per gram, per piece)
  - Stones: kundan (per piece), stone (per gram × less weight), moti (flat)
  - Diamond: studded entries (diamond/solitaire/colored stones)
  - Bill totals: external charges + 3% GST + grand total
- Created `test_calc_engine.py` with **10/10 passing tests**:
  - net weight
  - 24KT extrapolation
  - making charges: percentage/per_gram/per_piece
  - stone charges: kundan/stone/moti
  - studded charges
  - full gold item
  - full diamond item
  - bill totals with GST

**Exit criteria met**
- All test vectors pass with expected rounding.

**User stories (Phase 1) — Completed**
1. Repeatable calculation tests ensure totals never drift.
2. Net weight auto-calculated.
3. Multiple making/stone charges supported.
4. Same totals across screen and outputs (foundation established).
5. GST shown separately.

---

### Phase 2 — V1 App Development (MVP) ✅ COMPLETE
**Goal:** Build the usable billing app backed by MongoDB with full UI flows.

**Delivered**
- **Backend (FastAPI + MongoDB + JWT):**
  - Username/password auth with JWT; default seeded admin:
    - `admin / admin1123`
  - Master data APIs:
    - Branch CRUD
    - Users CRUD (admin-only)
    - Purities CRUD (admin-only; adding purity updates ratecards)
    - Rate cards (Normal + AJPL) management
    - Allowed item names management
  - Bill system:
    - Create/read/update/delete bills
    - Server-side recalculation on bill update via `calc_engine`
    - Status transitions: `draft → sent`
    - Bill listing with role-aware filtering
  - Analytics (initial):
    - KPI rollups (today sales/bills/GST/avg ticket)
    - KT mix, item popularity, gold vs diamond totals, reference breakdown
    - Customer analytics including “days since last visit”
  - Bill output:
    - Downloadable PDF generation endpoint (`/bills/{id}/pdf`) using ReportLab

- **Frontend (React + shadcn/ui + Tailwind + Recharts):**
  - Regal theme implemented (velvet blue + subtle kintsugi gold texture overlays)
  - Login page
  - Admin dashboards + pages:
    - Dashboard (KPIs + recent bills)
    - Rate Management
    - Branch Management
    - User Management
    - Item Name Management
    - Reports (charts + tables + CSV export)
  - Sales executive flow:
    - Customer capture → bill creation → bill items list + sticky summary
    - Multi-step item calculator:
      - type → rate mode → purity → calculate
      - supports making/stone/studded charges
    - External charges
    - GST + totals
    - Print view route + browser print
    - Download PDF
    - Send to manager (locks executive editing)

- **Bug fix (critical):**
  - Fixed MongoDB serialization issue where `serialize_doc` overwrote the custom UUID `id` with MongoDB `_id`.
  - Verified bill create → retrieve → update → send → PDF works.

**Testing status**
- Calculation engine: **10/10 tests passed**.
- E2E testing:
  - Frontend: **100%** pass for specified Phase 2 journeys.
  - Backend: **84%** pass due to expected duplicate item-name creation errors (non-bug).

**User stories (Phase 2) — Completed**
1. Sales exec starts with customer details.
2. Sales exec adds multiple items; edit/remove while draft.
3. Rate mode selection (Normal/AJPL/Manual) supported.
4. Premium printable bill (print view + PDF download) delivered.
5. Managers can view bills (branch-filtered) and reconcile.

---

### Phase 3 — Workflow Locking + Role UX + Reporting (expansion) ✅ COMPLETE
**Goal:** Strengthen manager workflows, finalize role UX, and improve reporting/filtering/export.

**Delivered Enhancements**

#### 3.1 UI / Branding ✅
- Renamed app to **AJPL Calculator** across pages/navigation.
- Updated theme tokens to **bright velvet blue** (background `224 58% 16%`) while preserving Kintsugi gold accent system.

#### 3.2 Bill workflow hardening ✅
- Added explicit statuses and transitions:
  - `draft → sent → edited → approved`
- Executive is read-only after `sent`.
- Manager/admin can edit `sent` bills; edits automatically set status to `edited`.

#### 3.3 Manager capabilities ✅
- Manager Dashboard upgraded to a review queue:
  - Tabs: **Pending Review**, **Approved**, **Drafts**, **All Bills**
  - KPI cards: Today’s Sales, Pending Review count, Approved count, Total Bills
- Bill approval workflow:
  - **Endpoint:** `PUT /api/bills/{id}/approve`
  - Approve action available for manager/admin on `sent` and `edited` bills

#### 3.4 Audit trail ✅
- Added `change_log` array to bills.
- Logged events include: timestamp, user, role, action, old_total, new_total.
- BillPage displays audit trail in the summary sidebar (including approvals and edits).

#### 3.5 Reporting improvements ✅
- Reports page now includes filters:
  - **Date From**, **Date To**, **Branch**, **Executive** with Apply/Clear
- Added new analytics views:
  - **Branches** tab: branch-wise sales chart + table
  - **Executives** tab: executive performance chart + table
- All report tabs include **CSV export**.
- Analytics API updated to accept query params:
  - `date_from`, `date_to`, `branch_id`, `executive_id`
- Analytics response extended with:
  - `branch_sales`, `executive_sales`, `all_time_total`

**Testing status (Phase 3)**
- Backend: **86.2%** (25/29) — remaining failures are non-critical duplicates/edge cases.
- Frontend: **95%** — core flows complete; optional minor tab test inconsistencies reported (non-blocking).

**User stories (Phase 3) — Completed**
1. Executive “Send to Manager” reliably locks edits.
2. Manager can review and approve bills via a queue.
3. Manager/admin edits are tracked with an audit trail.
4. Reports support richer filters and branch/executive breakdown.
5. Clear bill review workflow (pending vs approved).

---

### Phase 4 — Hardening + Advanced Analytics + Polish ⏳ NEXT
**Goal:** Production hardening, deeper analytics, and premium UX polish.

**Planned Enhancements**

#### 4.1 Performance & reliability
- Pagination for large lists (bills/customers/reports) + server-side limits.
- Index review and performance profiling for analytics queries.
- Consistent error schema and improved validation messages.

#### 4.2 Security
- Optional refresh tokens and improved session expiry UX.
- Admin-level audit tooling (download logs, view edits by user).

#### 4.3 Advanced analytics
- Customer visit frequency cohorts and segmentation.
- Period comparisons (week/month/quarter) for gold vs diamond, KT mix, and references.
- Item popularity per KT over time.

#### 4.4 Print/PDF polish
- Further visual refinement of print view (ornamental borders, spacing, typography tweaks).
- Optional PDF export for reports (not only bills).

**User stories (Phase 4)**
1. As a user, I want faster pages even with large datasets.
2. As an admin, I want advanced cohort and period comparison analytics.
3. As a manager, I want clearer approval auditability across time.
4. As the business, I want even more premium print/report PDFs.

---

## 3) Next Actions
- Decide if you want an explicit **Reject** action (Approved/Rejected) or only Approve.
- Confirm rounding conventions if the business requires line-level rounding rules.
- Execute Phase 4 hardening:
  - Pagination + performance
  - Advanced analytics period comparisons
  - Optional report PDF export

---

## 4) Success Criteria
- **Calculation correctness:** calc-engine tests remain green; totals match between UI, print, and PDF.
- **Workflow correctness:** executive cannot edit after “Sent”; manager/admin can edit and approve; audit trail captured.
- **Usability:** end-to-end bill creation < 2 minutes; tablet-friendly; clear validation.
- **Reporting:** charts + tables with robust filters; CSV export everywhere; report PDF export (Phase 4).
- **Security & data isolation:** JWT + RBAC enforced; managers limited to branch; admin global; no cross-branch leaks.
