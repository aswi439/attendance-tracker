# WorkTrack — Worker Attendance Tracker

Two portals over one shared database (Cloudflare D1):

- **`/supervisor`** — daily roster: Present/Absent per worker with leave type captured at the moment of absence
- **`/admin`** — track record per worker: monthly averages, leave breakdown by type, year calendar, CSV report downloads

Phase 1 credentials (hardcoded server-side in `src/worker/index.js` — change them there):

| Portal | Username | Password |
|---|---|---|
| Supervisor | `supervisor` | `supervisor123` |
| Admin | `admin` | `admin123` |

The database schema + 15 sample workers + ~60 days of demo history are created automatically on first request.

## Develop locally

## Roster management & absence emails (added)

- Supervisors can **add workers** (name, department, email, phone) directly from the portal — `POST /api/workers`. New IDs continue the sequence (W016, W017…).
- When a worker **without** a prior absence record is marked Absent, the Worker emails them via [Resend](https://resend.com) — non-blocking, only on a present→absent transition, skipped when no email or no API key.

Email config (Worker env / Sites secrets, never committed):

- `RESEND_API_KEY` — required to send (create at https://resend.com/api-keys)
- `RESEND_FROM` — optional sender, e.g. `Attendance <attendance@yourdomain.com>`; defaults to Resend's `onboarding@resend.dev` (test mode only delivers to your own inbox — verify a domain for real worker emails)

```bash
npm install
npm run build
npm run dev        # wrangler dev on http://localhost:8787
```

## Deploy (Freebuff Sites)

`manifest.json` describes the Worker (`dist/index.js`, bundled by esbuild) + static assets (`dist/public`, built by Vite). Deploy the manifest, then add a D1 database bound as `DB`.
