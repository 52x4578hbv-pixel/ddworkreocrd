import { useMemo, useState } from 'react'
import { type Period, API_BASE_URL } from '../lib/api'
import { getLocalPreviewWorkdays } from '../lib/localPreviewData'

type SupplierJobStatus = 'complete' | 'return-required'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toPeriodDays(period: Period): number {
  if (period === 'day') return 1
  if (period === 'week') return 7
  return 31
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

async function fetchXlsxExport(params: { startDate: string; endDate: string }, token: string | null) {
  const qs = new URLSearchParams()
  qs.set('startDate', params.startDate)
  qs.set('endDate', params.endDate)

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

export default function SupplierReports() {
  const [period, setPeriod] = useState<Period>('week')
  const workdays = getLocalPreviewWorkdays()

  const today = useMemo(() => new Date(), [])
  const start = useMemo(() => {
    const x = new Date(today)
    x.setDate(x.getDate() - toPeriodDays(period))
    return x
  }, [period, today])

  const filtered = useMemo(() => {
    return workdays.filter((w) => {
      const d = new Date(`${w.date}T00:00:00`)
      return d >= start
    })
  }, [workdays, start])

  const totals = useMemo(() => {
    const supplierSpend = filtered.reduce((acc, w) => acc + (Number.isFinite(w.supplierSpend) ? w.supplierSpend : 0), 0)

    const supplierStopCount = filtered.reduce((acc, w) => acc + (w.supplierStops?.length ?? 0), 0)

    const byJobStatus = filtered.reduce(
      (acc, w) => {
        const status = w.jobStatus as SupplierJobStatus
        acc[status] += w.supplierSpend
        return acc
      },
      { complete: 0, 'return-required': 0 } as Record<SupplierJobStatus, number>
    )

    return {
      workdays: filtered.length,
      supplierSpend: round2(supplierSpend),
      supplierStopCount,
      completeSpend: round2(byJobStatus.complete),
      returnSpend: round2(byJobStatus['return-required']),
    }
  }, [filtered])

  // XLSX export controls
  const [startDate, setStartDate] = useState<string>(() => toIsoDate(addDays(today, -7)))
  const [endDate, setEndDate] = useState<string>(() => toIsoDate(today))

  const [syncStatus, setSyncStatus] = useState<'idle' | 'exporting' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const doExportXlsx = async () => {
    setError(null)
    setSyncStatus('exporting')

    try {
      const token = localStorage.getItem('ddworkrecord_admin_token')
      if (!token) throw new Error('Missing admin token. Open the Token Viewer and paste an admin JWT.')

      const blob = await fetchXlsxExport({ startDate, endDate }, token)
      const filename = `supplier_reports_${startDate}_to_${endDate}.xlsx`

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
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Supplier Reports</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            {period.toUpperCase()} summary computed from local preview data
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
            background: '#fee2e2',
            borderLeft: '4px solid #ef4444',
            fontWeight: 900,
            borderRadius: 8,
            color: '#7f1d1d',
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier workdays</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{totals.workdays}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier spend</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{totals.supplierSpend}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier stop count</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{totals.supplierStopCount}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Complete spend</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{totals.completeSpend}</div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Return-required spend</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{totals.returnSpend}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
        Note: This uses the local preview dataset’s supplier spend (template data). Real segment-level supplier timing can be wired later.
      </div>

      <div style={{ marginTop: 18, padding: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
        <div style={{ fontWeight: 1000 }}>Export to Excel (XLSX)</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 850, fontSize: 12 }}>
          Backend export uses the same XLSX generator as Employee Reports.
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }}>Start date</label>
            <input
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
              aria-label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: 10, border: '2px solid #0f172a', borderRadius: 10, fontWeight: 900 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void doExportXlsx()}
            disabled={syncStatus === 'exporting'}
            style={{
              padding: '12px 16px',
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: syncStatus === 'exporting' ? 'not-allowed' : 'pointer',
              fontWeight: 1000,
              opacity: syncStatus === 'exporting' ? 0.7 : 1,
            }}
          >
            {syncStatus === 'exporting' ? 'Exporting…' : 'Export XLSX'}
          </button>
        </div>
      </div>
    </div>
  )
}
