# Worker Attendance Tracker — Project Plan

Two portals, one shared database:

1. **Supervisor Portal** — mark each worker Present / Absent daily (with type of absence)
2. **Admin Portal** — view, analyze and download attendance history & reports per worker

Auth for Phase 1: hardcoded username/password for admin, and separately for supervisor (defined server-side, not in the database). Database: SQLite (D1) so everything persists and history builds up over years.

---

## 1. Database Design

**workers** (the roster a supervisor marks against)
- `id` — unique worker ID
- `name`
- `department` / `role` (optional, useful for filtering)
- `active` — bool (ex-workers kept for history, hidden from daily lists)
- `created_at`

**attendance** (one row per worker per day)
- `id`
- `worker_id` → workers.id
- `date` — the attendance date
- `status` — `present` / `absent`
- `leave_type` — *(only when absent)*: `ML` (medical), `emergency`, `work_related`, `casual`, `unpaid`, `unspecified`
- `notes` — optional free text from supervisor (e.g. "hospitalized", "site visit")
- `recorded_by` — which supervisor/username recorded it
- `recorded_at`, `updated_at`
- **UNIQUE(worker_id, date)** → prevents the same day being recorded twice

Why this design:
- The unique constraint guarantees exactly one record per worker per day — if a supervisor accidentally marks twice, it updates instead of corrupting stats.
- Leave type is captured **at the moment of marking absent**, so the admin's leave analysis is automatic — no extra admin data entry.
- Every row keeps who recorded it and when, giving a lightweight audit trail.

**Derived values (computed, never stored):** monthly attendance %, days worked, leave days per type, yearly averages. Storing aggregates invites drift bugs — compute from raw rows.

---

## 2. Supervisor Portal — Features

### Core (Phase 1 — required for your described flow)
1. **Worker list view** — all active workers, name + ID/department, one per row.
2. **Present / Absent toggle per worker** — one tap; saves instantly to the DB (no separate "Save" step).
3. **Absence reason popup** — when Absent is selected, immediately ask for Leave Type (ML / Emergency / Work-related / Casual / Unpaid) + optional note. Enforced in the UI.
4. **Date selector** — default today; supervisor can backfill a recent past day (e.g. forgot to record), but not far into the past or future.
5. **Today's status summary bar** — "Marked 12/15 present · 1 ML · 2 emergency" so the supervisor sees progress at a glance.
6. **Duplicate protection** — already-marked workers show their current status; tapping again updates it (visible, not silent).
7. **Login** — hardcoded supervisor username/password; session cookie; only the marking pages accessible here. No links to admin pages.
8. **Mobile-friendly layout** — supervisors will do this on a phone; big tap targets, sticky date bar.

### Efficiency / process improvements (worth having)
9. **Search/filter the roster** by name — critical when the list grows to 50+ workers.
10. **"Mark all present" shortcut + individually switch the ones who are absent** — the realistic daily flow: most workers attend, so defaulting saves taps.
11. **Undo / re-mark freely during the day** — an absent marked by mistake can be corrected same-day.
12. **Quick glance at this month's own records** (a compact last-30-days grid) so the supervisor can verify backfills.
13. **Unrecorded-day warning** — if the supervisor opens the portal and a past weekday was never recorded, show a gentle reminder before it hurts the statistics.

Joint team note (see §5): all supervisors share ONE roster but each day's row records who marked it. If multiple supervisors work the same day, the roster is still updated coherently — duplicates are upserts, not conflicts.

---

## 3. Admin Portal — Features

### Core (Phase 1 — required for your described flow)
1. **Login** — hardcoded admin username/password (separate from supervisor).
2. **Dashboard** — today's + this month's snapshot: total workers, attendance % today, absences broken down by leave type, workers on ML right now.
3. **Workers list** — every worker with a per-worker summary row: this month's present days, absent days, attendance %. Click a worker → their profile.
4. **Individual worker track record** (the heart of it):
   - **Year calendar / month grid** — highlight Present / Absent (colored by leave type) per day, for the whole year.
   - **Monthly average attendance %** for each month — e.g. Jan 87%, Feb 92%…
   - **Yearly average** over all recorded months.
   - **Leave breakdown by type** — total ML days, emergency days, work-related days, casual, unpaid, per month and per year.
   - **Month/year selector** — jump to any month/year since the worker was registered.
   - **Longest leave stretches and absence patterns** (e.g. frequently absent on Mondays — simple derived insights).
