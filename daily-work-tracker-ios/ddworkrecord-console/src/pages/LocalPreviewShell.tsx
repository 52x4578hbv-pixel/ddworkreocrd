import { useEffect, useMemo, useState } from 'react'
import Dashboard from './Dashboard'
import RecordsList from './RecordsList'
import Reports from './Reports'
import JobsReports from './JobsReports'
import SupplierReports from './SupplierReports'
import AddDailyRecord from './AddDailyRecord'
import JobsList from './JobsList'
import SupplierStopsList from './SupplierStopsList'
import FuelStopsList from './FuelStopsList'
import { ensureSeededLocalPreview } from '../lib/localPreviewSeed'
import { getLocalPreviewDraftCount, getLocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import { theme } from '../lib/theme'

type Tab =
  | 'dashboard'
  | 'records'
  | 'jobs'
  | 'supplier'
  | 'fuel'
  | 'add'
  | 'reports'
  | 'jobs-reports'
  | 'supplier-reports'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

function getTabFromLocationHash(): Tab | null {
  // Expected base route: #/local-preview
  // Optional query in hash: #/local-preview?tab=fuel
  const h = window.location.hash || ''
  const idx = h.indexOf('?')
  if (idx === -1) return null
  const qs = h.slice(idx + 1)
  const params = new URLSearchParams(qs)
  const raw = params.get('tab')
  if (!raw) return null
  const allowed: Tab[] = ['dashboard', 'records', 'jobs', 'supplier', 'fuel', 'add', 'reports', 'jobs-reports', 'supplier-reports']
  return allowed.includes(raw as Tab) ? (raw as Tab) : null
}

function setHashTab(tab: Tab) {
  const base = '#/local-preview'
  const qs = `?tab=${encodeURIComponent(tab)}`
  window.location.hash = `${base}${qs}`
}

export default function LocalPreviewShell() {
  const [tab, setTab] = useState<Tab>('dashboard')

  const [seedError, setSeedError] = useState<string | null>(null)
  const [seedReady, setSeedReady] = useState(false)
  const [seedVersion, setSeedVersion] = useState(0)

  const LOCAL_DRAFTS_STORAGE_KEY = 'ddworkrecord_draft_queue_v1'

  // Sync tab from URL hash (?tab=...)
  useEffect(() => {
    const applyFromHash = () => {
      const fromHash = getTabFromLocationHash()
      if (fromHash) setTab(fromHash)
    }
    applyFromHash()
    window.addEventListener('hashchange', applyFromHash)
    return () => window.removeEventListener('hashchange', applyFromHash)
  }, [])

  // Seed once on mount so tab switching doesn't re-generate the dataset and lock the UI.
  useEffect(() => {
    try {
      // Avoid stale/invalid drafts causing 0 totals.
      localStorage.removeItem(LOCAL_DRAFTS_STORAGE_KEY)

      ensureSeededLocalPreview({ employeeCount: 20, months: 3, workdaysPerMonth: 18 })
      setSeedVersion((v) => v + 1)
      setSeedReady(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown seed error'
      setSeedError(msg)
      setSeedReady(false)
    }
  }, [])

  const title = useMemo(() => {
    if (tab === 'dashboard') return 'Dashboard'
    if (tab === 'records') return 'Records'
    if (tab === 'jobs') return 'Jobs'
    if (tab === 'supplier') return 'Supplier'
    if (tab === 'fuel') return 'Fuel'
    if (tab === 'add') return 'Add Record'
    if (tab === 'jobs-reports') return 'Jobs Reports'
    if (tab === 'supplier-reports') return 'Supplier Reports'
    return 'Employee Reports'
  }, [tab])

  return (
    <div style={{ fontFamily: 'system-ui', background: theme.pageBg, minHeight: '100vh' }}>
      <div
        style={{
          borderBottom: `3px solid ${theme.text}`,
          background: theme.topBarBg,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: 12,
          backdropFilter: 'blur(2px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Local Preview Sandbox</div>
            <div style={{ marginTop: 4, color: '#475569', fontWeight: 800, fontSize: 12 }}>
              Fake dataset only • No cloud writes • Template playground
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(
              [
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'records', label: 'Records' },
                { key: 'jobs', label: 'Jobs' },
                { key: 'supplier', label: 'Supplier' },
                { key: 'fuel', label: 'Fuel' },
                { key: 'add', label: 'Add New Record' },
                { key: 'reports', label: 'Employee Reports' },
                { key: 'jobs-reports', label: 'Jobs Reports' },
                { key: 'supplier-reports', label: 'Supplier Reports' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setHashTab(t.key)}
                style={{
                  padding: '10px 12px',
                  border: `2px solid ${theme.text}`,
                  background: tab === t.key ? theme.text : theme.surface,
                  color: tab === t.key ? '#fff' : theme.text,
                  cursor: 'pointer',
                  fontWeight: 1100,
                  borderRadius: theme.radiusSm,
                  boxShadow: tab === t.key ? `3px 3px 0 ${theme.text}` : undefined,
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 10, color: '#64748b', fontWeight: 900, fontSize: 12 }}>
          Current tab: {title}
          {seedReady ? (
            <span style={{ marginLeft: 10, color: '#334155' }}>
              drafts: {getLocalPreviewDraftCount()} • monthHours:{' '}
              {format2(getLocalPreviewMonthBreakdownBase().totalHours)}
            </span>
          ) : (
            <span style={{ marginLeft: 10, color: '#94a3b8' }}>(seeding…)</span>
          )}
        </div>
      </div>

      {seedError ? (
        <div
          style={{
            margin: 12,
            padding: 12,
            background: theme.errorBg,
            borderLeft: `4px solid ${theme.error}`,
            fontWeight: 900,
            borderRadius: theme.radiusSm,
            color: theme.errorDark,
          }}
        >
          Local preview failed to seed: {seedError}
        </div>
      ) : null}

      {seedReady ? (
        <div style={{ padding: 0 }}>
          {tab === 'dashboard' ? <Dashboard key={seedVersion} /> : null}
          {tab === 'records' ? <RecordsList key={seedVersion} /> : null}
          {tab === 'jobs' ? <JobsList key={seedVersion} /> : null}
          {tab === 'supplier' ? <SupplierStopsList key={seedVersion} /> : null}
          {tab === 'fuel' ? <FuelStopsList key={seedVersion} /> : null}
          {tab === 'add' ? <AddDailyRecord key={seedVersion} /> : null}
          {tab === 'reports' ? <Reports key={seedVersion} /> : null}
          {tab === 'jobs-reports' ? <JobsReports key={seedVersion} /> : null}
          {tab === 'supplier-reports' ? <SupplierReports key={seedVersion} /> : null}
        </div>
      ) : (
        <div style={{ padding: 24, fontWeight: 900, color: '#475569' }}>Preparing local preview dataset…</div>
      )}
    </div>
  )
}
