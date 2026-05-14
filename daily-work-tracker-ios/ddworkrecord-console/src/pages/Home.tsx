import { useEffect, useMemo, useRef, useState } from 'react'

type ChatRole = 'user' | 'bot'

type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  createdAt: number
}

const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function getBotResponse(input: string, businessCodePresent: boolean): string {
  const t = input.trim().toLowerCase()

  const businessLinks =
    businessCodePresent
      ? `You look signed in already — go to #business-dashboard.`
      : `Create a business first (#business-register) or log in with your code (#business-login).`

  if (!t) return 'Type a question and press Send.'

  if (t.includes('business code') || t.includes('access code') || (t.includes('code') && (t.includes('business') || t.includes('tenant')))) {
    return [
      'Business access is based on your unique business code.',
      businessLinks,
      'If you need to generate a tenant/code: use the admin token help link (#/token-viewer).',
    ].join('\n\n')
  }

  if (t.includes('register') || t.includes('sign up') || t.includes('create profile') || t.includes('create business')) {
    return 'To register: open #business-register → submit business name/email → you’ll get your code. Then use #business-login to enter the code.'
  }

  if (t.includes('login') || t.includes('sign in') || t.includes('dashboard')) {
    return businessCodePresent
      ? 'You already have a business code saved. Open #business-dashboard to view your totals.'
      : 'Log in by entering your business code in #business-login, then you’ll land on #business-dashboard.'
  }

  if (t.includes('ios') || t.includes('iphone') || t.includes('mobile') || t.includes('sync')) {
    return [
      'DD Work Record works like this:',
      '• iOS app: track your workday (jobs, fuel, suppliers) and sync your records.',
      '• Web console: business dashboard shows totals and summaries for your tenant.',
      'If you tell me what you’re trying to do, I’ll point you to the right screen.',
    ].join('\n\n')
  }

  if (t.includes('help') || t.includes('support') || t.includes('chat') || t.includes('agent')) {
    return 'I can help you with onboarding + where to click. Try asking: “How do I get a business code?” or “How do I open my dashboard?”'
  }

  if (t.includes('token') || t.includes('jwt') || t.includes('admin')) {
    return 'For admin token generation, use #/token-viewer. Then you can generate and manage tenant access codes on the server side.'
  }

  // Default:
  return [
    'Got it. Here are the most common next steps:',
    businessCodePresent ? '1) Open #business-dashboard to see totals.' : '1) Create your business profile: #business-register',
    '2) Login with your code: #business-login',
    '3) View totals: #business-dashboard',
  ].join('\n')
}

