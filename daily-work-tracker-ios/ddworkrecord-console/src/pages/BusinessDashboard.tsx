import { useEffect, useMemo, useState } from 'react'
import type { Period } from '../lib/api'
import { fetchBusinessStats, mintWorkerSecrets } from '../lib/businessApi'
import { theme } from '../lib/theme'
import { isLocalPreviewMode } from '../lib/localPreview'
import { getLocalPreviewSummary } from '../lib/localPreviewData'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type BusinessTab = 'dashboard' | 'settings' | 'records' | 'jobs' | 'suppliers' | 'reports'

function getTabFromHash(): BusinessTab {
  const h = window.location.hash ?? ''
  const qIndex = h.indexOf('?')
  if (qIndex === -1) return 'settings'

  const query = h.slice(qIndex + 1)
  const params = new URLSearchParams(query)
  const raw = (params.get('tab') ?? '').toLowerCase().trim()

  if (raw === 'settings') return 'settings'
  if (raw === 'records') return 'records'
  if (raw === 'jobs') return 'jobs'
  if (raw === 'suppliers') return 'suppliers'
  if (raw === 'reports') return 'reports'
  return 'dashboard'
}

function BusinessNav({ current }: { current: BusinessTab }) {
  const isActive = (tab: BusinessTab) => current === tab

  const goSettings = () => {
    window.location.hash = '#business-dashboard?tab=settings'
  }

  return (
    <div
      style={{
        background: theme.topBarBg,
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 14,
        alignItems: 'center',
        borderBottom: `1px solid ${theme.borderSoft}`,
        position: 'sticky',
        top: 0,
        zIndex: 9,
        backdropFilter: 'blur(8px)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 1100, fontSize: 16, marginRight: 6 }}>Business Portal</div>

        <a
          href={'#business-dashboard?tab=dashboard'}
          style={{
            color: isActive('dashboard') ? theme.text : theme.muted,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 1000,
            padding: '6px 8px',
            borderRadius: 10,
            border: `2px solid ${isActive('dashboard') ? theme.text : 'transparent'}`,
            background: isActive('dashboard') ? theme.surface : 'transparent',
            whiteSpace: 'nowrap',
          }}
        >
          Dashboard
        </a>

        {(['records', 'jobs', 'suppliers', 'reports'] as const).map((t) => (
          <a
            key={t}
            href={`#business-dashboard?tab=${encodeURIComponent(t)}`}
            style={{
              color: isActive(t) ? theme.text : theme.muted,
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 1000,
              padding: '6px 8px',
              borderRadius: 10,
              border: `2px solid ${isActive(t) ? theme.text : 'transparent'}`,
              background: isActive(t) ? theme.surface : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
        <a
          href={'#business-dashboard?tab=settings'}
          style={{
            color: isActive('settings') ? theme.text : theme.muted,
            textDecoration: 'none',
            fontSize: 13,
            fontWeight: 1000,
            padding: '6px 8px',
            borderRadius: 10,
            border: `2px solid ${isActive('settings') ? theme.text : 'transparent'}`,
            background: isActive('settings') ? theme.surface : 'transparent',
            whiteSpace: 'nowrap',
          }}
        >
          Account Settings
        </a>

        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('ddworkrecord_business_code')
            window.location.hash = '#business-login'
          }}
          style={{
            padding: '8px 12px',
            border: `2px solid ${theme.text}`,
            background: theme.surface,
            cursor: 'pointer',
            fontWeight: 1000,
            borderRadius: theme.radiusSm,
            boxShadow: `3px 3px 0 ${theme.text}`,
            whiteSpace: 'nowrap',
            color: theme.text,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

const BUSINESS_CODE_LS_KEY = 'ddworkrecord_business_code'

const LS_BUSINESS_ADDRESS = 'ddworkrecord_business_address'
const LS_EMPLOYEE_CODES = 'ddworkrecord_employee_codes_csv'
const LS_VEHICLE_CODES = 'ddworkrecord_vehicle_codes_csv'
const LS_JOB_CODES = 'ddworkrecord_job_codes_csv'
const LS_ASSISTANT_CODES = 'ddworkrecord_assistant_codes_csv'

function scopedKey(baseKey: string, businessCode: string | null): string {
  if (!businessCode) return baseKey
  return `ddworkrecord_business_${businessCode}_${baseKey}`
}

function safeRead(key: string): string {
  try {
    return (localStorage.getItem(key) ?? '').toString()
  } catch {
    return ''
  }
}

function safeWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function SettingsForm() {
  const businessCode = useMemo(() => {
    const raw = safeRead(BUSINESS_CODE_LS_KEY).trim()
    return raw.length ? raw : null
  }, [])

  const sk = (key: string) => scopedKey(key, businessCode)

  const [businessAddress, setBusinessAddress] = useState<string>(() => safeRead(sk(LS_BUSINESS_ADDRESS)))
  const [employeeCodesCsv, setEmployeeCodesCsv] = useState<string>(() => safeRead(sk(LS_EMPLOYEE_CODES)))
  const [vehicleCodesCsv, setVehicleCodesCsv] = useState<string>(() => safeRead(sk(LS_VEHICLE_CODES)))
  const [jobCodesCsv, setJobCodesCsv] = useState<string>(() => safeRead(sk(LS_JOB_CODES)))
  const [assistantCodesCsv, setAssistantCodesCsv] = useState<string>(() => safeRead(sk(LS_ASSISTANT_CODES)))

  const [savedAt, setSavedAt] = useState<number | null>(null)

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 1100, fontSize: 18 }}>Business Settings</div>
      <div style={{ marginTop: 6, color: theme.muted, fontWeight: 850, fontSize: 12 }}>
        Saved locally for now. Next step is wiring these values to tenant-scoped cloud storage + iOS routing.
      </div>

      <div style={{ marginTop: 16, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, padding: 16, background: theme.surface }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Business address (optional)</label>
            <input
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder="e.g. 123 Main St, City"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Employee ID codes (CSV)</label>
            <input
              value={employeeCodesCsv}
              onChange={(e) => setEmployeeCodesCsv(e.target.value)}
              placeholder="EMP-001,EMP-002"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
            <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
              Used by iOS UI to tag synced records with the right employee IDs.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Vehicle IDs (CSV)</label>
            <input
              value={vehicleCodesCsv}
              onChange={(e) => setVehicleCodesCsv(e.target.value)}
              placeholder="VEH-01,VEH-02"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
            <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
              Stored as workday.vehicleId.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Job IDs (CSV)</label>
            <input
              value={jobCodesCsv}
              onChange={(e) => setJobCodesCsv(e.target.value)}
              placeholder="JOB-1001,JOB-1002"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
            <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
              Used by iOS to tag job work entries (jobId).
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Assistant codes (CSV, optional)</label>
            <input
              value={assistantCodesCsv}
              onChange={(e) => setAssistantCodesCsv(e.target.value)}
              placeholder="ASST-01,ASST-02"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: theme.radiusSm,
                border: `2px solid ${theme.text}`,
                fontWeight: 950,
                outline: 'none',
                background: theme.surface,
                color: theme.text,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              safeWrite(sk(LS_BUSINESS_ADDRESS), businessAddress)
              safeWrite(sk(LS_EMPLOYEE_CODES), employeeCodesCsv)
              safeWrite(sk(LS_VEHICLE_CODES), vehicleCodesCsv)
              safeWrite(sk(LS_JOB_CODES), jobCodesCsv)
              safeWrite(sk(LS_ASSISTANT_CODES), assistantCodesCsv)
              setSavedAt(Date.now())
            }}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.text,
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 1100,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
              whiteSpace: 'nowrap',
            }}
          >
            Save settings (local)
          </button>

          {savedAt ? (
            <div style={{ color: theme.muted2, fontWeight: 1000 }}>
              Saved ✓ ({new Date(savedAt).toLocaleTimeString()})
            </div>
          ) : null}
        </div>

        <BusinessWorkerSecretsPanel employeeCodesCsv={employeeCodesCsv} />
      </div>
    </div>
  )
}

function BusinessWorkerSecretsPanel({ employeeCodesCsv }: { employeeCodesCsv: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secrets, setSecrets] = useState<{ employeeCode: string; workerSecret: string }[] | null>(null)

  const employeeCodes = useMemo(() => {
    return employeeCodesCsv
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  }, [employeeCodesCsv])

  const generate = async () => {
    setError(null)
    setBusy(true)
    setSecrets(null)

    try {
      if (employeeCodes.length === 0) {
        setError('Add employee ID codes (CSV) first.')
        return
      }

      const res = await mintWorkerSecrets(employeeCodes)
      setSecrets(res.secrets)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to generate worker secrets.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 1100, fontSize: 18 }}>iOS Worker Secrets</div>
      <div style={{ marginTop: 6, color: theme.muted, fontWeight: 900, fontSize: 12.5 }}>
        Generate the Bearer worker secrets for each EMP code. You will copy/paste these into the iOS Login screen.
      </div>

      <div style={{ marginTop: 12, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, padding: 14, background: theme.surface }}>
        {error ? (
          <div style={{ marginBottom: 12, padding: 12, background: theme.errorBg, borderLeft: `4px solid ${theme.error}`, fontWeight: 950, borderRadius: theme.radiusSm, color: theme.text }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.text,
              color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 1100,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
              whiteSpace: 'nowrap',
            }}
          >
            {busy ? 'Generating…' : `Generate worker secrets (${employeeCodes.length})`}
          </button>

          <button
            type="button"
            onClick={() => {
              setSecrets(null)
              setError(null)
            }}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.borderSoft}`,
              background: theme.surface,
              color: theme.text,
              cursor: 'pointer',
              fontWeight: 1100,
              borderRadius: theme.radiusSm,
              whiteSpace: 'nowrap',
            }}
          >
            Clear
          </button>
        </div>

        {secrets ? (
          <div style={{ marginTop: 14, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, overflow: 'hidden', background: '#fff' }}>
            <div style={{ padding: 10, fontWeight: 1100, color: theme.text, background: theme.pageBg, borderBottom: `2px solid ${theme.borderSoft}` }}>
              Generated secrets
            </div>

            <div style={{ padding: 10, display: 'grid', gap: 10 }}>
              {secrets.map((s) => (
                <div key={s.employeeCode} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 1100, color: theme.text }}>{s.employeeCode}</div>
                    <div style={{ marginTop: 6, fontSize: 12.5, color: theme.muted2, fontWeight: 850, wordBreak: 'break-all' }}>
                      {s.workerSecret}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(s.workerSecret)
                        } catch {
                          // ignore
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        border: `2px solid ${theme.text}`,
                        background: theme.surface,
                        color: theme.text,
                        cursor: 'pointer',
                        fontWeight: 1100,
                        borderRadius: theme.radiusSm,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Copy token
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 1100, fontSize: 18 }}>{title}</div>
      <div style={{ marginTop: 6, color: theme.muted, fontWeight: 900 }}>
        Coming soon — we need tenant-scoped business endpoints to list records/jobs/suppliers/reports.
      </div>
      <div style={{ marginTop: 16, border: `2px dashed ${theme.text}`, borderRadius: theme.radiusMd, padding: 16, background: theme.surface, fontWeight: 900 }}>
        This tab is wired in the UI so the business flow works; backend wiring will follow.
      </div>
    </div>
  )
}

export default function BusinessDashboard() {
  const [period] = useState<Period>('month')
  const [stats, setStats] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [tab, setTab] = useState<BusinessTab>(() => getTabFromHash())

  useEffect(() => {
    const onHash = () => setTab(getTabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const totals = useMemo(() => {
    return {
      totalHours: (stats as any)?.grandTotals?.totalHours ?? 0,
      fuelCost: (stats as any)?.grandTotals?.fuelCost ?? 0,
      supplierSpend: (stats as any)?.grandTotals?.supplierSpend ?? 0,
      totalDistanceKm: (stats as any)?.grandTotals?.totalDistanceKm ?? 0,
    }
  }, [stats])

  const refresh = async () => {
    setError(null)
    setLoading(true)
    try {
      if (isLocalPreviewMode()) {
        const summary = getLocalPreviewSummary(period)
        setStats({
          period,
          grandTotals: {
            totalHours: summary.totalHours,
            totalDistanceKm: summary.totalDistanceKm,
            fuelCost: summary.fuelCost,
            supplierSpend: summary.supplierSpend,
          },
          // keep shape compatible with existing typing
          employees: [],
        } as any)
        return
      }

      const s = await fetchBusinessStats(period)
      setStats(s as any)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load business dashboard.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'dashboard') {
      void refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh', background: theme.pageBg }}>
      <BusinessNav current={tab} />

      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text }}>Business Dashboard</h1>
            <p style={{ marginTop: 6, color: theme.muted, fontWeight: 850 }}>
              Period: {period} {loading ? '(Loading…)' : ''}
            </p>
          </div>

        </div>

        {error && tab === 'dashboard' ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: theme.errorBg,
              borderLeft: `4px solid ${theme.error}`,
              fontWeight: 900,
              borderRadius: theme.radiusSm,
              color: theme.text,
            }}
          >
            {error}
          </div>
        ) : null}

        {tab === 'dashboard' ? (
          <>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <div style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: theme.muted2, fontWeight: 1000 }}>Total hours</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 1000 }}>{round2(totals.totalHours)}</div>
              </div>

              <div style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: theme.muted2, fontWeight: 1000 }}>Total distance (km)</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 1000 }}>{round2(totals.totalDistanceKm)}</div>
              </div>

              <div style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: theme.muted2, fontWeight: 1000 }}>Fuel cost</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 1000 }}>{round2(totals.fuelCost)}</div>
              </div>

              <div style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: theme.muted2, fontWeight: 1000 }}>Supplier spend</div>
                <div style={{ marginTop: 6, fontSize: 28, fontWeight: 1000 }}>{round2(totals.supplierSpend)}</div>
              </div>
            </div>

            <div style={{ marginTop: 18, color: theme.muted2, fontWeight: 900, fontSize: 12 }}>
              This MVP business dashboard is code-access only. Tenant isolation is enforced by the access code on the server.
            </div>
          </>
        ) : null}

        {tab === 'settings' ? <SettingsForm /> : null}
        {tab === 'records' ? <ComingSoon title="Records" /> : null}
        {tab === 'jobs' ? <ComingSoon title="Jobs" /> : null}
        {tab === 'suppliers' ? <ComingSoon title="Suppliers" /> : null}
        {tab === 'reports' ? <ComingSoon title="Reports" /> : null}
      </div>
    </div>
  )
}
