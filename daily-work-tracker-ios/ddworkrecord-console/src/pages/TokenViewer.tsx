import { useState } from 'react'
import { theme } from '../lib/theme'

export default function TokenViewer() {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    const trimmed = token.trim()

    if (!trimmed) {
      setError('Admin token is required.')
      return
    }

    // JWTs typically start with "eyJ..." (base64 for {"alg":...})
    if (!/^eyJ/.test(trimmed) && trimmed.length < 30) {
      setError('Token looks too short. Paste the full Firebase ID token (JWT).')
      return
    }

    localStorage.setItem('ddworkrecord_admin_token', trimmed)
    window.location.hash = '#dashboard'
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 760, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text, fontWeight: 1150 }}>DD Work Record - Token Viewer</h1>

      <p style={{ marginTop: 10, color: theme.muted, fontWeight: 800 }}>
        Paste your admin JWT (Firebase ID token). This page no longer asks for password sign-in.
      </p>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontWeight: 1000, marginBottom: 8, color: theme.text }}>Admin Bearer Token (JWT)</label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={8}
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
          placeholder="eyJhbGciOi... (paste full token)"
          spellCheck={false}
          autoCapitalize="none"
        />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button
          onClick={submit}
          style={{
            padding: '10px 14px',
            fontWeight: 1000,
            border: `2px solid ${theme.accentDark}`,
            background: theme.accent,
            color: '#fff',
            cursor: 'pointer',
            borderRadius: theme.radiusSm,
            boxShadow: `3px 3px 0 ${theme.accentDark}`,
            whiteSpace: 'nowrap',
          }}
        >
          Continue
        </button>

        <button
          onClick={() => {
            setToken('')
            setError(null)
          }}
          style={{
            padding: '10px 14px',
            fontWeight: 1000,
            border: `2px solid ${theme.borderStrong}`,
            background: theme.surface,
            cursor: 'pointer',
            color: theme.text,
            borderRadius: theme.radiusSm,
            whiteSpace: 'nowrap',
          }}
        >
          Clear
        </button>
      </div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, background: theme.errorBg, borderLeft: `4px solid ${theme.error}`, fontWeight: 900, borderRadius: theme.radiusSm, color: theme.errorDark }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 10, color: theme.muted2, fontSize: 12.5, fontWeight: 800 }}>
        Tip: backend verifies this token and requires admin role.
      </div>
    </div>
  )
}
