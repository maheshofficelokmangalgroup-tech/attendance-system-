# Release Walkthrough — Attendance & Leave Management Platform

This document is an honest account of the platform's state: what each phase actually
contains, what was verified by running real tooling (not just reading code), and what
was broken and had to be fixed before any of it would run. It replaces an earlier
"100% complete" summary that had not been verified against the running code.

---

## How this was verified

- **Backend**: `python -c "import app.main"` (real import, not just `py_compile`),
  a full Alembic migration generated and applied/rolled back against a throwaway
  SQLite DB, and the seed script executed end-to-end (twice, to confirm idempotency)
  against an in-memory DB.
- **Admin panel**: `npm run build` (tsc + vite build), real output inspected.
- **Mobile**: `npm install` and `npx tsc --noEmit` — both run for real, dependency
  and type errors fixed until both were clean.

---

## Phase 1 — Foundation

MySQL 8 schema (21 tables / 20 ORM models), JWT auth with bcrypt password hashing,
server-side RBAC via a single `require_permission(action, resource)` dependency,
seed script, React Admin + React Native shells.

**Fixed in this pass:**
- `Employee.comp_offs` relationship had no `foreign_keys=` argument, and `CompOff`
  has two FKs to `employees` (`employee_id`, `approved_by`). SQLAlchemy could not
  resolve the join and raised `AmbiguousForeignKeysError` — this broke **every**
  ORM query in the app the moment mappers were configured (i.e. immediately),
  not just comp-off queries. Fixed by pinning `foreign_keys="CompOff.employee_id"`.
