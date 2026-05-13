import { useState } from 'react'

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
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 760 }}>
      <h1 style={{ margin: 0 }}>DD Work Record - Admin Console</h1>

      <p style={{ marginTop: 10, color: '#475569', fontWeight: 650 }}>
        Admin token required. Paste a Firebase ID token (JWT).
      </p>

      <div style={{ marginTop: 10, padding: 12, border: '2px solid #0f172a', background: '#fff' }}>
        <div style={{ fontWeight: 900 }}>How to get the token</div>
        <ol style={{ margin: '8px 0 0 18px', padding: 0, color: '#334155', fontSize: 13, lineHeight: 1.5 }}>
          <li>Open the token generator: <a href="#/token-viewer" style={{ fontWeight: 900 }}>#/token-viewer</a></li>
          <li>Paste Firebase config, sign in as admin, click <b>Generate token</b></li>
          <li>Copy the ID token and paste it below</li>
        </ol>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 800 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'block', fontWeight: 900, marginBottom: 8 }}>
          Admin Bearer Token
        </label>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          rows={8}
          style={{ width: '100%', padding: 10, fontSize: 12 }}
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
            fontWeight: 900,
            border: '2px solid #0f172a',
            background: '#fff',
            cursor: 'pointer',
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
            fontWeight: 900,
            border: '2px solid #94a3b8',
            background: '#fff',
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ marginTop: 10, color: '#64748b', fontSize: 12, fontWeight: 650 }}>
        Tip: Token must be a Firebase ID token (JWT). Backend verifies it and requires role/admin.
      </div>
    </div>
  )
}
