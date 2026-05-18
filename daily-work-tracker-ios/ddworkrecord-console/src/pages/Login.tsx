import { useEffect, useMemo, useState } from 'react'
import { signInWithPopup, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getOrInitFirebase, type FirebaseConfig } from '../lib/firebase'
import { exchangeAdminSession, exchangeAdminEmailSession, fetchFirebaseClientConfig } from '../lib/consoleAuth'
import { theme } from '../lib/theme'

type AuthStatus = 'idle' | 'loading' | 'error' | 'success'

function safeSetLocalToken(token: string) {
  try {
    localStorage.setItem('ddworkrecord_admin_token', token)
  } catch {
    // ignore
  }
}

export default function Login() {
  const [fbConfig, setFbConfig] = useState<FirebaseConfig | null>(null)
  const [configStatus, setConfigStatus] = useState<AuthStatus>('idle')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const canEmailLogin = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setConfigStatus('loading')
      setError(null)

      try {
        const cfg = await fetchFirebaseClientConfig()
        if (cancelled) return
        setFbConfig(cfg as unknown as FirebaseConfig)
        setConfigStatus('success')
      } catch (e) {
        if (cancelled) return
        setConfigStatus('error')
        setError(e instanceof Error ? e.message : 'Failed to load Firebase config')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const ensureFirebase = async (): Promise<Auth> => {
    if (!fbConfig) throw new Error('Firebase config not loaded yet')
    const auth = getOrInitFirebase(fbConfig)
    if (!auth) throw new Error('Firebase Auth failed to initialize')
    return auth as Auth
  }

  const redirectToDashboard = () => {
    window.location.hash = '#dashboard'
  }

  const finishIdTokenLogin = async (idToken: string) => {
    setStatus('loading')
    setError(null)

    const session = await exchangeAdminSession(idToken)
    safeSetLocalToken(session.token)

    setStatus('success')
    redirectToDashboard()
  }

  const onGoogleLogin = async () => {
    try {
      setStatus('loading')
      setError(null)

      const auth = await ensureFirebase()
      const provider = new GoogleAuthProvider()

      const result = await signInWithPopup(auth, provider)
      const user = result.user
      const idToken = await user.getIdToken()

      await finishIdTokenLogin(idToken)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
    }
  }

  const onEmailLogin = async () => {
    try {
      setStatus('loading')
      setError(null)

      const session = await exchangeAdminEmailSession(email.trim(), password)
      safeSetLocalToken(session.token)

      setStatus('success')
      redirectToDashboard()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Email login failed')
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 760, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text, fontWeight: 1150 }}>DD Work Record - Admin Login</h1>

      <p style={{ marginTop: 10, color: theme.muted, fontWeight: 800 }}>
        Sign in with Google or email/password. Backend verifies the session and returns your admin token.
      </p>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: theme.radiusMd,
          border: `2px solid ${theme.borderSoft}`,
          background: theme.surface,
        }}
      >
        <div style={{ fontWeight: 1100, color: theme.text }}>Google sign-in</div>
        <div style={{ marginTop: 8, color: theme.muted, fontSize: 13.2, fontWeight: 800, lineHeight: 1.45 }}>
          One-click sign in. If your Firebase user has the required admin role, you’ll be authorized.
        </div>

        <button
          onClick={onGoogleLogin}
          disabled={configStatus !== 'success' || status === 'loading'}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px 14px',
            fontWeight: 1000,
            border: `2px solid ${theme.accentDark}`,
            background: theme.accent,
            color: '#fff',
            cursor: configStatus === 'success' && status !== 'loading' ? 'pointer' : 'not-allowed',
            borderRadius: theme.radiusSm,
            boxShadow: `3px 3px 0 ${theme.accentDark}`,
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: theme.radiusMd,
          border: `2px solid ${theme.borderSoft}`,
          background: theme.surface,
        }}
      >
        <div style={{ fontWeight: 1100, color: theme.text }}>Email login</div>

        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontWeight: 1000, marginBottom: 8, color: theme.text }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            style={{
              width: '100%',
              padding: 10,
              fontSize: 12,
              borderRadius: theme.radiusSm,
              border: `2px solid ${theme.borderStrong}`,
              background: theme.surface,
              outline: 'none',
              fontWeight: 850,
              color: theme.text,
            }}
            placeholder="admin@yourcompany.com"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontWeight: 1000, marginBottom: 8, color: theme.text }}>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: 10,
              fontSize: 12,
              borderRadius: theme.radiusSm,
              border: `2px solid ${theme.borderStrong}`,
              background: theme.surface,
              outline: 'none',
              fontWeight: 850,
              color: theme.text,
            }}
            placeholder="••••••••"
          />
        </div>

        <button
          onClick={onEmailLogin}
          disabled={status === 'loading' || !canEmailLogin}
          style={{
            marginTop: 12,
            width: '100%',
            padding: '12px 14px',
            fontWeight: 1000,
            border: `2px solid ${theme.accentDark}`,
            background: theme.accent,
            color: '#fff',
            cursor: status !== 'loading' && canEmailLogin ? 'pointer' : 'not-allowed',
            borderRadius: theme.radiusSm,
            boxShadow: `3px 3px 0 ${theme.accentDark}`,
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? 'Signing in...' : 'Sign in'}
        </button>

        <div style={{ marginTop: 10, color: theme.muted2, fontSize: 12.5, fontWeight: 800 }}>
          Tip: your Firebase user must have the required admin role claim.
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: theme.errorBg,
            borderLeft: `4px solid ${theme.error}`,
            fontWeight: 900,
            borderRadius: theme.radiusSm,
            color: theme.errorDark,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14, color: theme.muted2, fontSize: 12.3, fontWeight: 800, lineHeight: 1.5 }}>
        {configStatus === 'loading' ? 'Loading Firebase config...' : null}
      </div>
    </div>
  )
}