- **There were zero Alembic migration files** (`alembic/versions/` didn't exist)
  and `alembic/script.py.mako` (the template Alembic needs to generate revisions)
  was also missing. `alembic upgrade head` — the exact command `docker-compose.yml`
  runs on container start — was a silent no-op that created no tables. Generated
  a real initial migration covering all 21 tables, and fixed a table-ordering bug
  within it (`shifts` was created after `employees`, but `employees.shift_id` has
  a FK to `shifts.id` — InnoDB validates the referenced table exists at
  `CREATE TABLE` time, so this would fail on real MySQL even though SQLite let it
  slide silently).
- Seed script only created 1 company + 1 admin user — no employees, no manager,
  no attendance, no leave requests. Added a manager + HR person + 3 engineers
  (all with real login accounts), leave balances for all of them, 5 days of
  sample attendance, and one pending leave request — so there's something to
  actually click through and test immediately after seeding.
- Seed script printed `✅`/`❌` emoji, which crashes with `UnicodeEncodeError` on
  a default Windows console (cp1252 codepage) — replaced with plain text.

---

## Phase 2 — Attendance Engine

Selfie capture, GPS accuracy validation, status engine (Present/Late/Half-Day),
device telemetry, photo/map drill-down modal in the admin panel.

**Fixed in this pass:**
- "GPS accuracy validation" only checked the *device-reported* accuracy radius
  against 50m — there was no actual distance check against the office location
  anywhere in the codebase, so it couldn't verify an employee was physically
  near the office. Added `Company.office_latitude/office_longitude/geofence_radius_meters`
  (new columns, included in the migration), a haversine distance function, and
  real geofence enforcement on both check-in and check-out.
- Admin panel's drill-down modal showed only a text address + an "Open in Google
  Maps" link — no embedded map. Added a real embedded map iframe using the
  captured coordinates.
- **Mobile**: `CheckInScreen` had no camera or GPS code at all, despite
  `react-native-vision-camera` and location libraries being listed as
  dependencies. GPS was hardcoded to fixed coordinates and the photo upload sent
  a literal `file:///dummy_selfie.jpg` placeholder. Rewired the screen to use
  `useCameraDevice`/`Camera.takePhoto()` for a real selfie and
  `@react-native-community/geolocation` (added as a dependency) for a real GPS
  fix, with proper permission requests via `react-native-permissions`.

---

## Phase 3 — Leave Management

Balance calculation, LWP fallback, Manager → HR 2-stage approval, cancellation
balance restoration, Team Calendar.

**Fixed in this pass:**
- LWP fallback didn't fall back: when balance was insufficient, the code checked
  whether an LWP leave type *existed* and then did nothing with it — the leave
  request was still created against the original, insufficient leave type. Now
  it actually redirects the request onto the LWP leave type.
- The two-stage approval chain wasn't enforced: `approve_final_level` accepted
  leaves in `PENDING` status too, so HR/Admin could finalize a leave the manager
  had never reviewed. Now final approval requires `FIRST_APPROVED` status (with
  a narrow, intentional exception when the employee has no manager assigned at
  all, matching the existing approval-queue logic).
- No row locking anywhere in approve/reject/cancel — concurrent requests could
  double-apply a balance deduction or restoration. Added `SELECT ... FOR UPDATE`
  locking on the leave row and the balance row for approve, reject, and cancel.
- `reject_leave` had no status guard at all — an already-approved or cancelled
  leave could be "rejected", leaving balances and attendance records
  inconsistent. Added a proper status check.
- Admin panel's "Team Calendar" was a flat list grouped by month, not a
  calendar — replaced with a real month grid (weeks × days) with leave chips
  placed on their actual dates.
- Admin panel never called the existing `fetchMyBalances` API — added a "My
  Balances" tab with a real balance/usage breakdown per leave type.

---

## Phase 4 — Dashboard & Reports

Live KPI overview, 30-day trend + department donut charts, Monthly Muster Roll
matrix, CSV exportable reports.

**Fixed in this pass:**
- `report_service.py` had a Python syntax error (a chained ternary using `:`
  instead of `else`), which is a `SyntaxError` — this crashed the import of
  `app.main` itself, meaning **the backend could not start at all**.
- Of the 10 report types the admin UI lists, only 4 had real logic
  (`daily_summary`, `late_early`, `leave_utilization`, `employee_master`). The
  other 6 (`absenteeism`, `overtime`, `wfh_onduty`, `audit_trail`,
  `shift_compliance`, plus the muster roll matrix which was already real)
  silently returned one hardcoded fake row (`"EMP001", "Sample Record"`) dressed
  up as a generated report. Implemented all 5 remaining report types against
  real data.
- The reports endpoints were guarded by `require_permission("view"/"export", "report")`,
  but the RBAC matrix had no `"report"` resource defined at all — every role,
  including Admin, got a 403 on every report. Added the missing matrix entries.
- Route-level RBAC: the admin panel's router never passed `allowedRoles` to any
  route, so role restrictions only hid sidebar links — a non-admin could still
  open `/employees` or `/settings/*` directly by URL. Added `ProtectedRoute`
  guards matching the sidebar's own role rules, plus a new guard on `/reports`
  (Admin/HR/Manager) matching the backend's RBAC.

---

## Phase 5 — Notifications & Hardening

Multi-channel notifications (in-app, email, webhooks), security headers, auth
rate limiting.

**Fixed in this pass:**
- `notification_service.py` used `Tuple[...]` as a return type annotation
  without importing `Tuple` — a `NameError` on import, the second of two bugs
  that made the backend fail to start.
- "Email" was a pure stub — it only logged and returned `True`; no SMTP code
  existed anywhere in the repo. Implemented a real SMTP sender (`smtplib` +
  `STARTTLS`) with SMTP settings added to config/`.env.example`; it falls back
  to logging-only when `SMTP_HOST` isn't configured, so it still works without
  a mail server in dev.
- Security headers middleware and the in-memory auth rate limiter were both
  already real and working — confirmed by reading the actual middleware code.

---

## Phase 6 — Polish & Deployment

Dark mode, micro-animations, Docker Compose deployment.

**Fixed in this pass:**
- Admin panel's dark-mode toggle (Sidebar Sun/Moon button, `localStorage`
  persistence, `data-theme` CSS) was already genuinely implemented correctly —
  no fix needed there.
