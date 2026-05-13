# DailyWorkTracker (daily-work-tracker-ios) — Codebase Overview & Startup/Launch Troubleshooting

## Summary
This repository contains an iOS app (`DailyWorkTracker`) plus two TypeScript/Node components:  
1) an Express backend (`daily-work-tracker-ios/DW/DW/server.ts`) that exposes sync, media upload, and admin/console endpoints, and  
2) a Vite/React console UI (`daily-work-tracker-ios/ddworkrecord-console`).

The backend is intended to “start even if Postgres isn’t configured” (DB-less behavior exists via `memoryStore`), but several routes still import DB logic and the DB layer currently constructs a `pg.Pool` with an empty password when `DB_PASSWORD` is missing. That combination is the most likely reason the app appears to “keep running into errors” during startup or first request.

## Architecture
Primary architectural pattern: **Express route-based HTTP API** with **Firebase Admin** for persistence and a **fallback in-memory store** for DB-less operation.

Major subsystems:
- `DW/DW/server.ts`: Express server bootstrap (middleware + route mounting + health endpoint).
- `DW/DW/syncRoutes.ts`: `/api/v1/workday/sync` validates payload (zod) and persists to `memoryStore` and (attempts) Firestore.
- `DW/DW/consoleRoutes.ts`: admin-only console endpoints; prefers Firestore, falls back to `memoryStore`.
- `DW/DW/adminRoutes.ts`: admin-only reporting/export routes; for “DB-less mode” uses `memoryStore`.
- `DW/DW/mediaRoutes.ts`: photo upload endpoint using local disk storage.
- `DW/db.ts`: Postgres pool creation used by some reporting/admin routes (and potentially by schema-backed routes).

Technology stack:
- Node.js + Express + TypeScript
- `pg` for Postgres
- `firebase-admin` for Firestore
- `zod` for request validation
- `multer` + local filesystem for uploads
- Vite/React for the console UI

Execution start:
- Backend entry: `DW/DW/server.ts` which immediately calls `app.listen(...)`.
- Route wiring happens at import-time via `import ... from './XRoutes'` and `app.use('/api/v1/...', routes)`.

## Directory Structure
```
daily-work-tracker-ios/
├── DW/                          — Backend server package (Node/TS)
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── db.ts                     — pg.Pool connection factory
│   └── DW/                       — Express app source
│       ├── server.ts           — Express bootstrap
│       ├── auth.ts             — Firebase JWT role auth middleware
│       ├── firebaseAdmin.ts    — Firebase Admin initialization
│       ├── memoryStore.ts      — In-memory record store (DB-less mode)
│       ├── syncRoutes.ts       — /api/v1/workday/sync (sync + Firestore write)
│       ├── consoleRoutes.ts    — /api/v1/console/... (admin stats + workdays)
│       ├── adminRoutes.ts      — /api/v1/admin/... (reports + exports + live locations)
│       └── mediaRoutes.ts      — /api/v1/media/upload (photo uploads)
└── ddworkrecord-console/        — React/Vite console UI (separate build target)
```

## Key Abstractions

### `Express app` (startup)
- **File**: `daily-work-tracker-ios/DW/DW/server.ts`
- **Responsibility**: Bootstraps Express, installs middleware (CORS, JSON), serves `/uploads`, mounts route groups, and starts listening.
- **Interface**: no exported API; the behavior is in `app.listen`.
- **Lifecycle**: created when `server.ts` is executed (typically `node dist/server.js`).
- **Used by**: runtime only; all request handling depends on the mounted route modules.

### `db` (Postgres pool)
- **File**: `daily-work-tracker-ios/DW/db.ts`
- **Responsibility**: Creates a `pg.Pool` using environment variables, with a “fail soft” behavior for missing envs.
- **Interface**: `export const db = new Pool({...})`
- **Lifecycle**: instantiated at module import time; lives for server lifetime.
- **Used by**: `DW/DW/adminRoutes.ts` (and potentially other routes).

**Non-obvious behavior**: if `DB_PASSWORD` is missing, `requireEnv()` returns `''` (empty string), and the pool is still constructed. That means DB-backed operations may fail at query time, but the server will still appear to “start”.

### `authenticateRole` / `authenticateAdmin`
- **File**: `daily-work-tracker-ios/DW/DW/auth.ts`
- **Responsibility**: Verifies Firebase ID tokens and enforces a role claim (`admin|manager|worker`), with a development bypass.
- **Interface**:
  - `authenticateRole(allowedRoles)`
  - `authenticateAdmin`
