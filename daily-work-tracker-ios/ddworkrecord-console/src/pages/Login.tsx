import { useState } from 'react'
import { theme } from '../lib/theme'

export default function Login() {
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
      <h1 style={{ margin: 0, color: theme.text, fontWeight: 1150 }}>DD Work Record - Admin Console</h1>

      <p style={{ marginTop: 10, color: theme.muted, fontWeight: 800 }}>
        Admin token required. Paste a Firebase ID token (JWT).
      </p>

      <div style={{ marginTop: 14, padding: 14, borderRadius: theme.radiusMd, border: `2px solid ${theme.borderSoft}`, background: theme.surface }}>
        <div style={{ fontWeight: 1100 }}>Business portal (recommended)</div>
        <div style={{ marginTop: 8, color: theme.muted, fontSize: 13.2, fontWeight: 800, lineHeight: 1.45 }}>
          Businesses register once to get a unique code, then use that code to access their own dashboard.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <a
            href="#business-register"
            style={{
              padding: '10px 14px',
              border: `2px solid ${theme.accentDark}`,
              background: theme.accent,
              color: '#fff',
              borderRadius: theme.radiusSm,
              fontWeight: 1100,
              textDecoration: 'none',
              boxShadow: `3px 3px 0 ${theme.accentDark}`,
              whiteSpace: 'nowrap',
            }}
          >
            Register business
          </a>

          <a
            href="#business-login"
            style={{
              padding: '10px 14px',
              border: `2px solid ${theme.borderStrong}`,
              background: theme.surface,
              color: theme.text,
              borderRadius: theme.radiusSm,
              fontWeight: 1000,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            I have a code
          </a>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, borderRadius: theme.radiusMd, border: `2px solid ${theme.borderSoft}`, background: theme.surface }}>
        <div style={{ fontWeight: 1000 }}>How to get the token</div>
        <ol style={{ margin: '8px 0 0 18px', padding: 0, color: theme.muted, fontSize: 13, lineHeight: 1.5, fontWeight: 800 }}>
          <li>
            Open the token generator: <a href="#/token-viewer" style={{ fontWeight: 1000, color: theme.accentDark, textDecoration: 'underline' }}>#/token-viewer</a>
          </li>
          <li>Paste Firebase config, sign in as admin, click <b>Generate token</b></li>
          <li>Copy the ID token and paste it below</li>
        </ol>
      </div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, background: theme.errorBg, borderLeft: `4px solid ${theme.error}`, fontWeight: 900, borderRadius: theme.radiusSm, color: theme.errorDark }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 1000, marginBottom: 8, color: theme.text }}>Admin Bearer Token</label>
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
            localStorage.removeItem('ddworkrecord_admin_token')
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

      <div style={{ marginTop: 10, color: theme.muted2, fontSize: 12.5, fontWeight: 800 }}>
        Tip: Token must be a Firebase ID token (JWT). Backend verifies it and requires admin role.
      </div>
    </div>
  )
}
