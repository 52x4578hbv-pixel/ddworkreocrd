import { useEffect, useMemo, useState } from 'react'
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

// Routes are based on the URL hash (no React Router in this project)
type Route =
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

function getRouteFromHash(): Route {
  const raw = window.location.hash.replace('#', '').replace(/^\//, '')
  const h = raw.split('?')[0]
  if (h === 'dashboard') return 'dashboard'
  if (h === 'add') return 'add'
  if (h === 'records') return 'records'
  if (h === 'reports') return 'reports'
  if (h === 'settings') return 'settings'
  if (h === 'admin') return 'admin'
  if (h === 'token-viewer') return 'token-viewer'
  if (h === 'local-preview') return 'local-preview'
  if (h === 'dummy-local-preview') return 'dummy-local-preview'
  if (h === 'jobs') return 'jobs'
  if (h === 'jobs-list') return 'jobs-list'
  if (h === 'supplier-list') return 'supplier-list'
  if (h === 'fuel-list') return 'fuel-list'
  if (h === 'supplier-reports') return 'supplier-reports'

  if (h.startsWith('employee/')) return h
  if (h.startsWith('record/')) return h

  return 'login'
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
    <nav style={{ background: '#0f172a', padding: '14px 24px', display: 'flex', gap: 20, alignItems: 'center', color: '#fff' }}>
      <div style={{ fontWeight: 1000, fontSize: 18, marginRight: 10 }}>DD Console</div>
      {links.map((l) => (
        <a 
          key={l.h} 
          href={l.h} 
          style={{ color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800, opacity: current.startsWith(l.r) ? 1 : 0.6 }}
        >
          {l.label}
        </a>
      ))}
      <a href="#login" style={{ marginLeft: 'auto', color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontWeight: 800 }}>Logout</a>
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
    if (route.startsWith('record/')) return <RecordDetail />
    if (route === 'jobs') return <JobsReports />
    if (route === 'jobs-list') return <JobsList />
    if (route === 'supplier-list') return <SupplierStopsList />
    if (route === 'fuel-list') return <FuelStopsList />
    if (route === 'supplier-reports') return <SupplierReports />
    return <Login />
  }, [route])

  const showNav = route !== 'login' && route !== 'local-preview' && route !== 'dummy-local-preview'

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {showNav && <Navigation current={route} />}
      <div>{content}</div>
    </div>
  )
}
