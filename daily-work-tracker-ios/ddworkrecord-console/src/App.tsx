import { useEffect, useMemo, useState } from 'react'
import { theme } from './lib/theme'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddDailyRecord from './pages/AddDailyRecord'
import RecordsList from './pages/RecordsList'
import Settings from './pages/Settings'
import TokenViewer from './pages/TokenViewer'
import LocalPreviewShell from './pages/LocalPreviewShell'
import EmployeePage from './pages/EmployeePage'
import RecordDetail from './pages/RecordDetail'
import DummyLocalPreview from './pages/DummyLocalPreview'
import JobsHub from './pages/JobsHub'
import SuppliersHub from './pages/SuppliersHub'
import FuelStopsList from './pages/FuelStopsList'
import BusinessRegister from './pages/BusinessRegister'
import BusinessLogin from './pages/BusinessLogin'
import BusinessDashboard from './pages/BusinessDashboard'
import Home from './pages/Home'
import AssistantPage from './pages/AssistantPage'
import AIAnalyzer from './pages/AIAnalyzer'

// Routes are based on the URL hash (no React Router in this project)
type Route =
  | 'home'
  | 'login'
  | 'dashboard'
  | 'add'
  | 'records'
  | 'settings'
  | 'token-viewer'
  | 'local-preview'
  | 'dummy-local-preview'
  | 'jobs'
  | 'jobs-list' // legacy
  | 'suppliers'
  | 'supplier-list' // legacy
  | 'supplier-reports' // legacy
  | 'fuel-list'
  | 'ai-analyzer'
  | 'business-register'
  | 'business-login'
  | 'business-dashboard'
  | string // Allow dynamic sub-routes like employee/EMP-001

function getRouteFromHash(): Route {
  const raw = window.location.hash.replace('#', '').replace(/^\//, '')
  const h = raw.split('?')[0]

  const safeGetItem = (key: string): string | null => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  const adminToken = safeGetItem('ddworkrecord_admin_token')

  // Priority redirects when no hash is provided (public landing page)
  if (!h) {
    if (adminToken) return 'dashboard'
    return 'home'
  }

  if (h === 'add') return 'add'
  if (h === 'records') return 'records'
  if (h === 'settings') return 'settings'
  if (h === 'admin') return 'settings' // removed tab; keep deep-link safe
  if (h === 'reports') return 'jobs' // removed tab; keep deep-link safe

  if (h === 'login') return 'login'
  if (h === 'token-viewer') return 'token-viewer'
  if (h === 'dashboard') return 'dashboard'
  if (h === 'local-preview') return 'local-preview'
  if (h === 'dummy-local-preview') return 'dummy-local-preview'

  if (h === 'jobs') return 'jobs'
  if (h === 'jobs-list') return 'jobs'

  if (h === 'supplier-list') return 'suppliers'
  if (h === 'supplier-reports') return 'suppliers'
  if (h === 'suppliers') return 'suppliers'

  if (h === 'fuel-list') return 'fuel-list'
  if (h === 'ai-analyzer') return 'ai-analyzer'

  if (h === 'business-register') return 'business-register'
  if (h === 'business-login') return 'business-login'
  if (h === 'business-dashboard') return 'business-dashboard'

  if (h.startsWith('employee/')) return h
  if (h.startsWith('assistant/')) return h
  if (h.startsWith('record/')) return h

  // Fallback (unknown hash)
  return 'home'
}

function Navigation({ current }: { current: Route }) {
  const links = [
    { label: 'Dashboard', r: 'dashboard', h: '#dashboard' },
    { label: 'Add Record', r: 'add', h: '#add' },
    { label: 'Records', r: 'records', h: '#records' },

    // Combined tabs
    { label: 'Jobs', r: 'jobs', h: '#jobs' },
    { label: 'Suppliers', r: 'suppliers', h: '#suppliers' },
    { label: 'Fuel Stops', r: 'fuel-list', h: '#fuel-list' },

    // New tab
    { label: 'AI Analyzer', r: 'ai-analyzer', h: '#ai-analyzer' },

    { label: 'Settings', r: 'settings', h: '#settings' },
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
        const isActive = current.startsWith(l.r)
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
            }}
          >
            {l.label}
          </a>
        )
      })}
      <a
        href="#home"
        onClick={() => {
          localStorage.removeItem('ddworkrecord_admin_token')
          localStorage.removeItem('ddworkrecord_business_code')
        }}
        style={{
          marginLeft: 'auto',
          color: theme.muted,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 950,
          borderBottom: `2px solid transparent`,
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
    if (route === 'dashboard') return <Dashboard />
    if (route === 'add') return <AddDailyRecord />
    if (route === 'records') return <RecordsList />
    if (route === 'settings') return <Settings />
    if (route === 'token-viewer') return <TokenViewer />

    if (route === 'local-preview') return <LocalPreviewShell />
    if (route === 'dummy-local-preview') return <DummyLocalPreview />

    if (route === 'jobs' || route === 'jobs-list') return <JobsHub />
    if (route === 'suppliers' || route === 'supplier-list' || route === 'supplier-reports') return <SuppliersHub />

    if (route === 'fuel-list') return <FuelStopsList />

    if (route === 'ai-analyzer') return <AIAnalyzer />

    if (route.startsWith('employee/')) return <EmployeePage />
    if (route.startsWith('assistant/')) return <AssistantPage />
    if (route.startsWith('record/')) return <RecordDetail />

    if (route === 'business-register') return <BusinessRegister />
    if (route === 'business-login') return <BusinessLogin />
    if (route === 'business-dashboard') return <BusinessDashboard />

    if (route === 'home') return <Home />
    return <Login />
  }, [route])

  const showNav =
    route !== 'login' &&
    route !== 'home' &&
    route !== 'local-preview' &&
    route !== 'dummy-local-preview' &&
    route !== 'business-register' &&
    route !== 'business-login' &&
    route !== 'business-dashboard'

  return (
    <div style={{ minHeight: '100vh', background: theme.pageBg }}>
      {showNav && <Navigation current={route} />}
      <div>{content}</div>
    </div>
  )
}