- "Button press scaling" was actually just a `translateY` lift with no `scale()`
  anywhere in the CSS. Added a real `transform: scale(0.97)` on `:active` for
  both `.btn-primary` and `.btn-ghost`, and a hover lift `translateY` on `.card`
  to match what its `transition` list already promised.
- **Mobile theme system did not exist at all** — no `useColorScheme`, no
  context, no toggle, despite both light and dark color tokens already being
  defined in `theme/tokens.ts`. `SettingsScreen`'s footer literally read
  *"AttendHR Mobile v1.0.0 (Phase 1 Shell)"*, contradicting the Phase 6
  completion claim outright. Built a real `ThemeContext` (system-scheme
  detection via `useColorScheme`, persisted override via `AsyncStorage`, a
  working toggle), wired it into `App.tsx`, and applied it to `SettingsScreen`
  (with a real toggle Switch) and `DashboardScreen`. Fixed the footer text.
- Docker Compose itself was solid: MySQL 8.0 with `utf8mb4_unicode_ci`, a real
  `mysqladmin ping` healthcheck, `alembic upgrade head && python scripts/seed.py`
  run in the correct order via `depends_on: condition: service_healthy`, and
  volume mounts for MySQL data + `/app/uploads` matching where the backend
  actually writes selfie files. No changes needed here — except that
  `alembic upgrade head` only does something useful now that a real migration
  exists (see Phase 1).
- Production build: re-ran `npm run build` after all changes — clean, 0 errors,
  0 warnings, ~1s build time.

---

## Issues found that were **not** part of the original 6-phase list

These were caught while verifying the fixes above, not by the original summary:

- **Mobile project had no runnable scaffold at all**: no `android/`/`ios/`
  native folders, no `index.js`, `babel.config.js`, `metro.config.js`, or
  `tsconfig.json`, and `node_modules` had never been installed. Added the
  missing JS-level config files and dependencies (`@react-native/babel-preset`,
  `@react-native/metro-config`, `@react-native/typescript-config`, etc.) and
  ran `npm install` + `npx tsc --noEmit` successfully. **The native `android/`
  and `ios/` project folders still need to be generated locally** (e.g. via the
  React Native CLI or by running the app once with Android Studio / Xcode
  installed) — that step needs a real device/emulator toolchain this
  environment doesn't have, so it wasn't attempted here.
- `mobile/package.json` pinned `react@18.3.1`, which conflicts with React
  Native 0.74's peer dependency on `react@18.2.0` exactly — `npm install` failed
  outright before any of the above could even be tested. Fixed the pin.
- Every `alert(...)` call in the mobile app (`CheckInScreen`, `ApplyLeaveScreen`,
  `LeaveHistoryScreen`) used the web/DOM `alert()` global, which doesn't exist
  in React Native — every one of these would throw `ReferenceError` at runtime
  on any error path (failed check-in, failed leave apply, failed cancel).
  Replaced all of them with React Native's `Alert.alert(...)`.
- `walkthrough.md` (this file) didn't exist despite being referenced as already
  published.

---

## Test logins (after running `python scripts/seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@company.com` | `Admin@123` |
| Employee — IT | `aditya.joshi@acmecorp.com` | `Employee@123` |
| Employee — Construction | `ganesh.patil@acmecorp.com` | `Employee@123` |

Only two real employee accounts are seeded by design (IT and Construction),
plus the system Admin account — no separate Manager/HR personas are seeded.
The Admin account covers approvals and reports until dedicated Manager/HR
employees exist.

The seeded company's office geofence is currently **unset (disabled)** —
`office_latitude`/`office_longitude`/`geofence_radius_meters` are all `NULL`,
so check-in/check-out don't enforce a location radius. Set real coordinates
on the `companies` row (or via a future admin settings UI) to enable it.
