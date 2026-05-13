# A–G Azure Deployment & Tenant-Isolation Plan (DailyWorkTracker)

This document describes a practical Azure deployment plan for the current codebase state:
- iOS app: `daily-work-tracker-ios/Sources/DailyWorkTracker/...`
- Backend API (Express/TS): `daily-work-tracker-ios/DW/DW/...`
- Admin console (React/Vite): `daily-work-tracker-ios/ddworkrecord-console/...`

> Scope note (current implementation reality):
> - Photos are uploaded to **Azure Blob** via `POST /api/v1/media/upload` (tenant-scoped blob naming).
> - Workday records are stored **DB-less** in `memoryStore` and (best-effort) written to **Firestore** under `tenants/{tenantId}/workdays/{workdayId}`.
> - Admin reporting/export currently uses `memoryStore` (DB-less) and a tenant-safe PDF generator that renders timeline text (not image receipts).
> - Live locations and some DB-backed reporting are still blocked/placeholder until the tenant-safe record/document shape is fully established for every reporting mode.

---

## A) Azure Resource Inventory (what to create)

### A1. Compute
1) **Backend API**
- **Azure App Service (Linux)** *or* **Azure Container Apps**
- App: `dd-work-tracker-api`
- Entrypoint: `node dist/server.js` (from `daily-work-tracker-ios/DW`)
- Handles:
  - `/api/v1/workday/sync`
  - `/api/v1/media/upload`
  - `/api/v1/console/*`
  - `/api/v1/admin/*`

2) **Admin Console**
- Prefer **Azure Static Web Apps** (or an App Service if you must)
- App: `dd-work-tracker-console`
- Serves the React build from `daily-work-tracker-ios/ddworkrecord-console`

### A2. Storage (photos + exports)
1) **Azure Blob Storage account**
- Container: `workday-media`
- Blob path pattern (tenant-scoped):
  - `tenants/{tenantId}/workday-photos/{photoId}.jpg` (plus extension handling)

2) (Optional) Separate container for exports (if you later want to store generated XLSX/PDF):
- Container: `workday-exports`

### A3. Networking / Access
- Use environment variables and managed identity/connection strings as preferred.
- Keep public access limited:
  - Blob reads should be either:
    - private container + SAS returned by API, or
    - public container with path-based tenant isolation (not recommended).

---

## B) Backend Configuration (environment variables + wiring)

### B1. Required env vars (Azure)
Backend uses these env vars:

