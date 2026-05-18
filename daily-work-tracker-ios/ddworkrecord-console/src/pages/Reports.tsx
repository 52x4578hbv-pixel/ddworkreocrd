import { useEffect, useMemo, useState } from 'react'
import { type Period, API_BASE_URL } from '../lib/api'
import { getLocalPreviewSummary, getLocalPreviewWorkdays } from '../lib/localPreviewData'
import { getDefaultEmployeeCount, getDefaultAssistantCount, getEmployeeCodes, getAssistantCodes, getAssistantIndexForEmployee } from '../lib/localPreviewSeed'
import { theme } from '../lib/theme'

type SyncStatus = 'idle' | 'exporting' | 'error'

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

async function fetchXlsxExport(params: { startDate: string; endDate: string; employeeCode?: string | null }, token: string | null) {
  const qs = new URLSearchParams()
  qs.set('startDate', params.startDate)
  qs.set('endDate', params.endDate)
  if (params.employeeCode) qs.set('employeeCode', params.employeeCode)

  const base = API_BASE_URL?.trim() || ''
  const url = `${base}/api/v1/console/reports/export/xlsx?${qs.toString()}`
  const res = await fetch(url, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Export failed: ${res.status} ${text}`.trim())
  }

  const blob = await res.blob()
  return blob
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('week')

  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const ASSISTANT_COUNT = getDefaultAssistantCount()

  // Date controls for export (backend needs YYYY-MM-DD)
  const today = useMemo(() => new Date(), [])
  const [startDate, setStartDate] = useState<string>(() => toIsoDate(addDays(today, -7)))
  const [endDate, setEndDate] = useState<string>(() => toIsoDate(today))

  // UI filter for on-screen summary:
  // - '' => all employees
  // - 'EMP:EMP-001' => employee only
  // - 'AS:AS-001' => assistant only (computed from assigned employees’ logs; display-only)
  const [filterKey, setFilterKey] = useState<string>('') // optional

  const [liveWorkdays, setLiveWorkdays] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const localPreview = !localStorage.getItem('ddworkrecord_admin_token')

  useEffect(() => {
    if (localPreview) return

    const fetchCloudRecords = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('ddworkrecord_admin_token')
        const base = API_BASE_URL?.trim() || ''
        const res = await fetch(`${base}/api/v1/console/workdays`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setLiveWorkdays(data)
        }
      } catch (e) {
        console.error('Failed to fetch cloud records', e)
      } finally {
        setLoading(false)
      }
    }

    void fetchCloudRecords()
  }, [localPreview])

  const summary = useMemo(() => {
    const workdays = localPreview ? getLocalPreviewWorkdays() : liveWorkdays

    const filtered = (() => {
      if (!filterKey.trim()) return workdays

      if (filterKey.startsWith('EMP:')) {
        const empCode = filterKey.slice('EMP:'.length)
        return empCode ? workdays.filter((w) => w.employeeCode === empCode) : workdays
      }

      if (filterKey.startsWith('AS:')) {
        const assistantCode = filterKey.slice('AS:'.length) // AS-xxx
        const assistantIndex1Based = Number(/^AS-(\d+)$/.exec(assistantCode)?.[1] ?? '')
        if (!Number.isFinite(assistantIndex1Based) || assistantIndex1Based < 1) return []

        const employeeCodes = getEmployeeCodes(EMPLOYEE_COUNT)
        const employeesAssigned: string[] = []
        for (let i = 0; i < employeeCodes.length; i++) {
          const employeeIndex1Based = i + 1
          const mappedAssistantIndex = getAssistantIndexForEmployee(employeeIndex1Based, ASSISTANT_COUNT)
          if (mappedAssistantIndex === assistantIndex1Based) employeesAssigned.push(employeeCodes[i])
        }
        const set = new Set(employeesAssigned)
        return workdays.filter((w) => set.has(w.employeeCode))
      }

      return workdays
    })()

    const totalHours = filtered.reduce((acc, w) => acc + (Number.isFinite(w.totalHours) ? w.totalHours : 0), 0)
    const totalDistanceKm = filtered.reduce((acc, w) => acc + (Number.isFinite(w.totalDistanceKm) ? w.totalDistanceKm : 0), 0)
    const fuelCost = filtered.reduce((acc, w) => acc + (Number.isFinite(w.fuelCost) ? w.fuelCost : 0), 0)
    const supplierSpend = filtered.reduce((acc, w) => acc + (Number.isFinite(w.supplierSpend) ? w.supplierSpend : 0), 0)

    return { period, totalHours, totalDistanceKm, fuelCost, supplierSpend, count: filtered.length }
  }, [period, filterKey, EMPLOYEE_COUNT, ASSISTANT_COUNT])

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const doExportXlsx = async () => {
    setError(null)
    setSyncStatus('exporting')

    try {
      const token = localStorage.getItem('ddworkrecord_admin_token')
      if (!token) throw new Error('Missing admin session. Open #/login and sign in (Google or email/password).')

      const blob = await fetchXlsxExport(
        {
          startDate,
          endDate,
          employeeCode: null,
        },
        token
      )

      const filename = `workday_reports_${startDate}_to_${endDate}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export error'
      setError(message)
      setSyncStatus('error')
    } finally {
      if (!error) setSyncStatus('idle')
    }
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui',
        padding: 24,
        maxWidth: 980,
        margin: '0 auto',
        background: theme.pageBg,
        minHeight: '100vh',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Reports</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            {summary.period.toUpperCase()} summary. Excel export uses the backend XLSX generator.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              style={{
                padding: '10px 12px',
                border: '2px solid #0f172a',
                background: period === p ? '#0f172a' : '#fff',
                color: period === p ? '#fff' : '#0f172a',
                cursor: 'pointer',
                fontWeight: 1000,
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: theme.errorBg,
            borderLeft: `4px solid ${theme.error}`,
            fontWeight: 900,
            borderRadius: theme.radiusSm,
            color: theme.errorDark,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Workdays</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{summary.count}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total hours</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{summary.totalHours}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total mileage (km)</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{summary.totalDistanceKm}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel cost</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{summary.fuelCost}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier spend</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{summary.supplierSpend}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
        <div style={{ fontWeight: 1000 }}>Export to Excel (XLSX)</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 850, fontSize: 12 }}>
          Backend export requires an admin session. Open #/login and sign in (Google or email/password).
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }}>Start date</label>
            <input
              title="Start date"
              aria-label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: 10, border: '2px solid #0f172a', borderRadius: 10, fontWeight: 900 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }}>End date</label>
            <input
              title="End date"
              aria-label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: 10, border: '2px solid #0f172a', borderRadius: 10, fontWeight: 900 }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }}>Filter (summary)</label>
                <select
                  aria-label="Filter (summary)"
                  value={filterKey}
                  onChange={(e) => setFilterKey(e.target.value)}
                  style={{ width: '100%', padding: 10, border: '2px solid #0f172a', borderRadius: 10, fontWeight: 900, background: '#fff' }}
                >
                  <option value="">All employees + assistants</option>

                  {/* Employees */}
                  {getEmployeeCodes(EMPLOYEE_COUNT).map((c) => (
                    <option key={c} value={`EMP:${c}`}>
                      Employee {c}
                    </option>
                  ))}

                  {/* Assistants */}
                  {getAssistantCodes(ASSISTANT_COUNT).map((c) => (
                    <option key={c} value={`AS:${c}`}>
                      Assistant {c}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
                  Assistant summary is computed from assigned employees’ logs (display-only).
                </div>
              </div>

            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void doExportXlsx()}
            disabled={syncStatus === 'exporting'}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              cursor: syncStatus === 'exporting' ? 'not-allowed' : 'pointer',
              fontWeight: 1000,
              opacity: syncStatus === 'exporting' ? 0.7 : 1,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
              whiteSpace: 'nowrap',
            }}
          >
            {syncStatus === 'exporting' ? 'Exporting…' : 'Export XLSX'}
          </button>

          <div style={{ color: theme.muted2, fontWeight: 800, fontSize: 12 }}>
            Exports: RawData + Summary sheets.
          </div>
        </div>
      </div>
    </div>
  )
}
