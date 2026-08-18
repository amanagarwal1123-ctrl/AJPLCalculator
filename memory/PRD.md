# AJPL Calculator - Product Requirements Document

## Original Problem Statement
Jewelry business management application with sales tracking, billing, customer management, analytics, and multi-branch support.

## Core Architecture
- **Backend**: FastAPI + MongoDB (motor) in `backend/server.py`
- **Frontend**: React (CRA/CRACO) + Shadcn/UI + Tailwind in `frontend/src`
- **Auth**: JWT-based with OTP for sales execs, password for admin
- **Roles**: admin, manager, executive

## What's Been Implemented

### Bill List Pagination (April 2026)
- 8-day pages for all Admin Dashboard tabs (Pending, Approved, Drafts, All)
- Cyclops lens wheel paginator at top and bottom of bill list
- Active page shown as large golden circle, adjacent pages scale down
- Page resets to 1 when switching tabs
- Shows "Showing X days (Y bills) · Page N of M" info

### Tablet Layout Optimization (April 2026)
- Redesigned NumpadModal: centered max-w-xl, 72px buttons, scale-on-press
- NumericInput: chevron indicator, 52px min-height on tablet
- Global CSS tablet rules: larger inputs/buttons/labels
- ItemCalculator/RateManagement: larger inputs and buttons

### Manager Edit-Approval Flow & Dynamic Rates (Feb 2026)
- **Manager edit on approved bills now requires admin approval**: `POST /bills/{id}/edit-request` (manager) creates pending request; `PUT /bills/{id}/edit-request/decide` (admin) approves/rejects. One approval = one save; afterwards bill returns to `edited` and waits for admin re-approval. Manager is locked out from re-editing until admin re-approves (which clears the consumed request).
- **Admin Dashboard** has a new yellow "Edit Requests" panel showing pending requests with Approve/Reject buttons.
- **Bill Page** shows banners for pending / approved / consumed edit requests; `Request Edit Approval` button on approved bills for manager.
- **Audit log overhaul**: every `created`, `sent_to_manager`, `approved`, `item_added/modified/removed`, `external_charges_updated`, `totals_updated`, `status_change`, `rate_card_update`, `rate_sync`, `gst_disabled/enabled`, `mmi_*`, `old_gold_updated`, `reference_update`, `edit_request_*` action recorded with user, role, timestamp, and structured `details` payload. Frontend renders rich diffs (old → new) with colour-coded action chips.
- **Dynamic rates for draft/sent/edited bills**: items with `rate_mode in ('normal','ajpl')` and matching purity are auto-recalculated from current `rate_cards` on every fetch (`apply_dynamic_rates(persist=True)` on GET /bills, GET /bills/{id}, GET /bills/{id}/summary) and on rate card update (`PUT /api/rates/{rate_type}` walks all non-approved bills and persists new totals + change_log entry). Manual rate entries are untouched. Approved bills are immutable.
- Replaced DollarSign icon with IndianRupee in Admin/Manager Dashboard (removes $ sign in sales card)
- Dashboard IST clock ticks every 1s; sales/data auto-refresh every 15s (live feel)
- OG photo uses full BACKEND_URL (deployment-safe); shows "No Image" placeholder when absent; thumbnail opens lightbox on click
- Diamond `Less` display shows entered (original) value, not adjusted; carat deduction shown separately
- Per-item **Calculation Breakdown** drawer on BillPage showing full step-by-step math (gross → less → carat dedupe → net → gold value → making × weight → stone → diamond → total)
- Frontend `calcMakingTotal` now uses gross weight for diamond items (matches backend)
- **Admin GST Toggle**: `PUT /bills/{id}/gst` flips a bill between 3% GST and 0%. Bill Summary shows strike-through with one-click "Remove" / "Re-enable" pill (admin-only). Change logged in bill history; Print/PDF render the saved percent.

### UI Polish (Feb 2026)

