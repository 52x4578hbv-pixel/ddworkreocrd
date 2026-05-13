import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { getAuthInstance, getOrInitFirebase, type FirebaseConfig } from '../lib/firebase'

export default function TokenViewer() {
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setError(null)
    setToken(null)

    const cfg = {
      apiKey: firebaseConfig.apiKey.trim(),
      authDomain: firebaseConfig.authDomain.trim(),
      projectId: firebaseConfig.projectId.trim(),
      appId: firebaseConfig.appId.trim(),
      storageBucket: firebaseConfig.storageBucket?.trim() || undefined,
      messagingSenderId: firebaseConfig.messagingSenderId?.trim() || undefined,
    } satisfies FirebaseConfig

    if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
      setError('Missing Firebase config fields (apiKey/authDomain/projectId/appId).')
      return
    }
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    try {
      getOrInitFirebase(cfg)
      const auth = getAuthInstance()
      if (!auth) throw new Error('Firebase auth not initialized')

      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      const idToken = await cred.user.getIdToken()
      setToken(idToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const updateCfg = (key: keyof FirebaseConfig, value: string) => {
    setFirebaseConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 1100 }}>
      <h1 style={{ margin: 0 }}>Dev: Firebase ID Token Viewer</h1>
      <p style={{ marginTop: 8, color: '#475569' }}>
        Enter Firebase config + sign in as your admin user to generate an ID token.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444' }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: 18, border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Firebase Config</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
          <div>
            <label htmlFor="fb-apiKey" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>apiKey</label>
            <input id="fb-apiKey" value={firebaseConfig.apiKey} onChange={(e) => updateCfg('apiKey', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="fb-authDomain" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>authDomain</label>
            <input id="fb-authDomain" value={firebaseConfig.authDomain} onChange={(e) => updateCfg('authDomain', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="fb-projectId" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>projectId</label>
            <input id="fb-projectId" value={firebaseConfig.projectId} onChange={(e) => updateCfg('projectId', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="fb-appId" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>appId</label>
            <input id="fb-appId" value={firebaseConfig.appId} onChange={(e) => updateCfg('appId', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="fb-storageBucket" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>storageBucket (optional)</label>
            <input id="fb-storageBucket" value={firebaseConfig.storageBucket || ''} onChange={(e) => updateCfg('storageBucket', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="fb-messagingSenderId" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>messagingSenderId (optional)</label>
            <input id="fb-messagingSenderId" value={firebaseConfig.messagingSenderId || ''} onChange={(e) => updateCfg('messagingSenderId', e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Sign in</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
          <div>
            <label htmlFor="admin-email" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Admin email</label>
            <input id="admin-email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
          <div>
            <label htmlFor="admin-password" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Password</label>
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 10 }} />
          </div>
        </div>

        <button
          title="Generate Firebase ID token"
          onClick={run}
          disabled={loading}
          style={{
            marginTop: 14,
            padding: '10px 14px',
            border: '2px solid #0f172a',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {loading ? 'Generating…' : 'Generate token'}
        </button>
      </div>

      {token && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>ID token (copy)</div>
          <textarea
            title="Firebase ID token"
            readOnly
            value={token}
            rows={8}
            placeholder="(token will appear here)"
            style={{ width: '100%', padding: 10, fontSize: 12 }}
          />
          <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>
            Paste this token into the Login page.
          </div>
        </div>
      )}
    </div>
  )
}
