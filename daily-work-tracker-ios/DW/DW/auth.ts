import { Request, Response, NextFunction } from 'express'

import { getFirestore } from './firebaseAdmin'
import { businessMemoryStore } from './businessMemoryStore'

/**
 * Role-based authentication for the enterprise system.
 *
 * Primary mode (legacy/admin):
 * - Uses Firebase ID tokens (Bearer) and expects a `role` claim (admin/manager/worker)
 *   or a boolean `admin` claim for backward compatibility.
 *
 * New mode (iOS MVP without Firebase):
 * - Accepts a worker secret as the Bearer token.
 * - Maps workerSecret -> { tenantId, employeeCode, role=worker } from:
 *   - in-memory businessMemoryStore (DB-less mode)
 *   - Firestore collection `worker_secrets` (tenant-scoped)
 */
export type AppRole = 'admin' | 'manager' | 'worker'

type ParsedClaims = {
  role: AppRole | null
  tenantId: string | null
  userId: string | null
  employeeCode: string | null
}

type WorkerSecretRecord = {
  tenantId: string
  employeeCode: string
  role: 'worker'
}

const parseRoleClaim = (claims: Record<string, unknown>): AppRole | null => {
  const role = claims.role ?? claims.userRole ?? ''
  const roleStr = String(role ?? '').toLowerCase().trim()
  if (roleStr === 'admin' || roleStr === 'manager' || roleStr === 'worker') return roleStr

  // Backward compatible shapes
  const isAdminClaim =
    claims.admin === true ||
    String(claims.admin ?? '').toLowerCase() === 'true' ||
    claims.admin === 'true' ||
    claims.admin === '1' ||
    claims.admin === 1

  if (isAdminClaim) return 'admin'

  return null
}

const parseTenantIdClaim = (claims: Record<string, unknown>): string | null => {
  const raw =
    claims.tenantId ??
    claims.tenant ??
    claims.businessId ??
    claims.business_id ??
    claims.companyId ??
    claims.company_id ??
    null

  const s = raw === null || raw === undefined ? '' : String(raw).trim()
  return s.length ? s : null
}

const parseEmployeeCodeClaim = (claims: Record<string, unknown>): string | null => {
  const raw =
    claims.employeeCode ??
    claims.employee_code ??
    claims.empCode ??
    claims.emp_code ??
    null

  const s = raw === null || raw === undefined ? '' : String(raw).trim()
  return s.length ? s : null
}

const parseUserIdClaim = (claims: Record<string, unknown>, decodedSub: string): string => {
  const raw = claims.uid ?? claims.userId ?? decodedSub
  return String(raw ?? decodedSub ?? '').trim()
}

const parseAllClaims = (decoded: Record<string, unknown>): ParsedClaims => {
  const role = parseRoleClaim(decoded)
  const tenantId = parseTenantIdClaim(decoded)

  const decodedSub = String(decoded.sub ?? decoded.uid ?? '').trim()
  const userId = parseUserIdClaim(decoded, decodedSub)

  const employeeCode = parseEmployeeCodeClaim(decoded)

  return {
    role,
    tenantId: tenantId ?? null,
    userId: userId.length ? userId : null,
    employeeCode,
  }
}

async function lookupWorkerSecret(token: string): Promise<WorkerSecretRecord | null> {
  // 1) In-memory (DB-less mode)
  const mem = businessMemoryStore.getWorkerSecretRecord(token)
  if (mem) return mem

  // 2) Firestore (if configured)
  // We store secrets by workerSecret as doc id:
  // collection('worker_secrets').doc(workerSecret) => { tenantId, employeeCode, role:'worker' }
  try {
    const firestore = getFirestore()
    const doc = await firestore.collection('worker_secrets').doc(token).get()
    if (!doc.exists) return null

    const d = doc.data() as Record<string, unknown> | undefined
    if (!d) return null

    const tenantId = typeof d.tenantId === 'string' ? d.tenantId : ''
    const employeeCode = typeof d.employeeCode === 'string' ? d.employeeCode : ''
    const role = d.role === 'worker' ? 'worker' : null

    if (!tenantId || !employeeCode || !role) return null

    return { tenantId, employeeCode, role: 'worker' }
  } catch (_e) {
    // If Firebase Admin isn't configured, ignore and keep auth rejecting.
    return null
  }
}

export const authenticateRole =
  (allowedRoles: AppRole[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    // Development escape hatch:
    const devBypass = process.env.DEV_BYPASS_ADMIN_CLAIMS === 'true'
    if (devBypass) {
      const devTenantId = process.env.DEV_TENANT_ID?.trim() || 'dev-tenant'
      const devRole: AppRole = (allowedRoles.includes('admin') ? 'admin' : allowedRoles[0]) ?? 'admin'

      ;(req as any).authRole = devRole
      ;(req as any).authTenantId = devTenantId
      ;(req as any).authUserId = process.env.DEV_USER_ID?.trim() || 'dev-user'
      ;(req as any).authEmployeeCode = process.env.DEV_EMPLOYEE_CODE?.trim() || null
      req.body = req.body ?? {}
      return next()
    }

    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing Bearer token.' })
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Empty token.' })
    }

    // 1) Try legacy Firebase token verification first
    try {
      const admin = (await import('firebase-admin')).default
      const decoded = await admin.auth().verifyIdToken(token)

      const claims = decoded as unknown as Record<string, unknown>
      const parsed = parseAllClaims(claims)

      if (!parsed.role) {
        return res.status(403).json({ error: 'Forbidden: Missing role claim.', claims })
      }

      if (!allowedRoles.includes(parsed.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role.', role: parsed.role, allowedRoles })
      }

      req.body = req.body ?? {}
      ;(req as any).authRole = parsed.role
      ;(req as any).authTenantId = parsed.tenantId
      ;(req as any).authUserId = parsed.userId
      ;(req as any).authEmployeeCode = parsed.employeeCode

      return next()
    } catch (_firebaseErr) {
      // 2) If Firebase auth fails, attempt worker-secret mode
      const workerRecord = await lookupWorkerSecret(token)
      if (!workerRecord) {
        // eslint-disable-next-line no-console
        console.error('authenticateRole failed: firebase verification + worker secret lookup both failed')
        return res.status(401).json({ error: 'Unauthorized: Invalid token.' })
      }

      const role: AppRole = 'worker'
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient role.', role, allowedRoles })
      }

      req.body = req.body ?? {}
      ;(req as any).authRole = role
      ;(req as any).authTenantId = workerRecord.tenantId
      ;(req as any).authUserId = null
      ;(req as any).authEmployeeCode = workerRecord.employeeCode
      return next()
    }
  }

export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
  return authenticateRole(['admin'])(req, res, next)
}