5. **Reports & download**:
   - **Individual worker report**: detailed per-day history + monthly summary → **CSV** and **PDF** download with worker name + period on it.
   - **All-workers summary report** (month or year): one row per worker — present days, absent days, leave per type, attendance % — downloadable in one click.
6. **Filtering** — by month, year, leave type, department.

### Useful additions (Phase 2, once Phase 1 works)
7. **Manage workers from admin** (add/edit/deactivate) so the roster isn't hardcoded.
8. **Compare view** — department/team attendance averages side by side.
9. **Threshold alerts** — flag workers below e.g. 80% monthly attendance, or with > X ML days.
10. **Month-over-month / year-over-year trend chart** per worker.
11. **Export full raw dataset** for backup/external analysis.
12. **Supervisor activity log** — who recorded what, corrections made (uses the audit fields already stored).

Explicitly out of scope for now (say it up front): biometric/QR check-in, payroll integration, notifications, multiple supervised rosters. These can come later without redesigning the database.

---

## 4. How the daily process should flow (efficiency analysis)

```
Daily, by any supervisor:
  open Supervisor Portal → roster loads for today
  → (already 12 marked from earlier? they show their status)
  → search/select each absent worker → tap Absent → choose leave type (+note)
  → everyone else stays present by default (from the earlier "mark present" pass,
     or via "Mark all present" then unmark)
  → 30 seconds of work per day for the whole team

Records go straight to the database, one row per worker per day, kept forever.

Any time, by the admin:
  log into Admin Portal → dashboard shows the state
  → click any worker → calendar + monthly % + leave-type history for every year
  → download that worker's report (CSV/PDF), or the all-workers summary
```

Key efficiency decisions baked in:
- **One tap to record** (status saves immediately) — no form-submit step per worker.
- **Reason captured at absence time** — admin analysis is automatic; admins never re-enter data.
- **Unique worker+date constraint** — statistics can never double-count: days present, leave days, and monthly averages are always correct.
- **Aggregates computed from raw rows** — reports are trustworthy for any date range, including old historical data.

---

## 5. Reported for the admin, regardless of who marked it

The attendance table is shared by all supervisors — the admin sees the complete picture for every worker, whoever recorded it. If later you want multiple supervisor accounts each with their own login, nothing changes in the data model; `recorded_by` already differentiates them.

---

## 6. Tech Stack

- **Framework:** Next.js (App Router) — one codebase, two route groups (`/supervisor`, `/admin`), server actions for writes, deployable on Freebuff Sites (Cloudflare Workers).
- **Database:** Cloudflare D1 (SQLite) via `env.DB` — persistent, free, accessed server-side only.
- **Auth (Phase 1):** credentials hardcoded server-side (in Worker env/secrets, not client code); cookie-based session; middleware gates `/supervisor/*` to the supervisor login and `/admin/*` to the admin login.
- **Reports:** CSV generation server-side (universal) + PDF via a simple server-rendered print layout.

---

## 7. Build Phases

| Phase | Deliverable |
|---|---|
| **1 — MVP** | DB schema + seed sample workers; supervisor login, roster, present/absent marking + leave type; admin login, dashboard, worker detail (calendar, monthly %, leave breakdown); CSV download |
| **2 — Polish** | PDF reports, year-over-year charts, alerts, worker management in admin, unrecorded-day reminder, backfill guardrails |
| **3 — Later** | Multi-supervisor accounts, departments, PDF batch export for all workers, trend analytics |

**One important decision for Phase 1 that shapes everything:** seed the roster with sample workers (for demo/testing), and Phase 1 already includes an "Add worker" admin screen OR we hardcode a small workers list and let the admin add more later — confirm which you prefer when we start coding.
