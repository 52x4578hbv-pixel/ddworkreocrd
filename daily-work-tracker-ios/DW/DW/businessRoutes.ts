import express, { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { memoryStore } from './memoryStore'
import { businessMemoryStore } from './businessMemoryStore'
import { getFirestore } from './firebaseAdmin'

const allowDbLessBusiness = process.env.ALLOW_DBLESS_BUSINESS === 'true'
const router = express.Router()
// NOTE: business routes are mounted under /api/v1/business in server.ts. This comment is a no-op used to force a backend redeploy.

type BusinessRegisterBody = {
  businessName?: string
  contactEmail?: string
  businessCountry?: string
}

type AccessCodeRecord = {
  tenantId: string
  businessName?: string | null
  createdAt?: string | null
}

/**
 * Authenticate business by access code.
 * Client sends: Authorization: Bearer <businessCode>
 */
const authenticateBusinessCode = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer access code.' })
  }

  const code = authHeader.slice('Bearer '.length).trim()
  if (!code) return res.status(401).json({ error: 'Unauthorized: Empty access code.' })

  try {
    const firestore = getFirestore()
    const doc = await firestore.collection('tenant_access_codes').doc(code).get()
    if (!doc.exists) {
      // Fallback: code may have been minted via in-memory store (DB-less / partial config)
      const tenantId = businessMemoryStore.getTenantIdByAccessCode(code)
      if (tenantId && allowDbLessBusiness) {
        ;(req as any).authTenantId = tenantId
        return next()
      }
      return res.status(403).json({ error: 'Forbidden: Invalid access code.' })
    }

    const d = doc.data() as AccessCodeRecord
    if (!d?.tenantId) {
      const tenantId = businessMemoryStore.getTenantIdByAccessCode(code)
      if (tenantId && allowDbLessBusiness) {
        ;(req as any).authTenantId = tenantId
        return next()
      }
      return res.status(403).json({ error: 'Forbidden: access code missing tenantId.' })
    }

    ;(req as any).authTenantId = d.tenantId
    return next()
  } catch (err) {
    // Firebase not configured in this environment.
    // Only allow in-memory fallback when explicitly enabled.
    const tenantId = businessMemoryStore.getTenantIdByAccessCode(code)
    if (tenantId && allowDbLessBusiness) {
      ;(req as any).authTenantId = tenantId
      return next()
    }

    // eslint-disable-next-line no-console
    console.error('authenticateBusinessCode failed:', err)
    // Treat it as invalid when fallback is disabled.
    return res.status(403).json({ error: 'Forbidden: Invalid access code.' })
  }
}

const generateTenantId = () => {
  // stable enough for Firestore doc ids
  return `tenant_${crypto.randomBytes(6).toString('hex')}`
}

const generateAccessCode = () => {
  // 10-ish chars, uppercase alnum
  const raw = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  const code = raw.slice(0, 10).toUpperCase()
  return code
}

const pickTenantScopedFirestoreWorkdays = async (tenantId: string) => {
  const firestore = getFirestore()
  const snapshot = await firestore.collection('tenants').doc(tenantId).collection('workdays').get()
  return snapshot.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>
    return {
      tenantId,
      id: doc.id,
      employeeId: String(d.employeeId ?? d.employee_id ?? ''),
      date: String(d.workDate ?? d.date ?? ''),
      startMileage: (d.startMileage as number | null) ?? null,
      endMileage: (d.endMileage as number | null) ?? null,
      totalHours: Number(d.totalHours ?? d.total_hours ?? 0),
      totalDistanceKm: Number(d.totalDistanceKm ?? d.total_distance_km ?? 0),
      jobs: (Array.isArray(d.jobs) ? d.jobs : []) as any[],
      fuels: (Array.isArray(d.fuels) ? d.fuels : []) as any[],
      suppliers: (Array.isArray(d.suppliers) ? d.suppliers : []) as any[],
      workshops: (Array.isArray(d.workshops) ? d.workshops : []) as unknown[],
      travels: (Array.isArray(d.travels) ? d.travels : []) as unknown[],
      privateSegments: (Array.isArray(d.privateSegments) ? d.privateSegments : []) as unknown[],
      vehicleId: (d.vehicleId as string | null) ?? null,
      endNotes: (d.endNotes as string | null) ?? null,
      dayStartLocation: (d.dayStartLocation ?? d.day_start_location) as any,
      dayEndLocation: (d.dayEndLocation ?? d.day_end_location) as any,
    }
  })
}