- **Lifecycle**: created per request as middleware; reads `process.env.DEV_BYPASS_ADMIN_CLAIMS`.
- **Used by**:
  - `adminRoutes.ts`, `consoleRoutes.ts`, `syncRoutes.ts` (role-protected endpoints).

**Non-obvious behavior**: by default (unless `DEV_BYPASS_ADMIN_CLAIMS === 'true'`), endpoints require `Authorization: Bearer <token>`.

### `memoryStore`
- **File**: `daily-work-tracker-ios/DW/DW/memoryStore.ts`
- **Responsibility**: In-memory storage for workday records for “DB-less mode” and for exporting from received sync payloads.
- **Interface**:
  - `upsert(record)`
  - `getAll()`
  - `reset()`
- **Lifecycle**: module-level `Map`; resets only on process restart or explicit `reset`.
- **Used by**: `syncRoutes.ts`, `consoleRoutes.ts`, `adminRoutes.ts` (exports and DB-less reporting routes).

**Non-obvious behavior**: this data disappears on server restart, so “DB-less mode” is only viable for short-lived dev/test sessions.

### `firebaseAdmin` (Firestore initialization)
- **File**: `daily-work-tracker-ios/DW/DW/firebaseAdmin.ts`
- **Responsibility**: Initializes Firebase Admin SDK either from `FIREBASE_SERVICE_ACCOUNT` (JSON string env) or from default credentials.
- **Interface**: `getFirestore()`
- **Lifecycle**: Firestore client is cached after first init.
- **Used by**: `syncRoutes.ts`, `consoleRoutes.ts`, `adminRoutes.ts` (indirectly via routes).

**Non-obvious behavior**: initialization is done lazily (on first `getFirestore()` call). If service account env is invalid/missing, the first Firestore operation will throw, but some routes catch and fall back to memory.

### `syncRoutes` sync endpoint
- **File**: `daily-work-tracker-ios/DW/DW/syncRoutes.ts`
- **Responsibility**: Receives a workday record from the iOS app, validates with zod, writes to `memoryStore`, and writes to Firestore (best-effort).
- **Interface**: `POST /api/v1/workday/sync`
- **Lifecycle**: request-scoped; uses `memoryStore.upsert`.
- **Used by**: iOS app sync workflow.

### `mediaRoutes` upload endpoint
- **File**: `daily-work-tracker-ios/DW/DW/mediaRoutes.ts`
- **Responsibility**: Accepts multipart upload via multer and stores files under `./uploads/workday-photos`.
- **Interface**: `POST /api/v1/media/upload` (exact route mount in `server.ts`: `/api/v1/media`)
- **Lifecycle**: creates upload directory if missing.
- **Used by**: iOS PhotoService.

## Data Flow (Primary Paths)

1. **Server boot**
   - `DW/DW/server.ts` creates Express app and mounts:
     - `/api/v1/workday` → `syncRoutes`
     - `/api/v1/console` → `consoleRoutes`
     - `/api/v1/admin` → `adminRoutes`
     - `/api/v1/media` → `mediaRoutes`

2. **iOS workday sync**
   - iOS calls `POST /api/v1/workday/sync`
   - `syncRoutes.ts`:
     1) validates payload with `WorkdaySchema.parse`
     2) maps into `WorkdayRecordForReports`
     3) calls `memoryStore.upsert(recordForReports)`
     4) attempts Firestore write; errors are caught/logged but sync still returns success.

3. **Admin console stats**
   - Admin calls `GET /api/v1/console/stats/:period`
   - `consoleRoutes.ts`:
     1) reads `memoryStore.getAll()`
     2) tries Firestore read; on error it logs and uses `memoryStore`
     3) computes totals for a period and returns aggregated JSON

4. **Admin exports**
   - Admin calls `GET /api/v1/admin/reports/export/xlsx` or `/csv`
   - `adminRoutes.ts` uses `memoryStore.getAll()` (DB-less) and filters by date + employeeCode.

5. **Photo upload**
   - iOS calls `POST /api/v1/media/upload` with multipart form data including `photoId`
   - `mediaRoutes.ts` writes file to local filesystem and returns a URL like `/uploads/workday-photos/<filename>`.

## Non-Obvious Behaviors & Design Decisions

### 1) “DB-less mode” exists, but DB wiring can still poison startup or first requests
- The server always constructs the Postgres pool at module import time (`DW/db.ts`), even if `DB_PASSWORD` is missing (it becomes empty string).
- Some routes in `adminRoutes.ts` import `db` and will attempt SQL queries (e.g., `/api/v1/admin/reports`, `/api/v1/admin/reports/:id/pdf`, `/api/v1/admin/live-locations`).
- Those endpoints may fail at query time with authentication errors, but the server process itself should still remain up.

