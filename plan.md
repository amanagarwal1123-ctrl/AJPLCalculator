# AJPL Calculator — Mobile Optimization & Multi‑Bill Support (plan.md)

## 1) Objectives
- Make the **primary bill actions** (esp. **Send to Manager**) reliably accessible on phones.
- Improve **mobile UX** across Login/Admin/Manager/Executive flows (readability, spacing, touch targets).
- Enable Sales Executives to **create multiple draft bills** (different customers) and **switch between active bills quickly**.

## 2) Implementation Steps

### Phase 1: Core Flow POC — Mobile Primary Action + Bill Switching (isolation)
**Goal:** Prove the two riskiest UX flows work end-to-end on mobile before broader refactors.

**User stories (POC)**
1. As an executive, I can always see a bottom bar with **Grand Total + Send to Manager** on phone.
2. As an executive, I can switch between my **draft bills** in 1–2 taps.
3. As an executive, I can create a new bill and it becomes the active context immediately.
4. As an executive, if a bill is not draft, the bottom bar adapts (e.g., shows Print/PDF only).
5. As a manager, I can open a sent bill on phone and still access the key action (Approve when applicable).

**POC build steps**
- Add a **mobile-only fixed bottom action bar** on `BillPage`:
  - Shows **Grand Total** (mono) + primary CTA based on role/status.
  - Ensure it does not get hidden by overlays; add `pb` (page bottom padding) so content isn’t obscured.
- Add an **Executive Bill Switcher** (mobile-first) to `BillPage`:
  - Fetch executive bills (draft only) and show a compact selector (e.g., horizontal chips / Sheet dropdown).
  - Selecting bill navigates to `/bill/:billId`.
  - Include quick action: **New Bill** (opens minimal customer form or navigates back to Sales dashboard section).
- Add minimal instrumentation (`data-testid`) for:
  - `mobile-bottom-bar`, `mobile-primary-action`, `bill-switcher`, `bill-switcher-item-*`, `bill-switcher-new-bill`.
- POC validation (manual + quick automated screenshots):
  - Executive login → open draft bill → confirm CTA visible without scrolling.
  - Switch between 2+ draft bills.
  - Send one bill to manager → confirm CTA changes/disappears accordingly.

**Exit criteria (POC)**
- On 390×844 viewport, **Send to Manager is visible immediately** on a draft bill.
- Switching between bills preserves correct bill context and totals.

---

### Phase 2: V1 App Development — Mobile Responsive Pass (all roles)
**User stories (V1)**
1. As an executive, I can view **My Bills** on phone in a scannable card list (not a cramped table).
2. As an executive, I can continue a draft bill from the list with one tap.
3. As a manager, I can review pending bills on phone using card rows with clear status/total.
4. As an admin, I can navigate reliably on phone (Sheet menu) and interact with dashboards without horizontal scrolling.
5. As any user, buttons/inputs are comfortable on phone (min 44px targets) and key actions aren’t below the fold.

**Implementation steps**
- `SalesExecDashboard`:
  - Replace/augment table with **mobile card list** (`md:hidden` cards, keep table for `md+`).
  - Add quick filters: Draft / Sent / Approved.
- `ManagerDashboard`:
  - For each tab list, add **mobile card list** alternative to the table.
  - Keep desktop table unchanged.
- `BillPage`:
  - Improve mobile layout spacing; ensure summary + items remain readable.
  - Add consistent bottom padding to accommodate the fixed action bar.
- Global/mobile CSS tweaks:
  - Ensure sticky headers + fixed bottom bar don’t overlap content.
  - Verify all primary buttons keep `h-11`+.

**End-of-phase testing**
- One end-to-end pass on mobile viewport for each role:
  - Login → dashboard → open bill → primary action.

---

### Phase 3: Multi‑Bill Support — Productizing Switching + “Active Drafts” UX
**User stories (multi-bill)**
1. As an executive, I can keep **multiple draft bills** for different customers without losing progress.
2. As an executive, I can see an **“Active Drafts”** strip/list and jump to any bill instantly.
3. As an executive, I can **rename/edit customer details** for a draft bill if I made a mistake.
4. As an executive, I can close/archive a draft bill (optional) to reduce clutter.
5. As a manager/admin, bill workflows remain unchanged and permissions still apply.

**Implementation steps**
- Add “Active Drafts” section to `SalesExecDashboard` (top of My Bills):
  - Sorted by last updated.
  - Primary CTA: Continue.
- Enhance Bill Switcher:
  - Show draft bills + status badges; indicate current bill.
  - If too many, use a `Sheet` with search.
- Backend (only if needed):
  - Add lightweight endpoint for executive draft bills sorted by last_modified (or reuse `/bills` + filter client-side).
  - Optional: endpoint to update customer fields on draft bills.

**End-of-phase testing**
- Executive: create 3 bills → add items → switch among them → send 1 to manager → verify it leaves drafts.
- Manager: pending tab still accurate.

---

## 3) Next Actions (immediate)
1. Implement Phase 1 POC changes in `BillPage` (mobile fixed bar + exec bill switcher).
2. Verify on mobile viewport via screenshots + manual click-through.
3. If POC passes, proceed to Phase 2 responsive lists (SalesExecDashboard/ManagerDashboard).

## 4) Success Criteria
- **Send to Manager** is accessible on phone **without scrolling** (executive + draft).
- All key screens are usable on mobile with no horizontal scroll and comfortable tap targets.
- Executives can maintain **multiple customer draft bills** and **switch** between them quickly.
- No regressions to manager approval/admin analytics workflows.
