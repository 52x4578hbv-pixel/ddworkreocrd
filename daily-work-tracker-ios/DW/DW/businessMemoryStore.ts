import crypto from 'crypto'

export type BusinessTenant = {
  tenantId: string
  businessName: string | null
  contactEmail: string | null
  businessCountry: string | null
  createdAt: string
  updatedAt?: string
}

export type WorkerSecretRecord = {
  tenantId: string
  employeeCode: string
  // For now, secrets only map to workers (mobile app role)
  role: 'worker'
}

const tenantById = new Map<string, BusinessTenant>()
const accessCodeToTenantId = new Map<string, string>()
const tenantIdToAccessCode = new Map<string, string>()

// Firebase business-user uid -> tenant/primary access code mapping (used for email/password login)
const firebaseUidToTenantAndAccess = new Map<string, { tenantId: string; businessCode: string }>()

type BusinessAuthUserRecord = {
  tenantId: string
  businessCode: string
  businessCountry: string | null
  email: string
  passwordHash: string
}

// email -> credentials for in-memory fallback auth (no Firebase env vars)
const businessEmailToAuthUser = new Map<string, BusinessAuthUserRecord>()

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

// Note: this is only an in-memory fallback for dev when Firebase env vars
// are missing. DO NOT use this for production auth.
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

type BusinessAuthUser = {
  tenantId: string
  businessCode: string
  businessCountry: 'ZA' | 'US' | null
  email: string
  passwordHash: string
}

function getBusinessAuthUserByEmail(email: string): BusinessAuthUser | null {
  const key = normalizeEmail(email)
  return (businessEmailToAuthUser.get(key) ?? null) as BusinessAuthUser | null
}

function upsertBusinessAuthUser(params: {
  email: string
  passwordHash: string
  tenantId: string
  businessCode: string
  businessCountry: 'ZA' | 'US' | null
}) {
  const key = normalizeEmail(params.email)
  const user: BusinessAuthUser = {
    tenantId: params.tenantId,
    businessCode: params.businessCode,
    businessCountry: params.businessCountry,
    email: params.email,
    passwordHash: params.passwordHash,
  }

  businessEmailToAuthUser.set(key, user)
}

// worker secret -> tenant/worker mapping
const workerSecretToRecord = new Map<string, WorkerSecretRecord>()
// tenant+employee -> worker secret mapping (fast lookup / backwards compat)
const tenantEmployeeToWorkerSecret = new Map<string, string>()
// tenant -> shared worker secret (all employees in a business can use the same token)
const tenantIdToSharedWorkerSecret = new Map<string, string>()

function generateTenantId() {
  // stable enough for doc-like ids
  return `tenant_${crypto.randomBytes(6).toString('hex')}`
}

function generateAccessCode() {
  // 10-ish chars, uppercase alnum
  const raw = crypto.randomBytes(8).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  return raw.slice(0, 10).toUpperCase()
}

function normalizeEmployeeCode(raw: string) {
  const s = raw.trim().toUpperCase()
  return s
}

function generateWorkerSecret() {
  // long-ish, unguessable bearer secret
  // base64url-ish without symbols for easier copy/paste
  const raw = crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, '')
  return raw.slice(0, 40)
}

function tenantEmployeeKey(tenantId: string, employeeCode: string) {
  return `${tenantId}::${normalizeEmployeeCode(employeeCode)}`
}