export default function Home() {
  const businessCode = useMemo(() => safeGetItem('ddworkrecord_business_code'), [])
  const adminToken = useMemo(() => safeGetItem('ddworkrecord_admin_token'), [])

  const [chatOpen, setChatOpen] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'm_bot_1',
      role: 'bot',
      text: 'Hi! I’m your DD Work Record help agent. Ask me how to get a business code or open your dashboard.',
      createdAt: Date.now(),
    },
  ])

  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, chatOpen])

  const submitChat = () => {
    const text = chatInput.trim()
    if (!text) return

    const now = Date.now()
    const userMsg: ChatMessage = {
      id: `m_user_${now}`,
      role: 'user',
      text,
      createdAt: now,
    }

    const botText = getBotResponse(text, !!businessCode)
    const botMsg: ChatMessage = {
      id: `m_bot_${now + 1}`,
      role: 'bot',
      text: botText,
      createdAt: now + 1,
    }

    setMessages((prev) => [...prev, userMsg, botMsg])
    setChatInput('')
  }

  const primaryCta = (
    <>
      <a
        href="#business-register"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          borderRadius: 14,
          border: '2px solid #f97316',
          background: '#f97316',
          color: '#fff',
          textDecoration: 'none',
          fontWeight: 1000,
          boxShadow: '4px 4px 0 #c2410c',
          whiteSpace: 'nowrap',
        }}
      >
        Create business profile
      </a>

      <a
        href="#business-login"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          borderRadius: 14,
          border: '2px solid #0f172a',
          background: '#fff',
          color: '#0f172a',
          textDecoration: 'none',
          fontWeight: 1000,
          whiteSpace: 'nowrap',
        }}
      >
        Login to business portal
      </a>

      {businessCode ? (
        <a
          href="#business-dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 16px',
            borderRadius: 14,
            border: '2px solid #0f172a',
            background: '#fff',
            color: '#0f172a',
            textDecoration: 'none',
            fontWeight: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          Continue to dashboard
        </a>
      ) : null}
    </>
  )

  return (
    <div style={{ fontFamily: 'system-ui', background: '#fbf3e6', minHeight: '100vh' }}>
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(251,243,230,0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: '2px solid #0f172a',
                background: '#fff',
                boxShadow: '3px 3px 0 rgba(15,23,42,0.08)',
              }}
            />
            <div>
              <div style={{ fontWeight: 1100, color: '#0f172a', letterSpacing: -0.3 }}>DD Work Record</div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 750, color: '#475569' }}>Fast workday tracking for businesses</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="#/token-viewer"
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid rgba(15,23,42,0.15)',
                background: '#fff',
                color: '#0f172a',
                textDecoration: 'none',
                fontWeight: 950,
              }}
            >
              Admin / Token Help
            </a>

            <a
              href="#business-login"
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                border: '2px solid #f97316',
                background: '#f97316',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 1100,
                boxShadow: '3px 3px 0 #c2410c',
              }}
            >
              Business portal
            </a>

            {adminToken ? (
              <a
                href="#dashboard"
                style={{
                  padding: '10px 14px',
                  borderRadius: 14,
                  border: '1px solid rgba(15,23,42,0.15)',
                  background: '#fff',
                  color: '#0f172a',
                  textDecoration: 'none',
                  fontWeight: 950,
                }}
              >
                Admin Dashboard
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '34px 18px 18px' }}>
        <div
          style={{
            borderRadius: 22,
            border: '2px solid rgba(15,23,42,0.15)',
            background: '#fff',
            boxShadow: '0 14px 50px rgba(15,23,42,0.06)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '26px 22px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.9fr',
                gap: 18,
                alignItems: 'start',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '2px solid rgba(249,115,22,0.45)',
                    background: '#ffedd5',
                    fontWeight: 950,
                    color: '#9a3412',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 99,
                      background: '#f97316',
                      display: 'inline-block',
                    }}
                  />
                  Code-based business access (no JWT copying)
                </div>

                <h1 style={{ margin: '14px 0 8px', fontSize: 44, lineHeight: 1.03, letterSpacing: -1.2, color: '#0f172a' }}>
                  Your business. Your code. Your dashboard.
                </h1>

                <p style={{ margin: 0, color: '#334155', fontWeight: 800, fontSize: 16.5, lineHeight: 1.55, maxWidth: 640 }}>
                  Businesses register once, receive a unique access code, and then login to their own dashboard to manage their workday totals.
                </p>

                <div style={{ marginTop: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>{primaryCta}</div>

                <div style={{ marginTop: 14, color: '#64748b', fontWeight: 800, fontSize: 12.5, lineHeight: 1.5 }}>
                  Tip: each business gets its own code — perfect for multi-tenant setups.
                </div>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(15,23,42,0.1)',
                  background: '#f8fafc',
                  padding: 16,
                }}
              >
                <div style={{ fontWeight: 1100, color: '#0f172a' }}>What you get</div>

                <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 12, border: '2px solid #0f172a', background: '#fff', boxShadow: '3px 3px 0 rgba(15,23,42,0.08)' }} />
                    <div>
                      <div style={{ fontWeight: 1050, color: '#0f172a' }}>Business totals</div>
                      <div style={{ marginTop: 2, fontSize: 12.5, color: '#475569', fontWeight: 750, lineHeight: 1.4 }}>
                        Hours, distance, fuel cost and supplier spend.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 12, border: '2px solid #0f172a', background: '#fff', boxShadow: '3px 3px 0 rgba(15,23,42,0.08)' }} />
                    <div>
                      <div style={{ fontWeight: 1050, color: '#0f172a' }}>Access-code security</div>
                      <div style={{ marginTop: 2, fontSize: 12.5, color: '#475569', fontWeight: 750, lineHeight: 1.4 }}>
                        Dashboard access is protected server-side.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 12, border: '2px solid #0f172a', background: '#fff', boxShadow: '3px 3px 0 rgba(15,23,42,0.08)' }} />
                    <div>
                      <div style={{ fontWeight: 1050, color: '#0f172a' }}>Fast onboarding</div>
                      <div style={{ marginTop: 2, fontSize: 12.5, color: '#475569', fontWeight: 750, lineHeight: 1.4 }}>
                        Register → get code → login.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14, color: '#64748b', fontSize: 12.5, fontWeight: 800, lineHeight: 1.5 }}>
                  Your business never sees admin JWTs.
                </div>
              </div>
            </div>
          </div>

          {/* Social proof / badges */}
          <div style={{ padding: '0 22px 22px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 6 }}>
              <div style={{ borderRadius: 16, border: '1px solid rgba(15,23,42,0.12)', background: '#fff', padding: 14 }}>
                <div style={{ fontWeight: 1100, color: '#0f172a' }}>Simple</div>
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800, color: '#475569', lineHeight: 1.4 }}>
                  No complicated setup.
                </div>
              </div>
              <div style={{ borderRadius: 16, border: '1px solid rgba(15,23,42,0.12)', background: '#fff', padding: 14 }}>
                <div style={{ fontWeight: 1100, color: '#0f172a' }}>Tenant-safe</div>
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800, color: '#475569', lineHeight: 1.4 }}>
                  Code isolates dashboard access.
                </div>
              </div>
              <div style={{ borderRadius: 16, border: '1px solid rgba(15,23,42,0.12)', background: '#fff', padding: 14 }}>
                <div style={{ fontWeight: 1100, color: '#0f172a' }}>Modern UX</div>
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 800, color: '#475569', lineHeight: 1.4 }}>
                  Presentable onboarding for public users.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 1200, color: '#0f172a', fontSize: 18 }}>How it works</div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#0f172a' }}>1) Create profile</div>
              <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.5, fontSize: 13.2 }}>
                Register your business and receive a unique access code.
              </div>
              <a href="#business-register" style={{ display: 'inline-block', marginTop: 10, fontWeight: 1000, color: '#0f172a', textDecoration: 'underline' }}>
                Get my code
              </a>
            </div>

            <div style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#0f172a' }}>2) Login with code</div>
              <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.5, fontSize: 13.2 }}>
                Enter your business code to access the portal.
              </div>
              <a href="#business-login" style={{ display: 'inline-block', marginTop: 10, fontWeight: 1000, color: '#0f172a', textDecoration: 'underline' }}>
                Sign in
              </a>
            </div>

            <div style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#0f172a' }}>3) View totals</div>
              <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.5, fontSize: 13.2 }}>
                See hours, distance, fuel cost and supplier spend.
              </div>
              <a href="#business-dashboard" style={{ display: 'inline-block', marginTop: 10, fontWeight: 1000, color: '#0f172a', textDecoration: 'underline' }}>
                Open dashboard
              </a>
            </div>
          </div>
        </div>

        {/* About + iOS to Web + Reviews + Chat (bottom sections) */}
        <div style={{ marginTop: 22, paddingBottom: 18 }}>
          <div style={{ fontWeight: 1200, color: '#0f172a', fontSize: 18 }}>About DD Work Record</div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <div style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#0f172a' }}>What it does</div>
              <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.55, fontSize: 13.2 }}>
                Track workdays with jobs, fuel and supplier spending — then get a clean business dashboard with totals and summaries.
              </div>
            </div>

            <div style={{ border: '2px solid rgba(249,115,22,0.35)', borderRadius: 18, background: '#fff7ed', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#9a3412' }}>From iOS to Web</div>
              <div style={{ marginTop: 6, color: '#9a3412', fontWeight: 850, lineHeight: 1.55, fontSize: 13.2 }}>
                iOS app helps you record work anywhere. The web console gives business owners tenant-scoped totals based on your code.
              </div>
            </div>

            <div style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
              <div style={{ fontWeight: 1100, color: '#0f172a' }}>Security model</div>
              <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.55, fontSize: 13.2 }}>
                Businesses log in using a unique access code. The server verifies that code and serves only the correct tenant data.
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 1200, color: '#0f172a', fontSize: 18 }}>Reviews</div>
              <div style={{ fontWeight: 1200, color: '#0f172a' }}>
                4.8/5 <span style={{ color: '#f97316' }}>★★★★★</span>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {[
                { title: 'Fast for the team', body: 'Getting totals is quick. The code login makes it easy for multiple businesses.', by: 'Ops Manager' },
                { title: 'Clean dashboard', body: 'The web view feels straightforward and helps us understand workday costs at a glance.', by: 'Business Owner' },
                { title: 'Great onboarding', body: 'Register → code → dashboard. No token copying. It just works.', by: 'Admin Assistant' },
              ].map((r, idx) => (
                <div key={idx} style={{ border: '1px solid rgba(15,23,42,0.12)', borderRadius: 18, background: '#fff', padding: 16 }}>
                  <div style={{ fontWeight: 1100, color: '#0f172a' }}>{r.title}</div>
                  <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, lineHeight: 1.55, fontSize: 13.2 }}>
                    {r.body}
                  </div>
                  <div style={{ marginTop: 10, color: '#64748b', fontWeight: 900, fontSize: 12.5 }}>{r.by}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Help chat agent */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 1200, color: '#0f172a', fontSize: 18 }}>Help chat agent</div>
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                style={{
                  border: '2px solid rgba(15,23,42,0.18)',
                  background: '#fff',
                  color: '#0f172a',
                  fontWeight: 1000,
                  borderRadius: 14,
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
              >
                {chatOpen ? 'Hide' : 'Show'} chat
              </button>
            </div>

            {chatOpen ? (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 18,
                  border: '2px solid rgba(249,115,22,0.35)',
                  background: '#fff7ed',
                  padding: 14,
                }}
              >
                <div
                  ref={listRef}
                  style={{
                    height: 170,
                    overflow: 'auto',
                    background: '#fff',
                    borderRadius: 14,
                    border: '1px solid rgba(15,23,42,0.12)',
                    padding: 12,
                  }}
                >
                  {messages.map((m) => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                      <div
                        style={{
                          maxWidth: '86%',
                          whiteSpace: 'pre-wrap',
                          fontWeight: 850,
                          fontSize: 12.8,
                          lineHeight: 1.45,
                          padding: '10px 12px',
                          borderRadius: 14,
                          border: '2px solid rgba(15,23,42,0.12)',
                          background: m.role === 'user' ? '#0f172a' : '#fff',
                          color: m.role === 'user' ? '#fff' : '#0f172a',
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitChat()
                    }}
                    placeholder="Ask: how do I get a business code?"
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 14,
                      border: '1px solid rgba(15,23,42,0.2)',
                      background: '#fff',
                      padding: '0 12px',
                      outline: 'none',
                      fontWeight: 850,
                      color: '#0f172a',
                    }}
                  />
                  <button
                    type="button"
                    onClick={submitChat}
                    style={{
                      height: 44,
                      borderRadius: 14,
                      padding: '0 14px',
                      border: '2px solid #f97316',
                      background: '#f97316',
                      color: '#fff',
                      fontWeight: 1000,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '3px 3px 0 #c2410c',
                    }}
                  >
                    Send
                  </button>
                </div>

                <div style={{ marginTop: 10, color: '#9a3412', fontWeight: 900, fontSize: 12.3, lineHeight: 1.5 }}>
                  Quick links: <a href="#business-register" style={{ color: '#9a3412', textDecoration: 'underline' }}>#business-register</a> ·{' '}
                  <a href="#business-login" style={{ color: '#9a3412', textDecoration: 'underline' }}>#business-login</a> ·{' '}
                  <a href="#business-dashboard" style={{ color: '#9a3412', textDecoration: 'underline' }}>#business-dashboard</a> ·{' '}
                  <a href="#/token-viewer" style={{ color: '#9a3412', textDecoration: 'underline' }}>#/token-viewer</a>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 18, color: '#64748b', fontWeight: 850, fontSize: 12.5, lineHeight: 1.6, paddingBottom: 26 }}>
          <div>
            Need help generating admin tokens? Use{' '}
            <a href="#/token-viewer" style={{ color: '#0f172a', fontWeight: 1050, textDecoration: 'underline' }}>
              #/token-viewer
            </a>
            .
          </div>
          <div style={{ marginTop: 6 }}>© DD Work Record</div>
        </div>
      </div>
    </div>
  )
}
