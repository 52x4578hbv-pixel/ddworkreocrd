import { useState } from 'react'
import { registerBusinessAuth } from '../lib/businessApi'
import { theme } from '../lib/theme'

type BusinessCountry = 'ZA' | 'US'

type AuthStatus = 'idle' | 'loading' | 'error' | 'success'

export default function BusinessRegister() {
  const [businessName, setBusinessName] = useState('')
  const [businessCountry, setBusinessCountry] = useState<BusinessCountry>('ZA')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AuthStatus>('idle')

  const [businessCode, setBusinessCode] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setBusinessCode(null)
    setStatus('loading')

    const name = businessName.trim()
    const trimmedEmail = email.trim()

    if (!name) {
      setStatus('error')
      setError('Business name is required.')
      return
    }
    if (!trimmedEmail) {
      setStatus('error')
      setError('Email is required.')
      return
    }
    if (!trimmedEmail.includes('@')) {
      setStatus('error')
      setError('Email looks invalid.')
      return
    }
    if (!password) {
      setStatus('error')
      setError('Password is required.')
      return
    }

    setBusy(true)
    try {
      const res = await registerBusinessAuth({
        businessName: name,
        businessCountry,
        email: trimmedEmail,
        password,
      })

      setBusinessCode(res.businessCode)
      localStorage.setItem('ddworkrecord_business_code', res.businessCode)
      if (res.businessCountry) localStorage.setItem('ddworkrecord_business_country', res.businessCountry)
      setStatus('success')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to register business.'
      setError(message)
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 860, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text, fontWeight: 1150 }}>Business Signup</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850 }}>
        Your business is created by the backend. You’ll get a business access code for the portal.
      </p>

      <div style={{ marginTop: 18, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface, padding: 16 }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 8, color: theme.text }}>Business name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Supreme Parts"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 900,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 8, color: theme.text }}>Business country</label>
            <select
              aria-label="Business country"
              title="Business country"
              value={businessCountry}
              onChange={(e) => setBusinessCountry((e.target.value === 'US' ? 'US' : 'ZA') as BusinessCountry)}
              style={{
                width: '100%',
                height: 42,
                padding: '0 10px',
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            >
              <option value="ZA">South Africa</option>
              <option value="US">USA</option>
            </select>
            <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
              Used for public-holiday hour classification.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 8, color: theme.text }}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@company.com"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 900,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 8, color: theme.text }}>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 900,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void submit()}
            disabled={busy}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.accentDark}`,
              background: theme.accent,
              color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 1100,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.accentDark}`,
              whiteSpace: 'nowrap',
            }}
          >
            {busy ? 'Creating…' : 'Create & get access code'}
          </button>

          <a href="#business-login" style={{ fontWeight: 1050, color: theme.text, textDecoration: 'underline' }}>
            I already have an account
          </a>
        </div>

        {businessCode ? (
          <div style={{ marginTop: 16, padding: 12, border: `2px dashed ${theme.borderStrong}`, borderRadius: theme.radiusSm, background: theme.accentPillBg }}>
            <div style={{ fontWeight: 1100, marginBottom: 6, color: theme.text }}>Welcome — your code is ready</div>
            <div style={{ fontWeight: 1100, fontSize: 18, color: theme.text }}>{businessCode}</div>

            <div style={{ marginTop: 10, color: theme.muted2, fontWeight: 850, fontSize: 12.5, lineHeight: 1.5 }}>
              Use your account email/password at login. The backend will mint the same business access code for the portal.
            </div>

            <button
              onClick={() => {
                window.location.hash = '#dashboard'
              }}
              style={{
                marginTop: 12,
                padding: '12px 16px',
                border: `2px solid ${theme.accentDark}`,
                background: theme.accent,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 1100,
                borderRadius: theme.radiusSm,
                boxShadow: `3px 3px 0 ${theme.accentDark}`,
                whiteSpace: 'nowrap',
                width: '100%',
              }}
            >
              Get Started (console settings)
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