### Rate Cascade + Bulk Delete (May 2026)
- **24K → all-purities auto-cascade**: On `RateManagement` page, editing the 24KT rate for any category (Normal/AJPL/Buyback) auto-recomputes 22/20/18/14 KT rates using `percent / 100` ratio from each purity. Editing any non-24K purity is independent and does not touch other rates. 24K card is visually highlighted as "BASE" with a golden border and explanatory hint.
- **Admin bulk-delete**: `POST /api/admin/bills/bulk-delete { statuses: ["draft"] }` (admin-only). Dashboard shows a red "Delete All Pending (n)" / "Delete All Drafts (n)" button that only appears on Pending & Drafts tabs. Approved bills are never deletable in bulk (server rejects). Double confirmation (confirm + typed DELETE phrase) enforced on the client.

### NP (Non-Purchase) Marker + Diamond Sale Display (May 2026)
- **NP toggle**: `PUT /api/bills/{id}/np { is_np, reason }` (admin/manager). Stores `np: {is_np, reason, marked_by, marked_by_role, marked_at}`; appends `np_marked` / `np_cleared` change_log entry. Approved bills cannot be marked NP (server returns 400).
- **AdminDashboard & ManagerDashboard**: NP pill toggle (next to MMI on admin; dedicated "Mark NP" / "NP ✓" button on manager card + table row). Available only on non-approved bills (`draft / sent / edited`). Optional reason captured via prompt. NP'd bills get a red NP chip + reason on the card and a tinted background (manager).
- **Diamond Sale Amount on cards**: When a bill contains items with `item_type === 'diamond'`, the sum of `total_studded` is shown as a small bluish "Diamond: ₹X,XXX" line directly below the grand total — visually clearly distinct from the bill total. Renders on both AdminDashboard cards and ManagerDashboard cards + tables. Hidden when no diamond items.
- **Dedicated NP tab**: Both AdminDashboard and ManagerDashboard now have a new red `NP (n)` tab between Drafts and All. NP'd bills automatically move out of Pending / Drafts tabs into this exclusive NP tab. Admin's NP tab inherits the existing cyclops date-wise pagination (8-day pages), so NP'd bills show grouped by date and paginated identically to other admin tabs.

### Reports Approved-Only + Pure Diamond Metric (Jun 2026)
- **`GET /api/analytics/dashboard`** now filters `all_bills` by `status === 'approved'`. Pending/draft/edited/NP bills no longer pollute sales metrics.
- **`pure_diamond_total` + `pure_diamond_carats` fields**: includes `studded_charges` entries where `type` is `'diamond'` or `'solitaire'`. Excludes `colored_stones`. Applies sanity guard (skip entries where `carats <= 0`, `carats > 100`, or `rate_per_carat <= 0`) to prevent corrupt legacy data from inflating totals.
- **Diagnostic endpoint** `GET /api/admin/debug/diamond-entries-audit`: returns suspicious diamond entries with bill_number, customer info, and reason — admin uses this to locate the bad bills.
- **Daily Sales Trend expand-on-click**: CSS-driven in-place expansion (avoids Radix Dialog + Recharts measurement crash).

### Weight Precision Fix (Jun 2026)
- **Root cause**: in `calc_engine.calculate_diamond_item`, `adjusted_less = round_currency(original_less + studded_less_grams)` was rounding *weights* to **currency** precision (2 decimals), so a `0.036 g` studded deduction became `0.04 g`. Net then became `0.32 − 0.04 = 0.28` instead of the correct `0.284`.
- **Fix**: `adjusted_less` now quantizes to `0.001` (1 mg / 3 decimals). All weight aggregations and displays standardised to 3 decimals.
- **Frontend pieces normalised to `.toFixed(3)`**: `AdminDashboard.getBillWeight`, `AllBillsPage` item summary, `ItemBreakdown` carats & studded ct, `Reports` pure-diamond carats card.
- **Backend `total_studded_carats`** rounding changed from 2 → 3 decimals.
- Verified `POST /api/calculate/item` with `gross=0.32 less=0 diamond=0.18ct` → `net_weight=0.284`, `studded_less_grams=0.036`.

