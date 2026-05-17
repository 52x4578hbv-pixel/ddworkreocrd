import { useEffect, useMemo, useState } from 'react'
import Dashboard from './Dashboard'
import RecordsList from './RecordsList'
import AddDailyRecord from './AddDailyRecord'
import JobsList from './JobsList'
import SupplierStopsList from './SupplierStopsList'
import FuelStopsList from './FuelStopsList'
import BusinessDashboard from './BusinessDashboard'
import JobsHub from './JobsHub'
import SuppliersHub from './SuppliersHub'
import AIAnalyzer from './AIAnalyzer'
import { ensureSeededLocalPreview, getDefaultEmployeeCount } from '../lib/localPreviewSeed'
import { getLocalPreviewDraftCount, getLocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import { theme } from '../lib/theme'

type Tab = 'dashboard' | 'records' | 'jobs' | 'supplier' | 'fuel' | 'add' | 'ai-analyzer' | 'business-dashboard'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

function getTabFromLocationHash(): Tab | null {
  const h = window.location.hash || ''
  const idx = h.indexOf('?')
  if (idx === -1) return null

  const qs = h.slice(idx + 1)
  const params = new URLSearchParams(qs)
  const raw = params.get('tab')
  if (!raw) return null

  const allowed: Tab[] = ['dashboard', 'records', 'jobs', 'supplier', 'fuel', 'add', 'ai-analyzer', 'business-dashboard']
  return allowed.includes(raw as Tab) ? (raw as Tab) : null
}

type PreviewCountry = 'ZA' | 'US'

function getCountryFromLocationHash(): PreviewCountry | null {
  const h = window.location.hash || ''
  const idx = h.indexOf('?')
  if (idx === -1) return null

  const qs = h.slice(idx + 1)
  const params = new URLSearchParams(qs)
  const raw = params.get('country')
  if (!raw) return null
  if (raw === 'US') return 'US'
  if (raw === 'ZA') return 'ZA'
  return null
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

  const LOCAL_PREVIEW_COUNTRY_KEY = 'ddworkrecord_local_preview_country'
  const BUSINESS_COUNTRY_KEY = 'ddworkrecord_business_country'

  const normalizeCountry = (raw: string | null): PreviewCountry | null => {
    if (raw === 'US') return 'US'
    if (raw === 'ZA') return 'ZA'
    return null
  }

  const [previewCountry, setPreviewCountry] = useState<PreviewCountry>(() => {
    try {
      const localRaw = localStorage.getItem(LOCAL_PREVIEW_COUNTRY_KEY)
      const local = normalizeCountry(localRaw)
      if (local) return local

      const businessRaw = localStorage.getItem(BUSINESS_COUNTRY_KEY)
      const business = normalizeCountry(businessRaw)
      if (business) return business

      return 'ZA'
    } catch {
      return 'ZA'
    }
  })

  const applyPreviewCountry = (next: PreviewCountry) => {
    setPreviewCountry(next)
    try {
      localStorage.setItem(LOCAL_PREVIEW_COUNTRY_KEY, next)
    } catch {
      // ignore
    }
    setSeedVersion((v) => v + 1)
  }

  const LOCAL_DRAFTS_STORAGE_KEY = 'ddworkrecord_draft_queue_v1'

  useEffect(() => {
    const applyFromHash = () => {
      const fromHash = getTabFromLocationHash()
      if (fromHash) setTab(fromHash)

      const countryFromHash = getCountryFromLocationHash()
      if (countryFromHash && countryFromHash !== previewCountry) {
        applyPreviewCountry(countryFromHash)
      }
    }

    applyFromHash()
    window.addEventListener('hashchange', applyFromHash)
    return () => window.removeEventListener('hashchange', applyFromHash)
  }, [previewCountry])

  useEffect(() => {
    try {
      localStorage.removeItem(LOCAL_DRAFTS_STORAGE_KEY)

      ensureSeededLocalPreview({
        employeeCount: getDefaultEmployeeCount(),
        months: 3,
        workdaysPerMonth: 18,
      })

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
    if (tab === 'supplier') return 'Suppliers'
    if (tab === 'fuel') return 'Fuel'
    if (tab === 'add') return 'Add Record'
    if (tab === 'ai-analyzer') return 'AI Analyzer'
    if (tab === 'business-dashboard') return 'Business Portal'
    return ''
  }, [tab])

  const tabs = useMemo(
    () =>
      [
        { key: 'dashboard' as const, label: 'Dashboard' },
        { key: 'records' as const, label: 'Records' },
        { key: 'jobs' as const, label: 'Jobs' },
        { key: 'supplier' as const, label: 'Suppliers' },
        { key: 'fuel' as const, label: 'Fuel' },
        { key: 'add' as const, label: 'Add New Record' },
        { key: 'ai-analyzer' as const, label: 'AI Analyzer' },
        { key: 'business-dashboard' as const, label: 'Business Portal' },
      ] as const,
    [],
  )

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
            {tabs.map((t) => (
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

        <div
          style={{
            marginTop: 10,
            color: '#64748b',
            fontWeight: 900,
            fontSize: 12,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: '#334155' }}>Public holiday calendar:</span>
            <select
              aria-label="Public holiday calendar country"
              title="Public holiday calendar country"
              value={previewCountry}
              onChange={(e) => applyPreviewCountry((e.target.value === 'US' ? 'US' : 'ZA') as PreviewCountry)}
              style={{
                height: 34,
                padding: '0 10px',
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                background: theme.surface,
                fontWeight: 1000,
                color: theme.text,
                outline: 'none',
              }}
            >
              <option value="ZA">South Africa</option>
              <option value="US">USA</option>
            </select>
          </div>
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
          {tab === 'jobs' ? <JobsHub key={seedVersion} /> : null}
          {tab === 'supplier' ? <SuppliersHub key={seedVersion} /> : null}
          {tab === 'fuel' ? <FuelStopsList key={seedVersion} /> : null}
          {tab === 'add' ? <AddDailyRecord key={seedVersion} /> : null}
          {tab === 'ai-analyzer' ? <AIAnalyzer key={seedVersion} /> : null}
          {tab === 'business-dashboard' ? <BusinessDashboard key={seedVersion} /> : null}
        </div>
      ) : (
        <div style={{ padding: 24, fontWeight: 900, color: '#475569' }}>Preparing local preview dataset…</div>
      )}
    </div>
  )
}
