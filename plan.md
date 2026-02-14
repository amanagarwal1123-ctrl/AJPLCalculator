# AJPL Calculator — Mobile Optimization, Multi‑Bill Support & OTP Login (Updated plan.md)

## 1) Objectives
- Ensure **primary bill actions** (esp. **Send to Manager**) are **always accessible on phones**.
- Deliver a consistent, touch-friendly **mobile UX across Admin / Manager / Executive** flows.
- Enable Sales Executives to **create multiple draft bills** (different customers) and **switch between bills quickly**.
- Replace password login with a **username + 4‑digit OTP** flow, where OTPs are **visible to Admin** for operational control.
- Remove the **“Made with Emergent”** badge from the UI.

> **Current status:** All objectives above are implemented and verified.

---

## 2) Implementation Steps

### Phase 1: Core Flow POC — Mobile Primary Action + Bill Switching (isolation)
**Goal:** Prove the two riskiest UX flows work end-to-end on mobile.

**User stories (POC)**
1. As an executive, I can always see a bottom bar with **Grand Total + Send to Manager** on phone.
2. As an executive, I can switch between my **draft bills** in 1–2 taps.
3. As an executive, I can create a new bill and it becomes the active context immediately.
4. As an executive, if a bill is not draft, the bottom bar adapts (e.g., shows Print/PDF only).
5. As a manager, I can open a sent bill on phone and still access the key action (Approve when applicable).

**POC build steps (Implemented)**
- ✅ Added a **mobile-only fixed bottom action bar** on `BillPage`:
  - Shows **Grand Total** + primary CTA based on role/status.
  - Added content bottom padding so content isn’t obscured.
- ✅ Added an **Executive Bill Switcher** (Sheet) on `BillPage`:
  - Lists executive **draft bills**.
  - Switching navigates to `/bill/:billId`.
  - Includes **New Bill** shortcut (routes to Sales dashboard).
- ✅ Added/verified `data-testid` hooks:
  - `mobile-bottom-bar`, `mobile-primary-action`, `bill-switcher`, `bill-switcher-item-*`, `bill-switcher-new-bill`.

**Exit criteria (POC) — Achieved**
- ✅ On 390×844 viewport, **Send to Manager** is visible immediately for executive draft bills.
- ✅ Switching between draft bills preserves correct bill context and totals.

---

### Phase 2: V1 App Development — Mobile Responsive Pass (all roles)
**Goal:** Make all dashboards and tables phone-friendly without losing desktop power.

**User stories (V1)**
1. As an executive, I can view **My Bills** on phone in a scannable list.
2. As an executive, I can continue a draft bill from the list with one tap.
3. As a manager, I can review pending bills on phone using card rows with clear status/total.
4. As an admin, I can navigate reliably on phone and interact with dashboards without horizontal scrolling.
5. As any user, buttons/inputs are comfortable on phone (min 44px targets) and key actions aren’t below the fold.

**Implementation steps (Implemented)**
- ✅ `SalesExecDashboard`:
  - Mobile **card-based bill list** (`md:hidden`) and desktop table preserved.
  - Added **filter chips** (All / Draft / Sent / Done).
  - Added **Active Drafts** cards section for quick resume.
- ✅ `ManagerDashboard`:
  - Added **mobile card list** alternatives for bill queues; desktop tables retained.
- ✅ `AdminDashboard`:
  - Mobile-friendly KPI layout (2-column), quick actions grid, and **mobile bill cards**.
- ✅ `BillPage`:
  - Improved mobile spacing/compact item cards.
  - Ensured fixed action bar does not overlap content.
- ✅ Global/mobile CSS:
  - Safe-area handling for bottom bars.

**End-of-phase testing — Completed**
- ✅ End-to-end mobile flow validated for each role:
  - Login → dashboard → open bill → primary action.

---

### Phase 3: Multi‑Bill Support — Productizing Switching + “Active Drafts” UX
**Goal:** Make multi-customer drafting practical for Sales Executives.

**User stories (multi-bill)**
1. As an executive, I can keep **multiple draft bills** for different customers without losing progress.
2. As an executive, I can see **Active Drafts** and jump to any bill instantly.
3. As an executive, I can switch bills while working inside a bill.

**Implementation steps (Implemented)**
- ✅ Added **Active Drafts** section to `SalesExecDashboard`:
  - Quick “Continue” entry for each draft.
- ✅ Enhanced **Bill Switcher** on `BillPage`:
  - Shows other draft bills and highlights current bill.
  - Includes **New Bill** shortcut.
- ✅ Backend reuse:
  - Continued using `/bills` with client-side filtering for drafts (no extra endpoint required).

**End-of-phase testing — Completed**
- ✅ Executive: create multiple drafts → add items → switch among drafts → send one to manager → confirm it leaves drafts.

---

## 3) OTP Login (New Track) — Username + 4-digit OTP
**Goal:** Remove password entry for staff; allow Admin to control OTP distribution.

**Implemented**
- ✅ Backend endpoints:
  - `POST /api/auth/request-otp` (generates 4-digit OTP; stores with expiry)
  - `POST /api/auth/verify-otp` (verifies OTP; returns JWT)
  - `GET /api/admin/pending-otps` (admin-only; shows active OTPs)
- ✅ Frontend:
  - Login is now a **2-step UI** (username → OTP input).
  - OTP input supports paste, auto-advance, and auto-submit.
- ✅ Admin visibility:
  - Admin Dashboard has **Login OTPs** panel with auto-refresh + copy button.
- ✅ Security verification:
  - `/api/admin/pending-otps` correctly requires admin authentication.

---

## 4) “Made with Emergent” Badge Removal
**Goal:** Remove the Emergent badge overlay from UI.

**Implemented**
- ✅ CSS + MutationObserver-based removal in `index.css` and `index.js`.
- ✅ Verified via screenshots: badge not visible on login, bills, or dashboards.

---

## 5) Next Actions (immediate)
All planned phases are completed. Remaining optional follow-ups:
1. **Harden OTP lifecycle** (optional): rate limit OTP requests per username, enforce single active OTP per user.
2. **Add audit controls** (optional): store requester IP/device info for OTP requests.
3. **Customer edit on draft bill** (optional): allow exec to correct customer name/phone before sending.

---

## 6) Success Criteria
- ✅ **Send to Manager** accessible on phone **without scrolling** (executive + draft).
- ✅ All key screens usable on mobile with comfortable tap targets.
- ✅ Executives can maintain **multiple customer draft bills** and **switch** between them quickly.
- ✅ OTP-based login works end-to-end; Admin can view/copy active OTPs.
- ✅ Emergent badge removed.
- ✅ No regressions to manager approval/admin workflows.