### Dashboard Performance + 24KT Rate Audit (Jun 2026)
- **Dashboard lightweight mode**: `GET /api/bills?lightweight=true` applies a MongoDB projection that excludes heavy fields (`change_log`, `feedback`, `items.making_charges`, `items.stone_charges`, `items.studded_charges`, `items.studded_weights`, `items.discounts`, `items.photos`, `items.tag_number`, `old_gold.items_used`) and adds pre-computed `items_count`, `total_weight`, `diamond_amount` per bill. AdminDashboard now requests this mode by default — payload reduced ~5x, dashboard load ≈1.3s with current data.
- New index on `bills.status` for tab filtering.
- **24KT Rate Change Audit Log**: every `PUT /api/rates/{rate_type}` writes an entry to the new `rate_change_log` collection with `timestamp_ist`, `timestamp_utc`, `rate_type`, `old_24kt_rate`, `new_24kt_rate`, `user_id`, `user_name`, parsed `device` label (browser · OS from User-Agent), and the raw user-agent (truncated).
- `GET /api/admin/rates/today-changes`: returns today's entries (start-of-day IST window), newest first.
- **AdminDashboard widget** "Today's 24KT Rate Changes": shows time, category color-coded, the new 24KT rate, delta from previous, user name, and device label. Visible only when there are entries for today.

### Daily Rate Reset at 2 AM IST (Jun 2026)
- `_zero_all_rate_cards()`: sets `rate_per_10g = 0` for every purity across all rate cards (normal/ajpl/buyback), stamps `updated_by = system:<trigger>`.
- `_daily_rate_reset_loop()`: asyncio background loop launched on FastAPI startup. Computes `seconds_until_next 02:00 IST`, sleeps, runs the zero job, loops forever. Catches and retries (60s backoff) on transient errors.
- Manual override: `POST /api/admin/rates/zero-all` (admin only) — for emergencies / testing. Verified manually: 3 rate cards updated, all purities → 0.
- Scheduler uses `pytz.timezone('Asia/Kolkata')`, so DST/timezone never drifts.

### Customer Reference & Visit Origin Tracking (Jun 2026)
- **Backend `/analytics/customers`**: derives `initial_reference` and `first_visit` per customer by scanning their oldest bill. No schema migration needed.
- **POST /customers**: stopped overwriting the existing `reference` on repeat saves; only fills it when not already set.
- **CustomerListPage** — Reference column is a 2-line elegant cell (no redundant "Repeat" badge):
  - Line 1: `{initial_reference} · {N} visits` (e.g., `Facebook · 8 visits`)
  - Line 2: For multi-visit customers `{first_date} → {last_date}`; for single-visit `{date}` only
  - If the original reference truly was "Repeat Customer" it appears as-is — no double labeling.
- **Visit-count filter chips**: All / 1 visit / 2-4 visits / 5+ visits with live counts.
- **Sort options** (purchase-based terminology): Last purchase (newest/oldest), First purchase (newest/oldest), Total spent, Visit count.

### Custom Numpad, Old Gold, Buyback Rates, Reference Normalization
- All previously implemented features intact

### Repeat Customer Integrity (June 2026)
Root cause of "walk-in on 2nd visit" (Ishtaa Jain case) — 4 leaks fixed:
1. **Backend enforcement** in `POST /bills`: if customer has any previous bills, `customer_reference` is force-set to "Repeat Customer" server-side, regardless of what the form sends.
2. **PUT /customers/{id}**: reference only applied/propagated if actually CHANGED (normalized compare); unchanged reference in payload is ignored. Changing reference is **admin-only** (403 otherwise).
3. **Audit trail**: admin reference change propagates only to origin bills (skips "Repeat Customer" bills) and pushes a `reference_update` change_log entry (`details.source: customer_profile_edit`) on each affected bill.
4. **GET /customers/{id}/bills**: no longer display-overrides each bill's `customer_reference` with the customer-level reference (name/phone/location enrichment kept).
Frontend `CustomerProfilePage.js`: only sends `reference` when admin AND changed; field read-only for non-admins with hint text.
NOTE: production (ajpl-calc.emergent.host) needs a redeploy to pick these up; existing mislabeled bills are NOT auto-corrected (user chose 4b).

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
