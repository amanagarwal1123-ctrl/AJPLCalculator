# plan.md (Updated)

## 1) Objectives
- Deliver a production-ready full-stack (FastAPI + React + MongoDB) application for showroom jewellery billing with correct Gold/Diamond calculations, GST, and bill workflow (draft → sent → manager/admin editable).
- Support multi-branch operations, role-based access (Admin/Manager/Executive), and controlled master data (rates, purities, item names).
- Provide a regal UI (royal velvet blue + Japanese Kintsugi backgrounds) and premium bill output (browser print + downloadable PDF).
- Provide analytics + reporting (charts + tables) with CSV/PDF export.

**Current status:** Phase 1 and Phase 2 are complete and verified. The system is usable end-to-end (admin setup → executive billing → print/PDF → send to manager), with automated calc-engine tests and E2E testing completed.

## 2) Implementation Steps

### Phase 1 — Core Calculation + Bill Output POC (isolation) ✅ COMPLETE
**Goal:** Prove the “make bill” engine works deterministically and matches output formats.

**Delivered**
- Implemented standalone `calc_engine.py` using Decimal-safe arithmetic:
  - Gold: net wt, rate usage, making charges (percentage of extrapolated 24KT, per gram, per piece)
  - Stones: kundan (per piece), stone (per gram × less weight), moti (flat)
  - Diamond: studded entries (diamond/solitaire/colored stones)
  - Bill totals: external charges + 3% GST + grand total
- Created a test suite (`test_calc_engine.py`) with **10/10 passing tests**:
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
    - Status transitions: draft → sent
    - Bill listing with role-aware filtering
  - Analytics:
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
  - Frontend: **100% pass** for specified journeys.
  - Backend: **84% pass** due to expected duplicate item-name creation errors (non-bug).

**User stories (Phase 2) — Completed**
1. Sales exec starts with customer details.
2. Sales exec adds multiple items; edit/remove while draft.
3. Rate mode selection (Normal/AJPL/Manual) supported.
4. Premium printable bill (print view + PDF download) delivered.
5. Managers can view bills (branch-filtered) and reconcile.

---

### Phase 3 — Workflow Locking + Role UX + Reporting (expansion) ⏳ NEXT
**Goal:** Strengthen manager workflows, finalize role UX, and improve reporting/export.

**Planned Enhancements**
- Bill workflow hardening:
  - Add explicit statuses: Draft → Sent → Edited/Final (or Approved)
  - Add minimal audit trail (who changed what and when)
  - UI indicators for “Edited by Manager/Admin”
- Manager capabilities:
  - Manager-only edit screen for sent bills (already allowed by API; refine UX + permissions checks)
  - Optional approval action (approve/reject) if desired
- Admin governance:
  - Add deletion safeguards (confirmations; optional soft delete)
  - Add better user assignment flows (bulk assign executives/managers to branches)
- Reporting improvements:
  - Add PDF export for reports (not only bill PDFs)
  - Add filters (date range pickers, branch selector, executive selector) consistently on report pages
  - Add pagination for large data sets

**User stories (Phase 3)**
1. As a sales exec, I want “Send to Manager” to lock my bill reliably.
2. As a manager, I want to edit sent bills with a clear audit trail.
3. As an admin, I want stronger master-data governance (safe deletes, assignment).
4. As an admin/manager, I want richer filters and exports for reporting.
5. As a manager, I want a clear bill review queue.

---

### Phase 4 — Hardening + Advanced Analytics + Polish ⏳ FUTURE
**Goal:** Production hardening, analytics depth, and premium UX polish.

**Planned Enhancements**
- Security + reliability:
  - Refresh tokens (optional) and token expiry UX
  - Stronger validation and error messaging; consistent HTTP error formats
  - Index review + performance profiling; pagination everywhere
  - Backups/export strategy for MongoDB
- Analytics upgrades:
  - Customer visit frequency cohorts
  - Days since last visit segmentation
  - Reference attribution analytics (instagram/friends/repeat/etc.) with conversion-like views
  - Item popularity per KT over time
  - Gold vs diamond by branch and by period comparison
- UX polish:
  - More refined kintsugi textures (SVG overlay assets), micro-interactions
  - Mobile/tablet ergonomics improvements for showroom usage
  - Print layout refinements (ornamental borders, typography tweaks)

**User stories (Phase 4)**
1. As a user, I want secure and reliable sessions.
2. As an admin, I want scalable reporting without slowdowns.
3. As an admin, I want advanced customer and product analytics.
4. As a manager, I want branch-only visibility and fast review tools.
5. As a business, I want premium print/PDF outputs that match brand quality.

## 3) Next Actions
- Confirm if you want a formal **Manager approval** step (Approved/Rejected) or only “Sent + editable by manager/admin”.
- Confirm rounding conventions (per-line rounding vs final rounding) if the business has strict billing standards.
- Implement Phase 3:
  - Manager review queue UX
  - Manager edit + audit trail
  - Report filters + report PDF export

## 4) Success Criteria
- **Calculation correctness:** calc-engine tests remain green; totals match between UI, print, and PDF.
- **Workflow correctness:** executive cannot edit after “Sent”; manager/admin can edit; audit trail captured.
- **Usability:** end-to-end bill creation < 2 minutes; tablet-friendly; clear validation.
- **Reporting:** charts + tables with robust filters; CSV/PDF exports.
- **Security & data isolation:** JWT + RBAC enforced; managers limited to branch; admin global; no cross-branch leaks.