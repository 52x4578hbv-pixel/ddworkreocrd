import { initializeApp, getApps } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { useMemo } from 'react'

export type FirebaseConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

let authInstance: Auth | null = null

export function getOrInitFirebase(config: FirebaseConfig) {
  if (!getApps().length) {
    initializeApp(config)
  }
  if (!authInstance) {
    authInstance = getAuth()
  }
  return authInstance
}

export function getAuthInstance() {
  return authInstance
}
