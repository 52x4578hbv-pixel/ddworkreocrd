import { useState } from 'react'
import type { Period } from '../lib/api'
import { fetchBusinessStats, loginBusinessAuth } from '../lib/businessApi'
import { theme } from '../lib/theme'

type AuthStatus = 'idle' | 'loading' | 'error' | 'success'

export default function BusinessLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AuthStatus>('idle')

  const [period] = useState<Period>('month')
  const [hasData, setHasData] = useState<boolean | null>(null)

  const canLogin = email.trim().length > 0 && password.length > 0

  const submit = async () => {
    setError(null)
    setHasData(null)
    setStatus('loading')

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setStatus('error')
      setError('Email is required.')
      return
    }
    if (!password) {
      setStatus('error')
      setError('Password is required.')
      return
    }

    setBusy(true)
    try {
      const res = await loginBusinessAuth({ email: trimmedEmail, password })

      localStorage.setItem('ddworkrecord_business_code', res.businessCode)
      if (res.businessCountry) {
        localStorage.setItem('ddworkrecord_business_country', res.businessCountry)
      }

      await fetchBusinessStats(period)
      setHasData(true)
      setStatus('success')
      window.location.hash = '#dashboard'
    } catch {
      setHasData(false)
      setStatus('error')
      setError('Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui',
        padding: 24,
        maxWidth: 820,
        margin: '0 auto',
        background: theme.pageBg,
        minHeight: '100vh',
      }}
    >
      <h1 style={{ margin: 0, color: theme.text, fontWeight: 1150 }}>Business Login</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850 }}>
        Sign in to your business dashboard using your email + password.
      </p>

      <div
        style={{
          marginTop: 18,
          border: `2px solid ${theme.borderSoft}`,
          borderRadius: theme.radiusMd,
          background: theme.surface,
          padding: 16,
        }}
      >
        {error ? (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: theme.errorBg,
              borderLeft: `4px solid ${theme.error}`,
              fontWeight: 950,
              borderRadius: theme.radiusSm,
              color: theme.text,
            }}
          >
            {error}
          </div>
        ) : null}

        <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          type="email"
          autoComplete="email"
          style={{
            width: '100%',
            padding: 12,
            borderRadius: theme.radiusSm,
            border: `2px solid ${theme.text}`,
            fontWeight: 950,
            outline: 'none',
            background: theme.surface,
          }}
        />

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: 12,
              borderRadius: theme.radiusSm,
              border: `2px solid ${theme.text}`,
              fontWeight: 950,
              outline: 'none',
              background: theme.surface,
            }}
          />
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void submit()}
            disabled={busy || !canLogin}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.text,
              color: '#fff',
              cursor: busy || !canLogin ? 'not-allowed' : 'pointer',
              fontWeight: 1050,
              borderRadius: theme.radiusSm,
              whiteSpace: 'nowrap',
              boxShadow: `3px 3px 0 ${theme.text}`,
            }}
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>

          <a href="#business-register" style={{ fontWeight: 1050, color: theme.text, textDecoration: 'underline' }}>
            Register instead
          </a>

          {hasData === true ? <div style={{ color: theme.success, fontWeight: 1000 }}>Login ✓</div> : null}
          {hasData === false ? <div style={{ color: theme.error, fontWeight: 1000 }}>Not valid</div> : null}
        </div>
      </div>

      <div style={{ marginTop: 14, color: theme.muted2, fontSize: 12.3, fontWeight: 850 }}>
        After login, the backend will mint your business access code for the rest of the portal.
      </div>
    </div>
  )
}
