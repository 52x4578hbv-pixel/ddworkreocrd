import { API_BASE_URL, type Period } from './api'

export type FirebaseClientConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

export type AdminSessionResponse = {
  token: string
  tenantId: string
  role: string
}

export async function fetchFirebaseClientConfig(): Promise<FirebaseClientConfig> {
  const res = await fetch(`${API_BASE_URL}/api/v1/console/firebase-config`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to fetch firebase config: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  const data = (await res.json()) as unknown

  // New shape: { available: boolean, config: FirebaseClientConfig | null }
  if (data && typeof data === 'object' && 'available' in data) {
    const d = data as { available?: unknown; config?: unknown }
    if (d.available === false || !d.config) {
      throw new Error('Firebase is not configured (Google sign-in disabled).')
    }
    return d.config as FirebaseClientConfig
  }

  // Backward compatible shape: raw FirebaseClientConfig
  return data as FirebaseClientConfig
}

export async function exchangeAdminSession(idToken: string): Promise<AdminSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/console/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Auth session exchange failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as AdminSessionResponse
}

export async function exchangeAdminEmailSession(email: string, password: string): Promise<AdminSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/console/auth/session/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Auth email session exchange failed: ${res.status}${body ? ` - ${body.slice(0, 200)}` : ''}`)
  }

  return (await res.json()) as AdminSessionResponse
}