router.post('/register', async (req: Request, res: Response) => {
  const body = req.body as BusinessRegisterBody | undefined
  const businessName = (body?.businessName ?? '').toString().trim()
  const contactEmail = (body?.contactEmail ?? '').toString().trim()

  const businessCountryRaw = (body?.businessCountry ?? '').toString().trim().toUpperCase()
  const businessCountry: 'ZA' | 'US' = businessCountryRaw === 'US' ? 'US' : 'ZA'

  if (!businessName) {
    return res.status(400).json({ error: 'businessName is required.' })
  }

  // You can choose to validate email later; for now allow optional.
  if (contactEmail && !contactEmail.includes('@')) {
    return res.status(400).json({ error: 'contactEmail looks invalid.' })
  }

  try {
    const tenantId = generateTenantId()

    // Create tenant doc (best-effort)
    const firestore = getFirestore()
    await firestore.collection('tenants').doc(tenantId).set(
      {
        tenantId,
        businessName,
        contactEmail: contactEmail || null,
        businessCountry,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )

    // Mint an access code
    let attempts = 0
    while (attempts < 5) {
      attempts += 1
      const code = generateAccessCode()
      const existing = await firestore.collection('tenant_access_codes').doc(code).get()
      if (existing.exists) continue

      await firestore.collection('tenant_access_codes').doc(code).set({
        tenantId,
        businessName,
        contactEmail: contactEmail || null,
        businessCountry,
        createdAt: new Date().toISOString(),
      })

      return res.json({ businessCode: code, tenantId })
    }

    return res.status(500).json({ error: 'Failed to generate access code. Try again.' })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('business register failed:', err)

    // Firebase not configured in this environment — fall back to in-memory registration.
    try {
      return res.json(
        businessMemoryStore.registerBusiness({
          businessName,
          contactEmail: contactEmail || null,
          businessCountry,
        })
      )
    } catch (_e) {
      return res.status(500).json({ error: 'Failed to register business.' })
    }
  }
})

router.get('/debug', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    status: 'debug',
    buildSha: process.env.BUILD_SHA ?? null,
    features: { businessRoutes: true },
  })
})

type MintWorkerSecretsBody = {
  employeeCodes?: string[]
}

/**
 * POST /api/v1/business/mint-worker-secrets
 * Auth: Authorization: Bearer <businessCode>
 * Body: { employeeCodes: ["EMP-001","EMP-002"] }
 *
 * Returns: { secrets: [{ employeeCode, workerSecret }] }
 */
router.post('/mint-worker-secrets', authenticateBusinessCode, async (req: Request, res: Response) => {
  const body = req.body as MintWorkerSecretsBody | undefined
  const raw = body?.employeeCodes ?? []

  const tenantId = (req as any).authTenantId as string | null
  if (!tenantId) return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })

  if (!Array.isArray(raw) || raw.length === 0) {
    return res.status(400).json({ error: 'employeeCodes must be a non-empty array.' })
  }

  const employeeCodes = raw
    .map((c) => String(c ?? '').trim())
    .filter((c) => c.length > 0)

  if (employeeCodes.length === 0) {
    return res.status(400).json({ error: 'employeeCodes must contain at least one non-empty string.' })
  }

  // DB-less mode (in-memory) always works.
  const minted = businessMemoryStore.mintWorkerSecrets(tenantId, employeeCodes)

  // Firestore write (best-effort): store by workerSecret so auth can lookup quickly.
  try {
    const firestore = getFirestore()
    const sharedSecret = minted[0]?.workerSecret ?? null
    const isShared = sharedSecret ? minted.every((m) => m.workerSecret === sharedSecret) : false

    for (const item of minted) {
      await firestore.collection('worker_secrets').doc(item.workerSecret).set(
        {
          tenantId,
          // If this tenant uses a shared worker secret for all employees,
          // make the worker secret token employee-agnostic by storing empty employeeCode.
          employeeCode: isShared ? '' : item.employeeCode,
          role: 'worker',
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      )
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('mint-worker-secrets firestore write failed:', e)
  }

  return res.status(200).json({ secrets: minted })
})

