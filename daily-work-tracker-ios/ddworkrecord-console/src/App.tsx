import { useEffect, useMemo, useState } from 'react'
import { theme } from './lib/theme'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddDailyRecord from './pages/AddDailyRecord'
import RecordsList from './pages/RecordsList'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'
import TokenViewer from './pages/TokenViewer'
import LocalPreviewShell from './pages/LocalPreviewShell'
import EmployeePage from './pages/EmployeePage'
import RecordDetail from './pages/RecordDetail'
import DummyLocalPreview from './pages/DummyLocalPreview'
import JobsReports from './pages/JobsReports'
import SupplierReports from './pages/SupplierReports'
import JobsList from './pages/JobsList'
import SupplierStopsList from './pages/SupplierStopsList'
import FuelStopsList from './pages/FuelStopsList'
import BusinessRegister from './pages/BusinessRegister'
import BusinessLogin from './pages/BusinessLogin'
import BusinessDashboard from './pages/BusinessDashboard'
import Home from './pages/Home'
import AssistantPage from './pages/AssistantPage'

// Routes are based on the URL hash (no React Router in this project)
type Route =
  | 'home'
  | 'login'
  | 'dashboard'
  | 'add'
  | 'records'
  | 'reports'
  | 'settings'
  | 'admin'
  | 'token-viewer'
  | 'local-preview'
  | 'dummy-local-preview'
  | string // Allow dynamic sub-routes like employee/EMP-001
  | 'jobs'
  | 'jobs-list'
  | 'supplier-list'
  | 'fuel-list'
  | 'supplier-reports'
  | 'business-register'
  | 'business-login'
  | 'business-dashboard'

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

  const businessCode = safeGetItem('ddworkrecord_business_code')
  const adminToken = safeGetItem('ddworkrecord_admin_token')

  // Priority redirects when no hash is provided (public landing page)
  if (!h) {
    if (adminToken) return 'dashboard'
    return 'home'
  }

  if (h === 'add') return 'add'
  if (h === 'records') return 'records'
  if (h === 'reports') return 'reports'
  if (h === 'settings') return 'settings'
  if (h === 'admin') return 'admin'
  if (h === 'token-viewer') return 'token-viewer'
  if (h === 'dashboard') return 'dashboard'
  if (h === 'local-preview') return 'local-preview'
  if (h === 'dummy-local-preview') return 'dummy-local-preview'
  if (h === 'business-register') return 'business-register'
  if (h === 'business-login') return 'business-login'
  if (h === 'business-dashboard') return 'business-dashboard'
  if (h === 'jobs') return 'jobs'
  if (h === 'jobs-list') return 'jobs-list'
  if (h === 'supplier-list') return 'supplier-list'
  if (h === 'fuel-list') return 'fuel-list'
  if (h === 'supplier-reports') return 'supplier-reports'

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
    { label: 'Reports', r: 'reports', h: '#reports' },
    { label: 'Jobs', r: 'jobs', h: '#jobs' },
    { label: 'Jobs List', r: 'jobs-list', h: '#jobs-list' },
    { label: 'Supplier Stops', r: 'supplier-list', h: '#supplier-list' },
    { label: 'Fuel Stops', r: 'fuel-list', h: '#fuel-list' },
    { label: 'Suppliers', r: 'supplier-reports', h: '#supplier-reports' },
    { label: 'Admin', r: 'admin', h: '#admin' },
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
        href="#login"
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
    if (route === 'reports') return <Reports />
    if (route === 'settings') return <Settings />
    if (route === 'admin') return <AdminPanel />
    if (route === 'token-viewer') return <TokenViewer />
    if (route === 'local-preview') return <LocalPreviewShell />
    if (route === 'dummy-local-preview') return <DummyLocalPreview />
    if (route.startsWith('employee/')) return <EmployeePage />
    if (route.startsWith('assistant/')) return <AssistantPage />
    if (route.startsWith('record/')) return <RecordDetail />
    if (route === 'jobs') return <JobsReports />
    if (route === 'jobs-list') return <JobsList />
    if (route === 'supplier-list') return <SupplierStopsList />
    if (route === 'fuel-list') return <FuelStopsList />
    if (route === 'supplier-reports') return <SupplierReports />
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
