import { useState } from 'react'
import { registerBusiness } from '../lib/businessApi'
import { theme } from '../lib/theme'

export default function BusinessRegister() {
  const [businessName, setBusinessName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  type BusinessCountry = 'ZA' | 'US'
  const [businessCountry, setBusinessCountry] = useState<BusinessCountry>('ZA')

  const [businessCode, setBusinessCode] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setBusinessCode(null)

    const name = businessName.trim()
    const email = contactEmail.trim()

    if (!name) {
      setError('Business name is required.')
      return
    }

    if (email && !email.includes('@')) {
      setError('Contact email looks invalid.')
      return
    }

    setBusy(true)
    try {
      const res = await registerBusiness({
        businessName: name,
        contactEmail: email || undefined,
        businessCountry,
      })
      setBusinessCode(res.businessCode)

      localStorage.setItem('ddworkrecord_business_code', res.businessCode)
      localStorage.setItem('ddworkrecord_business_country', businessCountry)
      // Stay on this page and show welcome + next steps (console "Get Started")
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to register business.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 860, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text }}>Business Registration</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850 }}>
        Register your business once. We’ll generate a unique access code so you can login to your business dashboard.
      </p>

      <div style={{ marginTop: 18, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface, padding: 16 }}>
        {error ? (
          <div style={{ marginBottom: 12, padding: 12, background: theme.errorBg, borderLeft: `4px solid ${theme.error}`, fontWeight: 950, borderRadius: theme.radiusSm, color: theme.text }}>
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
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 8, color: theme.text }}>Contact email (optional)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="admin@supplier.com"
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
            {busy ? 'Registering…' : 'Register & get code'}
          </button>

          <a href="#business-login" style={{ fontWeight: 1050, color: theme.text, textDecoration: 'underline' }}>
            I already have a code
          </a>
        </div>

        {businessCode ? (
          <div style={{ marginTop: 16, padding: 12, border: `2px dashed ${theme.borderStrong}`, borderRadius: theme.radiusSm, background: theme.accentPillBg }}>
            <div style={{ fontWeight: 1100, marginBottom: 6, color: theme.text }}>Welcome — your code is ready</div>
            <div style={{ fontWeight: 1100, fontSize: 18, color: theme.text }}>{businessCode}</div>

            <div style={{ marginTop: 10, color: theme.muted2, fontWeight: 850, fontSize: 12.5, lineHeight: 1.5 }}>
              {contactEmail.trim()
                ? `We’ll email your login details to: ${contactEmail.trim()}`
                : 'Add a contact email next time to receive login details by email.'}
            </div>

            <button
              onClick={() => {
                // Send to the normal DD console (no separate business portal UI).
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