router.get('/stats/:period', authenticateBusinessCode, async (req: Request, res: Response) => {
  const rawPeriod = req.params.period
  const period = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod

  try {
    if (!period || !['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use day|week|month' })
    }

    const tenantId = (req as any).authTenantId as string | null
    if (!tenantId) return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })

    // prefer memoryStore (DB-less mode), fallback to Firestore if available
    let all: ReturnType<typeof memoryStore.getAll> = memoryStore.getAll(tenantId) as any

    try {
      // If Firestore is configured, use it for more accurate stats
      // (this mirrors consoleRoutes behavior).
      const records = await pickTenantScopedFirestoreWorkdays(tenantId)
      if (records.length) {
        all = records as any
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('business stats firestore read failed; using memoryStore:', e)
    }

    const now = new Date()
    const parseDate = (v: string) => new Date(`${v}T00:00:00.000Z`)

    const start = (() => {
      if (period === 'day') {
        const d = new Date(now)
        d.setUTCHours(0, 0, 0, 0)
        return d
      }
      if (period === 'week') {
        const d = new Date(now)
        const day = d.getUTCDay() // Sun=0..Sat=6
        const diff = (day + 6) % 7 // Monday-based
        d.setUTCDate(d.getUTCDate() - diff)
        d.setUTCHours(0, 0, 0, 0)
        return d
      }
      const d = new Date(now)
      d.setUTCDate(1)
      d.setUTCHours(0, 0, 0, 0)
      return d
    })()

    const end = (() => {
      if (period === 'day') return new Date(start.getTime() + 24 * 3600 * 1000)
      if (period === 'week') return new Date(start.getTime() + 7 * 24 * 3600 * 1000)
      return new Date(new Date(start).setUTCMonth(start.getUTCMonth() + 1))
    })()

    const filtered = all.filter((r: any) => {
      const d = parseDate(String(r.date ?? ''))
      return d >= start && d < end
    })

    let grandTotalHours = 0
    let grandTotalDistanceKm = 0
    let grandFuelCost = 0
    let grandSupplierSpend = 0

    for (const row of filtered) {
      const totalHours = Number(row.totalHours ?? 0)
      const totalDistanceKm = Number(row.totalDistanceKm ?? 0)
      grandTotalHours += totalHours
      grandTotalDistanceKm += totalDistanceKm

      const rawFuels = Array.isArray(row.fuels) ? row.fuels : []
      const rawSuppliers = Array.isArray(row.suppliers) ? row.suppliers : []

      const fuelCostSum = rawFuels.reduce((acc: number, f: any) => {
        const v = Number(f?.totalCost ?? f?.total_cost ?? 0)
        return acc + (Number.isFinite(v) ? v : 0)
      }, 0)

      const supplierSpendSum = rawSuppliers.reduce((acc: number, s: any) => {
        const v = Number(s?.amountSpent ?? s?.amount_spent ?? 0)
        return acc + (Number.isFinite(v) ? v : 0)
      }, 0)

      grandFuelCost += fuelCostSum
      grandSupplierSpend += supplierSpendSum
    }

    return res.json({
      period,
      grandTotals: {
        totalHours: grandTotalHours,
        totalDistanceKm: grandTotalDistanceKm,
        fuelCost: grandFuelCost,
        supplierSpend: grandSupplierSpend,
      },
      // keep shape compatible with existing console dashboard typing
      employees: [],
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('business stats failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Failed to fetch business stats', message })
  }
})

router.get('/workdays', authenticateBusinessCode, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).authTenantId as string | null
    if (!tenantId) return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })

    const q = req.query
    const rawStart = Array.isArray(q.startDate) ? q.startDate[0] : q.startDate
    const rawEnd = Array.isArray(q.endDate) ? q.endDate[0] : q.endDate
    const rawEmployeeCode = Array.isArray(q.employeeCode) ? q.employeeCode[0] : q.employeeCode

    const startDate = typeof rawStart === 'string' ? rawStart : null
    const endDate = typeof rawEnd === 'string' ? rawEnd : null
    const employeeCode = typeof rawEmployeeCode === 'string' ? rawEmployeeCode : null

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' })
    }

    const start = new Date(`${startDate}T00:00:00.000Z`).getTime()
    const endExclusive = new Date(`${endDate}T00:00:00.000Z`).getTime() + 24 * 3600 * 1000

    const parseDate = (v: unknown) => {
      if (typeof v !== 'string') return null
      const t = new Date(`${v}T00:00:00.000Z`).getTime()
      return Number.isFinite(t) ? t : null
    }

    // Prefer Firestore if available; fallback to memoryStore.
    let all: any[] = []
    try {
      const records = await pickTenantScopedFirestoreWorkdays(tenantId)
      if (records.length) all = records as any
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('business workdays firestore read failed; using memoryStore:', e)
    }

    if (!all.length) {
      all = memoryStore.getAll(tenantId) as any
    }

    const filtered = all
      .filter((r) => {
        const t = parseDate(r.date ?? r.workDate)
        if (t === null) return false
        return t >= start && t < endExclusive
      })
      .filter((r) => {
        if (!employeeCode) return true
        const code = String(r.employeeId ?? r.employee_code ?? '').trim()
        return code === employeeCode
      })
      .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))

    return res.status(200).json({ workdays: filtered })
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('business workdays failed:', e)
    return res.status(500).json({ error: 'Failed to fetch business workdays' })
  }
})

