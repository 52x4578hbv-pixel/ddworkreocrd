
export type Period = 'day' | 'week' | 'month'

const DEFAULT_API_BASE_URL = ''

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
  employees?: Array<{
    employeeCode: string
    displayName: string
    totalHours: number
    totalDistanceKm: number
    totalFuelCost: number
    totalSupplierSpend: number
  }>
}

type LiveLocation = { employeeCode: string; location: { lat: number; lng: number } | null }

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem('ddworkrecord_admin_token')
  } catch {
    return null
  }
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken()
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
