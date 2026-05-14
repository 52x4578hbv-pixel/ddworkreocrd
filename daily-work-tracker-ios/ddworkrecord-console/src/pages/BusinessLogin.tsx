import { useState } from 'react'
import type { Period } from '../lib/api'
import { fetchBusinessStats } from '../lib/businessApi'
import { theme } from '../lib/theme'

export default function BusinessLogin() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [period] = useState<Period>('month')
  const [hasData, setHasData] = useState<boolean | null>(null)

  const submit = async () => {
    setError(null)
    setHasData(null)

    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setError('Business code is required.')
      return
    }

    setBusy(true)
    try {
      localStorage.setItem('ddworkrecord_business_code', trimmed)
      // quick smoke test: verify auth works + business has access
      await fetchBusinessStats(period)
      setHasData(true)
      window.location.hash = '#business-dashboard'
    } catch {
      setHasData(false)
      setError('Code not valid.')
      localStorage.removeItem('ddworkrecord_business_code')
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
        Enter your unique business code to access your business dashboard.
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

        <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Business code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. ABC123DEF4"
          style={{
            width: '100%',
            padding: 12,
            borderRadius: theme.radiusSm,
            border: `2px solid ${theme.text}`,
            fontWeight: 950,
            outline: 'none',
          }}
          autoCapitalize="characters"
        />

        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void submit()}
            disabled={busy}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.text,
              color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 1050,
              borderRadius: theme.radiusSm,
              whiteSpace: 'nowrap',
              boxShadow: `3px 3px 0 ${theme.text}`,
            }}
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>

          <a href="#business-register" style={{ fontWeight: 1050, color: theme.text, textDecoration: 'underline' }}>
            Register for code
          </a>

          {hasData === true ? <div style={{ color: theme.success, fontWeight: 1000 }}>Code accepted ✓</div> : null}
          {hasData === false ? <div style={{ color: theme.error, fontWeight: 1000 }}>Code not valid</div> : null}
        </div>
      </div>
    </div>
  )
}