**Blob**
- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME` (e.g. `workday-media`)
- `AZURE_BLOB_SAS_TTL_SECONDS` (optional, default `3600`)

**Server**
- `PORT` (optional, default `3001`)

**Firebase (Firestore)**
- The code uses `firebaseAdmin.ts` to initialize Firebase Admin.
- You must provide **either**:
  - `FIREBASE_SERVICE_ACCOUNT` (JSON string), OR
  - default credentials supported by your Azure environment.

**Postgres (DB-backed routes)**
- Not required for DB-less operation, but required if you want `/api/v1/admin/reports` DB mode.
- Existing `db.ts` constructs a Pool even if `DB_PASSWORD` is missing (it becomes `''`), so in production either:
  - always provide DB env vars, or
  - remove/disable DB-backed routes until schema is tenant-safe.

### B2. Tenant isolation model (claims → routing → data paths)
1) **Firebase custom claims** on ID tokens include:
- `role`: `admin | manager | worker`
- `tenantId`: tenant discriminator (from multiple possible claim keys)

2) Backend extracts:
- `req.authTenantId`
- `req.authRole`
- `req.authUserId` (if present)
- `req.authEmployeeCode` (if present)

3) Backend uses `req.authTenantId` to isolate:
- In-memory store keys: `${tenantId}::${recordId}`
- Firestore write path:
  - `tenants/{tenantId}/workdays/{recordId}`

- Blob path:
  - `tenants/{tenantId}/workday-photos/{photoId}.ext`

---

## C) Deployment Steps (repeatable checklist)

### C1. Backend deploy
1) Build backend:
- `cd daily-work-tracker-ios/DW && npm install`
- `npm run build` (tsc)

2) Deploy to Azure App Service / Container Apps
- Set environment variables (Blob + Firebase + any DB vars you want)
- Health check:
  - `GET /__health`

3) Ensure route mount works:
- `server.ts` mounts:
  - `/api/v1/workday` → `syncRoutes.ts`
  - `/api/v1/media` → `mediaRoutes.ts`
  - `/api/v1/console` → `consoleRoutes.ts`
  - `/api/v1/admin` → `adminRoutes.ts`

> Cleanup recommendation:
> - `server.ts` still serves `app.use('/uploads', express.static('uploads'))`.
> - Since we now upload photos to Blob, local `/uploads` is effectively unused.
> - You can keep it for backwards compatibility, but for “100% cloud” you should:
>   - either delete the static mount, or
>   - keep it behind a feature flag.

### C2. Console deploy
1) Build:
- `cd daily-work-tracker-ios/ddworkrecord-console`
- `npm install`
- `npm run build` (if present) or use Vite’s build command configured by Static Web Apps

2) Configure API base URL:
- In the console, `API_BASE_URL` must point to the backend’s public URL.

3) Tokens:
- Admin console uses localStorage token fields (`ddworkrecord_admin_token`)
- Production: ensure the admin token acquisition flow is secured (not implemented in this repo yet—token viewer is for dev).

---

## D) Security & Tenant Isolation Guarantees

### D1. Auth enforcement (current)
- `/api/v1/workday/sync` requires `authenticateRole` and requires `req.authTenantId`
- `/api/v1/media/upload` requires `authenticateRole` and requires `tenantId`
- console/admin endpoints require `authenticateAdmin`

### D2. Blob security strategy (current implementation)
- Upload:
  - blob is uploaded to tenant-scoped path
- Response:
  - API returns a SAS URL with read permission
- Recommended:
  - keep Blob container **private**
  - avoid long SAS TTLs

### D3. Firestore security rules (required but not implemented in this repo)
To finish true multi-tenant isolation in Firestore:
- security rules must enforce:
  - user claims must match `tenants/{tenantId}/...` document tenantId
- If you don’t implement security rules, the server can write, but clients could still leak if they have access via rules.

---

## E) Data Model & Tenant Claims (what must exist in Firebase)

### E1. Firebase custom claims (must be present)
- `role`
- `tenantId`
- optionally `employeeCode` and `userId`

### E2. Firestore layout (current paths used)
- `tenants/{tenantId}/workdays/{workdayId}`

### E3. Firestore layout (planned, to unblock live locations + robust PDF)
Add/standardize:
- `tenants/{tenantId}/employees/{employeeCode}` (admin route writes this)
- segment shape consistency for:
  - photos per segment (photoId list)
  - enough fields for:
    - PDF receipt rendering
    - live location timeline extraction

> Current code does not render photos in PDF; it renders timeline text only.

---

## F) CI/CD (recommended)
1) GitHub Actions pipeline:
- on push to main:
  - build backend
  - run `npx tsc -p tsconfig.json`
  - build console
- deploy to:
  - backend slot (staging → prod)
  - console slot

2) Secrets:
- store Firebase service account JSON securely
- store Blob connection string securely

---

## G) Architecture Diagram (ASCII)

```text
                 +------------------------------+
                 |  Azure Admin Console         |
                 |  ddworkrecord-console        |
                 |  (React/Vite)                |
                 +---------------+--------------+
                                 |
                                 | HTTPS (Authorization: Bearer)
                                 v
                 +---------------+--------------+
                 |  Azure Backend API          |
                 |  dd-work-tracker-api       |
                 |  Express + Firebase Admin  |
                 +------+----------+-----------+
                        |          |
                        |          |
         /api/v1/workday/sync     |  /api/v1/media/upload
                (tenant-scoped)    (tenant-scoped)
                        |          |
                        v          v
          +-------------+--+     +--------------------------+
          |  Memory Store    |     | Azure Blob Storage     |
          | (tenant key)     |     | workday-media          |
          +------------------+     | tenants/{tenantId}/...|
                                 +--------------------------+
                        |
                        | Firestore best-effort
                        v
            +-----------------------------+
            | Firestore (multi-tenant)   |
            | tenants/{tenantId}/workdays|
            +-----------------------------+
```

---

## “CLR integration” note
Your earlier mention of “CLR integration” is ambiguous in this repo context. In Azure, the closest typical meanings are:
- CLR = **Cloud Run / Containers / CI-CD runner integration**, or
- CLR = **custom claims/role integration pipeline**, or
- CLR = **Common Language Runtime** (unlikely here).

**TBD**: confirm what “CLR” specifically refers to in your deployment plan before finalizing that section.

---

## Status Summary (relative to current repo)
- ✅ Backend tenant-scoped sync + console reads
- ✅ iOS token login UI (REST Firebase auth) + Authorization header injection
- ✅ Azure Blob upload route (tenant-scoped blob path + SAS URL response)
- ✅ Tenant-safe DB-less PDF export (timeline text only)
- ⚠️ Live locations + photo rendering in PDF still require additional model/rule work
- ⚠️ Firestore security rules and full tenant claim pipeline need completion