**Meaning for your symptom**: if your “app keeps running into errors” is happening immediately on startup, the likely cause is *not* the Express listen, but a route import-time crash or unhandled initialization elsewhere. For the current code we’ve read, most route logic is request-time, so the most common error loops are caused by repeated failed admin/console requests (e.g., UI polling) rather than the server crashing.

### 2) Firestore initialization is lazy and partially tolerated
- `getFirestore()` runs only when a route hits Firestore.
- `syncRoutes.ts` catches Firestore write failures and still returns `200 {success:true}`.
- `consoleRoutes.ts` catches Firestore read failures and falls back to memory.

**Meaning**: you can bring up the UI even if Firestore env is wrong; you’ll just see empty/partial data.

### 3) Role auth may break console/admin flows completely
- All admin/manager/worker endpoints require a Firebase JWT by default.
- If the console UI is polling endpoints without a token or with a token missing the expected role claim, you’ll get repeated 401/403 responses.
- There is an escape hatch: `DEV_BYPASS_ADMIN_CLAIMS === 'true'`.

### 4) In-memory records reset on restart
- If you start the backend and then reload the UI without resyncing, admin pages may look broken/empty.
- Conversely, if your server “keeps running into errors” while running, it could be because the console UI keeps polling and triggers repeated failing calls (auth/Firestore/DB).

## Module Reference

| File | Purpose |
|------|---------|
| `daily-work-tracker-ios/DW/DW/server.ts` | Express bootstrap + route mounting |
| `daily-work-tracker-ios/DW/DW/syncRoutes.ts` | Workday sync validation + memoryStore + Firestore write |
| `daily-work-tracker-ios/DW/DW/consoleRoutes.ts` | Admin console stats/workday detail, Firestore-first with memory fallback |
| `daily-work-tracker-ios/DW/DW/adminRoutes.ts` | Admin reports + exports + live locations (mix of DB and memory) |
| `daily-work-tracker-ios/DW/DW/mediaRoutes.ts` | Photo upload via multer to local `uploads/` |
| `daily-work-tracker-ios/DW/DW/auth.ts` | Firebase token verification + role enforcement |
| `daily-work-tracker-ios/DW/DW/firebaseAdmin.ts` | Firebase Admin initialization and Firestore access |
| `daily-work-tracker-ios/DW/DW/memoryStore.ts` | In-memory record store |
| `daily-work-tracker-ios/DW/db.ts` | Postgres pool configuration via env |

## Suggested Reading Order
1. `daily-work-tracker-ios/DW/DW/server.ts` — start here to understand how requests enter the system.
2. `daily-work-tracker-ios/DW/DW/auth.ts` — understand why console/admin endpoints might fail repeatedly.
3. `daily-work-tracker-ios/DW/DW/syncRoutes.ts` — see what the iOS app sends and how it’s persisted.
4. `daily-work-tracker-ios/DW/DW/consoleRoutes.ts` — see the UI-facing JSON contract and fallback behavior.
5. `daily-work-tracker-ios/DW/DW/adminRoutes.ts` — see export/report endpoints and DB vs memory usage.
6. `daily-work-tracker-ios/DW/db.ts` — understand why missing DB env causes query failures.

## Most Likely “Keeps Running Into Errors” Startup Causes (Actionable Checks)
These are the highest-probability issues inferred from the code you have:

1. **Console/Admin UI is making authenticated requests without valid tokens**
   - Look for 401/403 responses. If present, verify:
     - console UI attaches `Authorization: Bearer ...`
     - token includes a `role` claim of `admin|manager|worker`
   - For bring-up, set `DEV_BYPASS_ADMIN_CLAIMS=true` (dev only).

2. **Firestore env/config is missing or invalid**
   - Look for logged `Firestore write/read failed` errors in server logs.
   - If so, console still works only insofar as `memoryStore` has data.

3. **Postgres env misconfiguration**
   - If you hit DB-backed admin routes (`/api/v1/admin/reports`, `/api/v1/admin/live-locations`, etc.), they’ll fail if:
     - `DB_PASSWORD` is missing → empty string password is used
     - network/host/dbname are wrong.
   - Note: these failures happen at request time, not during `app.listen`.

4. **Payload shape mismatch causing zod validation failures**
   - `syncRoutes.ts` uses strict zod schema; invalid payloads return 400 with zod details.
   - If iOS sync is “looping,” zod errors may be the reason.

If you paste the exact server log lines you see when it “keeps running into errors” (first error + stack trace + HTTP status), I can narrow it to a single root cause and the minimal config/contract change required.
