import { Suspense, useEffect, useMemo, useState } from 'react'
import { theme } from './lib/theme'

import JobsHub from './pages/JobsHub'
import SuppliersHub from './pages/SuppliersHub'
import FuelStopsList from './pages/FuelStopsList'
import BusinessRegister from './pages/BusinessRegister'
import BusinessLogin from './pages/BusinessLogin'
import Home from './pages/Home'

// Routes are based on the URL hash (no React Router in this project)
type Route = 'home' | 'business-register' | 'business-login' | 'jobs' | 'suppliers' | 'fuel-list'

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function getRouteFromHash(): Route {
  const raw = window.location.hash.replace('#', '').replace(/^\//, '')
  const h = raw.split('?')[0]

  const businessCode = safeGetItem('ddworkrecord_business_code')

  // Public landing page when no hash is provided
  if (!h) {
    return businessCode ? 'jobs' : 'home'
  }

  // Legacy/extra redirects: treat as console
  if (h === 'dashboard' || h === 'business-dashboard' || h === 'jobs-list') return 'jobs'

  if (h === 'business-register') return 'business-register'
  if (h === 'business-login') return 'business-login'
  if (h === 'jobs') return 'jobs'
  if (h === 'suppliers' || h === 'supplier-list' || h === 'supplier-reports') return 'suppliers'
  if (h === 'fuel-list' || h === 'fuel') return 'fuel-list'

  // Unknown hash => stay on landing
  return businessCode ? 'jobs' : 'home'
}

function Navigation({ current }: { current: Route }) {
  const businessCode = safeGetItem('ddworkrecord_business_code')

  const links = [
    { label: 'Jobs', r: 'jobs' as const, h: '#jobs' },
    { label: 'Suppliers', r: 'suppliers' as const, h: '#suppliers' },
    { label: 'Fuel', r: 'fuel-list' as const, h: '#fuel-list' },
  ]

  return (
    <nav
      style={{
        background: theme.topBarBg,
        padding: '10px 12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        color: theme.text,
        borderBottom: `1px solid ${theme.borderSoft}`,
        position: 'sticky',
        top: 0,
        zIndex: 9,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ fontWeight: 1100, fontSize: 18, marginRight: 10 }}>DD Console</div>
      {links.map((l) => {
        const isActive = current === l.r
        return (
          <a
            key={l.h}
            href={l.h}
            style={{
              color: isActive ? theme.text : theme.muted,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 900,
              opacity: isActive ? 1 : 0.9,
              borderBottom: isActive ? `2px solid ${theme.accent}` : '2px solid transparent',
              paddingBottom: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {l.label}
          </a>
        )
      })}

      <a
        href="#home"
        onClick={() => {
          localStorage.removeItem('ddworkrecord_business_code')
          localStorage.removeItem('ddworkrecord_business_country')
          localStorage.removeItem('ddworkrecord_admin_token')
        }}
        style={{
          marginLeft: 'auto',
          color: theme.muted,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 950,
          borderBottom: `2px solid transparent`,
          whiteSpace: 'nowrap',
          opacity: businessCode ? 1 : 0.7,
          pointerEvents: businessCode ? 'auto' : 'none',
        }}
      >
        Logout
      </a>
    </nav>
  )
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => getRouteFromHash())

  useEffect(() => {
    const onHash = () => setRoute(getRouteFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const content = useMemo(() => {
    const suspenseFallback = <div style={{ padding: 24, fontWeight: 900 }}>Loading…</div>

    if (route === 'home') return <Home />
    if (route === 'business-register') return <BusinessRegister />
    if (route === 'business-login') return <BusinessLogin />

    // Console tabs require a business code (fallback already handled by getRouteFromHash)
    if (route === 'jobs')
      return (
        <Suspense fallback={suspenseFallback}>
          <JobsHub />
        </Suspense>
      )

    if (route === 'suppliers')
      return (
        <Suspense fallback={suspenseFallback}>
          <SuppliersHub />
        </Suspense>
      )

    if (route === 'fuel-list')
      return (
        <Suspense fallback={suspenseFallback}>
          <FuelStopsList />
        </Suspense>
      )

    return <Home />
  }, [route])

  const showNav = route === 'jobs' || route === 'suppliers' || route === 'fuel-list'

  return (
    <div style={{ minHeight: '100vh', background: theme.pageBg }}>
      {showNav && <Navigation current={route} />}
      <div>{content}</div>
    </div>
  )
}
