# VISIONGUARD

منصة تفتيش تشغيلية للمنشآت البترولية والغازية. الدرون أو الروبوت يدخل المنطقة الخطرة، والمفتش يراجع من موقع آمن.

This repository is the operational application, not a copy of the original storytelling page. The reference prototype at `https://mariam11982.github.io/The-VisionGuard/vision_backup.html` was inspected for terminology, the six-stage inspection flow, the report layout, and the industrial identity (VISION / GUARD, Arabic RTL, dark surfaces).

## What works without credentials

If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are empty, the app runs in **demo mode**:

- Data is stored in IndexedDB in the browser and survives reload.
- The first visit has operational seed data and **no user account**.
- Open `/setup` and create the first administrator. No default password is shipped.
- Missions that use a drone or robot are explicitly marked `وضع المحاكاة — البيانات تجريبية`.
- Nothing in demo mode talks to a physical drone, robot, camera, or AI model.

## Prerequisites

- Node.js 22+
- npm 10+
- Optional: a Supabase project and the Supabase CLI

## Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the printed local URL. Create the first administrator, then use the seeded facility **مصنع البترول والغاز**.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run test` | Business-logic tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` from the TypeScript seed |

## Supabase

1. Create a project.
2. In Authentication, disable email confirmation for development so the first-admin bootstrap receives a session.
3. Apply `supabase/migrations/20261001120000_init.sql`.
4. Optionally load `supabase/seed.sql` for demo facilities, devices, and history. The seed does not create a login.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
6. Restart the dev server. The header shows `Supabase` instead of the demo banner.
7. Open `/setup` once. The page calls `bootstrap_first_admin()`, which succeeds only while no administrator exists.
8. Deploy `supabase/functions/create-user` before creating more users from the UI. The function checks the caller is an active administrator and uses the service-role key only on the server.

### Row Level Security

RLS is enabled on every application table. Active `ADMIN`, `INSPECTOR`, and `OPERATOR` profiles can read operational data. Writes are split by role: administrators manage facilities, templates, devices, and settings; inspectors manage inspections, checklists, decisions, and reports; operators can update missions, telemetry, and alerts. A profile cannot change its own role. Anonymous users cannot read table data. `admin_exists()` is the only anonymous RPC, and it returns a boolean.

### Storage

Private buckets, created when the migration runs on Supabase:

- `inspection-media`
- `reports`
- `facility-docs`

Objects are not public. The client requests a signed URL. Demo mode stores uploads in IndexedDB instead, with type and size checks (8 MB for images and PDF, 30 MB for video).

### Realtime

The migration adds missions, mission events, telemetry, and alerts to `supabase_realtime` when that publication exists. Demo mode emits an in-memory change signal after each transaction.

## Roles

- **ADMIN** — users, facilities, templates, devices, settings, and the full workflow.
- **INSPECTOR** — inspections, checklists, review decisions, reports, and simulated mission operation.
- **OPERATOR** — mission monitoring, device status, telemetry, and alert acknowledgement or escalation. Operators cannot record the inspector's final decision.

## Simulation

Device missions are created with `is_simulation = true`. Mission control can start, pause, resume, and reset a deterministic tank-patrol scenario. The scenario writes telemetry, sensor readings, demo SVG evidence, and one review point. It does not invent an AI confidence score. Gas status is "ضمن الحد الطبيعي" only when the stored threshold and reading support it. Those thresholds are demo configuration, not a certified limit.

Reset is refused after an inspector decision has been stored.

## Reporting

Reports are snapshots. A completed report is never overwritten; generating again stores a new revision. Print uses a print stylesheet so the browser can save a PDF with Arabic text. An HTML download is also available. A report is an operational record, not an engineering or regulatory certificate.

## Tests

`npm run test` covers checklist scoring, mission transitions, risk recommendations, inspection validation, completion rules, alert deduplication, permissions, simulation progress through review, report revisions, and the seeded 87% score. That score is computed from stored weights: safety 95, tanks 82, alarms 91, category weights 0.25 / 0.55 / 0.20.

## Not connected

These interfaces exist and are labeled unavailable until configured and deployed:

- Drone and robot gateway (`VITE_DEVICE_GATEWAY_URL` is only probed)
- Industrial sensors, cameras, GIS, and maintenance systems
- Automated image or sensor analysis
- Physical dispatch

Do not treat simulated altitude, temperature, or gas values as live plant data.
