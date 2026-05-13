import { isLocalPreviewMode } from './localPreview'

export type Period = 'day' | 'week' | 'month'

const DEFAULT_API_BASE_URL = 'https://daily-work-tracker-api.azurewebsites.net'

export const API_BASE_URL = (() => {
  const v = (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL
  const trimmed = (v ?? '').trim()
  return trimmed.length ? trimmed : DEFAULT_API_BASE_URL
})()

type StatsResponse = {
  period: Period
  grandTotals?: {
    totalHours: number
    totalDistanceKm: number
    fuelCost: number
    supplierSpend: number
  }
}

type LiveLocation = { employeeCode: string; location: { lat: number; lng: number } | null }

// Keep these values deterministic so you can iterate on UI with stable fake data.
function mockStats(period: Period): StatsResponse {
  if (period === 'day') {
    return {
      period,
      grandTotals: { totalHours: 8.5, totalDistanceKm: 110, fuelCost: 47, supplierSpend: 65 },
    }
  }
  if (period === 'month') {
    return {
      period,
      grandTotals: { totalHours: 172.25, totalDistanceKm: 2150, fuelCost: 930, supplierSpend: 1200 },
    }
  }
  return {
    period,
    grandTotals: { totalHours: 44.75, totalDistanceKm: 585, fuelCost: 265, supplierSpend: 330 },
  }
}

function mockLiveLocations(): LiveLocation[] {
  return [
    { employeeCode: 'EMP-001', location: { lat: 18.5, lng: -63.4 } },
    { employeeCode: 'EMP-002', location: { lat: 18.515, lng: -63.42 } },
    { employeeCode: 'EMP-003', location: { lat: 18.49, lng: -63.39 } },
  ]
}

function getToken(): string | null {
  return localStorage.getItem('ddworkrecord_admin_token')
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken()
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

export async function fetchStats(period: Period) {
  if (isLocalPreviewMode()) return mockStats(period)

  const res = await authedFetch(`/api/v1/console/stats/${period}`)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(`stats failed: ${res.status}${snippet ? ` - ${snippet}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(`stats failed: expected JSON but got ${contentType || 'unknown'}${snippet ? ` - ${snippet}` : ''}`)
  }

  return (await res.json()) as StatsResponse
}

export async function fetchLiveLocations() {
  if (isLocalPreviewMode()) return mockLiveLocations()

  const res = await authedFetch(`/api/v1/admin/live-locations`)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(`live-locations failed: ${res.status}${snippet ? ` - ${snippet}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(
      `live-locations failed: expected JSON but got ${contentType || 'unknown'}${snippet ? ` - ${snippet}` : ''}`
    )
  }

  return (await res.json()) as LiveLocation[]
}

export async function assignEmployee(employeeCode: string, displayName: string, vehicleId?: string | null) {
  if (isLocalPreviewMode()) {
    return { employee_code: employeeCode, display_name: displayName, vehicle_assigned: vehicleId ?? null }
  }

  const res = await authedFetch(`/api/v1/admin/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeCode, displayName, vehicleId: vehicleId ?? null }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(`assign employee failed: ${res.status}${snippet ? ` - ${snippet}` : ''}`)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    const body = await res.text().catch(() => '')
    const snippet = body?.trim().slice(0, 200)
    throw new Error(
      `assign employee failed: expected JSON but got ${contentType || 'unknown'}${snippet ? ` - ${snippet}` : ''}`
    )
  }

  return (await res.json()) as Promise<any>
}
