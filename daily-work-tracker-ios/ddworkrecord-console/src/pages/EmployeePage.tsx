import { useEffect, useMemo, useState } from 'react'
import { fetchStats, type Period } from '../lib/api'
import { isLocalPreviewMode } from '../lib/localPreview'
import { getLocalPreviewMonthBreakdownBase, type LocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import { getEmployeeMultiplier, getDefaultEmployeeCount, getEmployeeProfiles } from '../lib/localPreviewSeed'
import { theme } from '../lib/theme'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

function parseEmployeeCode(raw: string | null, employeeCount: number): string | null {
  // expects: #employee/EMP-00X up to configured range
  if (!raw) return null
  const m = /^EMP-(\d{3})$/.exec(raw)
  if (!m) return null
  const idx = Number(m[1])
  if (!Number.isFinite(idx)) return null
  if (idx < 1 || idx > employeeCount) return null
  return `EMP-${m[1]}`
}

export default function EmployeePage() {
  const localPreview = isLocalPreviewMode()
  const [period] = useState<Period>('month')
  const employeeCount = getDefaultEmployeeCount()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const employeeCode = useMemo(() => {
    // Extract hash part specifically for this page
    const h = window.location.hash.split('?')[0].replace('#', '').replace(/^\//, '')
    const parts = h.split('/')
    const maybeCode = parts.length >= 2 ? parts[1] : null
    return parseEmployeeCode(maybeCode, employeeCount)
  }, [window.location.hash, employeeCount])

  const [statsGrandTotals, setStatsGrandTotals] = useState<{
    totalHours: number
    fuelCost: number
    supplierSpend: number
  } | null>(null)

  const localBase: LocalPreviewMonthBreakdownBase = useMemo(() => getLocalPreviewMonthBreakdownBase(), [])
  const employeeProfile = useMemo(() => {
    if (!employeeCode) return null
    const profiles = getEmployeeProfiles()
    return profiles.find((p) => p.code === employeeCode) ?? null
  }, [employeeCode])

  useEffect(() => {
    if (!employeeCode) return
    let cancelled = false

    const run = async () => {
      setError(null)
      setLoading(true)
      try {
        if (!localPreview) {
          const s = await fetchStats(period)
          if (cancelled) return
          setStatsGrandTotals({
            totalHours: s.grandTotals?.totalHours ?? 0,
            fuelCost: s.grandTotals?.fuelCost ?? 0,
            supplierSpend: s.grandTotals?.supplierSpend ?? 0,
          })
        }
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Unknown error'
        setError(message)
      } finally {
        if (cancelled) return
        setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [employeeCode, localPreview, period])

  const localRow = useMemo(() => {
    if (!employeeCode) return null
    const m = /^EMP-(\d+)$/.exec(employeeCode)
    const employeeIndex1Based = m ? Number(m[1]) : 1
    const multiplier = getEmployeeMultiplier(employeeIndex1Based)

    const totalHours = round2(localBase.totalHours * multiplier)
    const normalHours = round2(localBase.normalHours * multiplier)
    const weekdayOvertimeHours = round2(localBase.weekdayOvertimeHours * multiplier)
    const saturdayHours = round2(localBase.saturdayHours * multiplier)
    const sundayHours = round2(localBase.sundayHours * multiplier)
    const publicHolidayHours = round2(localBase.publicHolidayHours * multiplier)

    return {
      multiplier,
      totalHours,
      normalHours,
      weekdayOvertimeHours,
      saturdayHours,
      sundayHours,
      publicHolidayHours,
    }
  }, [employeeCode, localBase])

  if (!employeeCode) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Employee</div>
        <div style={{ marginTop: 10, color: '#ef4444', fontWeight: 900 }}>
          Missing/invalid employee code in URL hash. Expected: <span style={{ fontFamily: 'ui-monospace' }}>#employee/EMP-001</span> (through EMP-{String(employeeCount).padStart(3, '0')})
        </div>
      </div>
    )
  }

  const backToDashboard = () => {
    // If we're in local preview, go back to the sandbox shell, otherwise main dashboard
    window.location.hash = localPreview ? '#local-preview' : '#dashboard'
  }

  const fuelSharePreview = useMemo(() => {
    if (!localRow) return 0
    const idx = employeeCode ? Number(/^EMP-(\d+)$/.exec(employeeCode)?.[1] ?? '1') : 1
    const sumMultiplier = Array.from({ length: employeeCount }, (_, i) => getEmployeeMultiplier(i + 1)).reduce(
      (a, b) => a + b,
      0
    )
    const pct = localRow.multiplier / sumMultiplier
    return pct
  }, [localRow, employeeCode])

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Employee Detail</div>
          <div style={{ marginTop: 6, color: '#475569', fontWeight: 900 }}>
            Employee: {employeeCode}
            {employeeProfile ? (
              <span style={{ marginLeft: 10, color: '#0f172a', fontWeight: 1000, fontSize: 13 }}>
                {employeeProfile.firstName} {employeeProfile.lastName}
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {localPreview ? 'Sandbox template only • no cloud writes' : 'Cloud-driven totals (if available)'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={backToDashboard}
            style={{
              padding: '8px 12px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              cursor: 'pointer',
              fontWeight: 900,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
            }}
          >
            ← Back
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: theme.errorBg,
            borderLeft: `4px solid ${theme.error}`,
            fontWeight: 900,
            color: theme.text,
            borderRadius: theme.radiusSm,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 18, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: `2px solid ${theme.text}`, background: theme.accentBg }}>
          <div style={{ fontWeight: 1000 }}>Hours & Pay (Month)</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>{loading ? 'Loading…' : 'Details view'}</div>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total Hours</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.totalHours) : '—'}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Normal Hours (Mon–Fri 07:30–16:30)</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.normalHours) : '—'}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Overtime Hours (Mon–Fri outside normal)</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {localRow ? format2(localRow.weekdayOvertimeHours) : '—'}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Saturday Hours</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.saturdayHours) : '—'}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Sunday Hours</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.sundayHours) : '—'}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Public Holiday Hours</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {localRow ? format2(localRow.publicHolidayHours) : '—'}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel / Supplier Share (preview)</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 1000 }}>
              {localPreview
                ? `${Math.round(fuelSharePreview * 100)}% of totals`
                : statsGrandTotals
                  ? 'Available via cloud totals'
                  : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Section (per-employee template) */}
      <div style={{ marginTop: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
          <div style={{ fontWeight: 1000 }}>Expenses (Month)</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>Template-only • deterministic</div>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel (template)</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {localRow ? format2(localBase.fuelCost * localRow.multiplier) : '—'}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier (template)</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {localRow ? format2(localBase.supplierSpend * localRow.multiplier) : '—'}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel + Supplier</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {localRow ? format2(localBase.fuelCost * localRow.multiplier + localBase.supplierSpend * localRow.multiplier) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
        This is a template “playground” details page. Hooking real employee-day data can be done later.
      </div>
    </div>
  )
}
