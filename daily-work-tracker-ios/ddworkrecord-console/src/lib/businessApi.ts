import type { Period } from './api'

const DEFAULT_API_BASE_URL = 'https://ddworkapi-1778615679.azurewebsites.net'

const API_BASE_URL = (() => {
  // optional env override; keep consistent behavior with admin api helper
  const v = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL
  const trimmed = (v ?? '').trim()
  return trimmed.length ? trimmed : DEFAULT_API_BASE_URL
})()

type RegisterResponse = {
  businessCode: string
  tenantId?: string
}

type BusinessStatsResponse = {
  period: Period
  grandTotals?: {
    totalHours: number
    totalDistanceKm: number
    fuelCost: number
    supplierSpend: number
  }
  employees?: unknown[]
}

function getBusinessCode(): string | null {
  return localStorage.getItem('ddworkrecord_business_code')
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getBusinessCode()
  const headers = new Headers(init.headers)

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const base = API_BASE_URL?.trim()
  const url = base ? `${base}${path}` : path

  return fetch(url, {
    ...init,
    headers,
  })
}

export async function registerBusiness(input: {
  businessName: string
  contactEmail?: string
  businessCountry?: string
}) {
  const res = await fetch(`${API_BASE_URL}/api/v1/business/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`register failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as RegisterResponse
}

export async function fetchBusinessStats(period: Period) {
  const res = await authedFetch(`/api/v1/business/stats/${period}`, { method: 'GET' })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`stats failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    throw new Error(`stats failed: expected JSON but got ${contentType || 'unknown'}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as BusinessStatsResponse
}

type MintWorkerSecretsResponse = {
  secrets: {
    employeeCode: string
    workerSecret: string
  }[]
}

export async function mintWorkerSecrets(employeeCodes: string[]) {
  const res = await authedFetch('/api/v1/business/mint-worker-secrets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCodes }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`mint-worker-secrets failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    throw new Error(`mint-worker-secrets failed: expected JSON but got ${contentType || 'unknown'}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as MintWorkerSecretsResponse
}