// Live locations for the Geo Map (tenant-safe via business code).
// Response shape matches console `fetchLiveLocations()`:
//   [{ employeeCode, location: {lat,lng} | null }, ...]
router.get('/live-locations', authenticateBusinessCode, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).authTenantId as string | null
    if (!tenantId) return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })

    const extractLatestLocation = (rawData: any): { lat: number; lng: number } | null => {
      if (!rawData) return null

      // Prefer dayEndLocation when valid
      if (rawData.dayEndLocation && rawData.dayEndLocation.lat !== 0 && rawData.dayEndLocation.lng !== 0) {
        return rawData.dayEndLocation
      }

      let latestTime: Date | null = null
      let latestLocation: { lat: number; lng: number } | null = null

      const segments = [
        ...(rawData.workshops || []),
        ...(rawData.travels || []),
        ...(rawData.suppliers || []),
        ...(rawData.fuels || []),
        ...(rawData.jobs || []),
        ...(rawData.privateSegments || []),
      ]

      for (const segment of segments) {
        let segmentEndTime: Date | null = null
        let segmentEndLocation: { lat: number; lng: number } | null = null

        if (segment.endTime) {
          segmentEndTime = new Date(segment.endTime)
          segmentEndLocation = segment.endLocation || segment.departureLocation
        } else if (segment.departureTime) {
          segmentEndTime = new Date(segment.departureTime)
          segmentEndLocation = segment.departureLocation
        } else if (segment.startTime) {
          segmentEndTime = new Date(segment.startTime)
          segmentEndLocation = segment.startLocation || segment.arrivalLocation
        }

        if (
          segmentEndTime &&
          segmentEndLocation &&
          segmentEndLocation.lat !== 0 &&
          segmentEndLocation.lng !== 0
        ) {
          if (!latestTime || segmentEndTime > latestTime) {
            latestTime = segmentEndTime
            latestLocation = segmentEndLocation
          }
        }
      }

      if (latestLocation) return latestLocation

      if (rawData.dayStartLocation && rawData.dayStartLocation.lat !== 0 && rawData.dayStartLocation.lng !== 0) {
        return rawData.dayStartLocation
      }

      return null
    }

    // Prefer Firestore workdays if configured; fallback to in-memory.
    let all: any[] = []
    try {
      const records = await pickTenantScopedFirestoreWorkdays(tenantId)
      if (records.length) all = records as any
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('business live-locations firestore read failed; using memoryStore:', e)
    }

    if (!all.length) {
      all = memoryStore.getAll(tenantId) as any
    }

    const sorted = [...all].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

    const byEmployee = new Map<string, { employeeCode: string; location: { lat: number; lng: number } | null }>()
    for (const record of sorted) {
      const employeeCode = String(record.employeeId ?? record.employee_code ?? '').trim()
      if (!employeeCode) continue
      if (byEmployee.has(employeeCode)) continue

      const location = extractLatestLocation(record)
      byEmployee.set(employeeCode, { employeeCode, location })
    }

    return res.status(200).json(Array.from(byEmployee.values()))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('business live-locations failed:', e)
    return res.status(500).json({ error: 'Failed to fetch live locations' })
  }
})

// Debug fallback: if `/api/v1/business/*` is mounted but a specific route isn't,
// this will confirm businessRoutes is live and show the requested path.
router.use((req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    handler: 'businessRoutes',
    mounted: true,
    request: { method: req.method, path: req.path },
    routesHint: 'expected POST /register and GET /stats/:period',
  })
})

export default router
