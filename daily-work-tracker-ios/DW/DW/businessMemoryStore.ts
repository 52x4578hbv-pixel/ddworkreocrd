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

const workerSecretToRecord = new Map<string, WorkerSecretRecord>()
const tenantEmployeeToWorkerSecret = new Map<string, string>()

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
      return { businessCode: code, tenantId }
    }

    throw new Error('Failed to generate access code (memory store).')
  },

  getTenantIdByAccessCode: (accessCode: string) => {
    return accessCodeToTenantId.get(accessCode) ?? null
  },

  getTenantById: (tenantId: string) => {
    return tenantById.get(tenantId) ?? null
  },

  mintWorkerSecrets: (tenantId: string, employeeCodes: string[]) => {
    const results: { employeeCode: string; workerSecret: string }[] = []

    for (const rawCode of employeeCodes) {
      const employeeCode = normalizeEmployeeCode(rawCode)
      if (!employeeCode) continue

      const key = tenantEmployeeKey(tenantId, employeeCode)
      const existing = tenantEmployeeToWorkerSecret.get(key)
      if (existing) {
        results.push({ employeeCode, workerSecret: existing })
        continue
      }

      // generate a new secret (avoid collisions)
      let secret = generateWorkerSecret()
      while (workerSecretToRecord.has(secret)) {
        secret = generateWorkerSecret()
      }

      tenantEmployeeToWorkerSecret.set(key, secret)
      workerSecretToRecord.set(secret, { tenantId, employeeCode, role: 'worker' })
      results.push({ employeeCode, workerSecret: secret })
    }

    return results
  },

  getWorkerSecretRecord: (workerSecret: string): WorkerSecretRecord | null => {
    return workerSecretToRecord.get(workerSecret) ?? null
  },

  reset: () => {
    tenantById.clear()
    accessCodeToTenantId.clear()
    workerSecretToRecord.clear()
    tenantEmployeeToWorkerSecret.clear()
  },
}