export const businessMemoryStore = {
  registerBusiness: (params: {
    businessName: string
    contactEmail?: string | null
    businessCountry?: string | null
  }) => {
    const tenantId = generateTenantId()
    const now = new Date().toISOString()

    const tenant: BusinessTenant = {
      tenantId,
      businessName: params.businessName,
      contactEmail: params.contactEmail ?? null,
      businessCountry: params.businessCountry ?? null,
      createdAt: now,
      updatedAt: now,
    }

    tenantById.set(tenantId, tenant)

    // mint an access code
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = generateAccessCode()
      if (accessCodeToTenantId.has(code)) continue

      accessCodeToTenantId.set(code, tenantId)
      tenantIdToAccessCode.set(tenantId, code)

      return { businessCode: code, tenantId }
    }

    throw new Error('Failed to generate access code (memory store).')
  },

  getTenantIdByAccessCode: (accessCode: string) => {
    return accessCodeToTenantId.get(accessCode) ?? null
  },

  getBusinessCodeByTenantId: (tenantId: string) => {
    return tenantIdToAccessCode.get(tenantId) ?? null
  },

  getTenantById: (tenantId: string) => {
    return tenantById.get(tenantId) ?? null
  },

  setFirebaseUidBusinessMapping: (firebaseUid: string, tenantId: string, businessCode: string) => {
    if (!firebaseUid) return
    firebaseUidToTenantAndAccess.set(firebaseUid, { tenantId, businessCode })
  },

  registerBusinessAuthUser: (params: {
    email: string
    password: string
    tenantId: string
    businessCode: string
    businessCountry: 'ZA' | 'US' | null
  }) => {
    if (!params.email) return
    upsertBusinessAuthUser({
      email: params.email,
      passwordHash: hashPassword(params.password),
      tenantId: params.tenantId,
      businessCode: params.businessCode,
      businessCountry: params.businessCountry,
    })
  },

  getBusinessAuthUserByCredentials: (params: { email: string; password: string }) => {
    const user = getBusinessAuthUserByEmail(params.email)
    if (!user) return null
    const ok = user.passwordHash === hashPassword(params.password)
    if (!ok) return null
    return {
      tenantId: user.tenantId,
      businessCode: user.businessCode,
      businessCountry: user.businessCountry,
    }
  },

  getTenantAndAccessByFirebaseUid: (
    firebaseUid: string
  ): { tenantId: string; businessCode: string } | null => {
    if (!firebaseUid) return null
    return firebaseUidToTenantAndAccess.get(firebaseUid) ?? null
  },

  mintWorkerSecrets: (tenantId: string, employeeCodes: string[]) => {
    const results: { employeeCode: string; workerSecret: string }[] = []

    const normalizedCodes = employeeCodes.map(normalizeEmployeeCode).filter((c) => c.length > 0)
    if (normalizedCodes.length === 0) return results

    // Create (or reuse) a single shared worker secret per tenant.
    // Important: the worker-secret auth enforcement in syncRoutes.ts checks
    // `authEmployeeCode && authEmployeeCode !== validatedData.employeeId`.
    // By storing `employeeCode: ''` for the shared token, authEmployeeCode becomes falsy
    // and the server will accept records for any employeeId.
    let sharedSecret = tenantIdToSharedWorkerSecret.get(tenantId) ?? null

    if (!sharedSecret) {
      // If all provided employee codes already map to the same secret, reuse it.
      let candidate: string | null = null
      let mismatch = false

      for (const employeeCode of normalizedCodes) {
        const key = tenantEmployeeKey(tenantId, employeeCode)
        const existing = tenantEmployeeToWorkerSecret.get(key)
        if (!existing) continue
        if (candidate === null) candidate = existing
        else if (existing !== candidate) mismatch = true
      }

      if (candidate && !mismatch) {
        sharedSecret = candidate
      } else {
        // Generate a new unique secret (avoid collisions)
        let secret = generateWorkerSecret()
        while (workerSecretToRecord.has(secret)) {
          secret = generateWorkerSecret()
        }
        sharedSecret = secret
      }

      tenantIdToSharedWorkerSecret.set(tenantId, sharedSecret)
      workerSecretToRecord.set(sharedSecret, { tenantId, employeeCode: '', role: 'worker' })
    }

    // Map every employee code to the shared secret
    for (const employeeCode of normalizedCodes) {
      const key = tenantEmployeeKey(tenantId, employeeCode)
      tenantEmployeeToWorkerSecret.set(key, sharedSecret)
      results.push({ employeeCode, workerSecret: sharedSecret })
    }

    return results
  },

  getWorkerSecretRecord: (workerSecret: string): WorkerSecretRecord | null => {
    return workerSecretToRecord.get(workerSecret) ?? null
  },

  reset: () => {
    tenantById.clear()
    accessCodeToTenantId.clear()
    tenantIdToAccessCode.clear()
    firebaseUidToTenantAndAccess.clear()

    businessEmailToAuthUser.clear()

    workerSecretToRecord.clear()
    tenantEmployeeToWorkerSecret.clear()
    tenantIdToSharedWorkerSecret.clear()
  },
}
