import type { Period } from './api'

const DEFAULT_API_BASE_URL = ''

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

type BusinessAuthResponse = {
  businessCode: string
  tenantId?: string
  businessCountry?: 'ZA' | 'US' | null
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

export function getBusinessCode(): string | null {
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

export async function registerBusinessAuth(input: {
  businessName: string
  businessCountry: 'ZA' | 'US'
  email: string
  password: string
}) {
  const res = await fetch(`${API_BASE_URL}/api/v1/business/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`business auth register failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as BusinessAuthResponse
}

export async function loginBusinessAuth(input: { email: string; password: string }) {
  const res = await fetch(`${API_BASE_URL}/api/v1/business/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`business auth login failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as BusinessAuthResponse
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

export type LiveLocation = {
  employeeCode: string
  location: { lat: number; lng: number } | null
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

type BusinessWorkday = {
  id: string
  employeeId: string
  date: string
  workshops?: unknown[]
  travels?: unknown[]
  jobs?: unknown[]
  suppliers?: unknown[]
  fuels?: unknown[]
  privateSegments?: unknown[]
  endNotes?: string | null
}

export async function fetchBusinessLiveLocations(): Promise<LiveLocation[]> {
  const res = await authedFetch('/api/v1/business/live-locations', { method: 'GET' })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`live-locations failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `live-locations failed: expected JSON but got ${contentType || 'unknown'}${body ? ` - ${body.slice(0, 200)}` : ''}`
    )
  }

  return (await res.json()) as LiveLocation[]
}

export type PeriodRange = {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD (inclusive-ish: backend treats as end date + 1 day)
}

export async function fetchBusinessWorkdays(input: {
  range: PeriodRange
  employeeCode?: string | null
}): Promise<BusinessWorkday[]> {
  const params = new URLSearchParams()
  params.set('startDate', input.range.startDate)
  params.set('endDate', input.range.endDate)
  if (input.employeeCode) params.set('employeeCode', input.employeeCode)

  const res = await authedFetch(`/api/v1/business/workdays?${params.toString()}`, { method: 'GET' })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`workdays failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    throw new Error(`workdays failed: expected JSON but got ${contentType || 'unknown'}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const data = (await res.json()) as { workdays: BusinessWorkday[] }
  return data.workdays
}
