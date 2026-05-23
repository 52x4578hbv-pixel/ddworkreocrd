import { useEffect, useMemo, useState } from 'react'
import { fetchLiveLocations, fetchStats, getAdminToken, type Period } from '../lib/api'
import { fetchBusinessStats } from '../lib/businessApi'
import { isLocalPreviewMode } from '../lib/localPreview'
import { getLocalPreviewMonthBreakdownBase, type LocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import { theme } from '../lib/theme'
import {
  ensureSeededLocalPreview,
  getEmployeeCodes,
  getEmployeeMultiplier,
  getDefaultEmployeeCount,
  getDefaultAssistantCount,
  getAssistantCodes,
  getAssistantIndexForEmployee,
  getAssistantProfiles,
} from '../lib/localPreviewSeed'

type StatsResponse = {
  period: Period
  grandTotals?: {
    totalHours: number
    totalDistanceKm: number
    fuelCost: number
    supplierSpend: number
  }
}

function GraphBar(props: { label: string; value: number; max: number }) {
  const value = Number.isFinite(props.value) ? props.value : 0
  const max = Math.max(1, Number.isFinite(props.max) ? props.max : 1)
  const pct = Math.max(0, Math.min(100, (value / max) * 100))

  return (
    <div style={{ padding: 10, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontWeight: 1000, color: theme.text }}>{props.label}</div>
        <div style={{ fontWeight: 1000, color: theme.text }}>{format2(value)}</div>
      </div>

      <div
        style={{
          marginTop: 8,
          height: 14,
          border: '2px solid #0f172a',
          borderRadius: 999,
          background: '#f1f5f9',
          overflow: 'hidden',
        }}
      >
        <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRight: '2px solid #0f172a' }} />
      </div>

      <div style={{ marginTop: 8, color: '#64748b', fontWeight: 800, fontSize: 12 }}>{Math.round(pct)}%</div>
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

function getBusinessCode(): string | null {
  try {
    return localStorage.getItem('ddworkrecord_business_code')
  } catch {
    return null
  }
}

export default function DashboardLocalPreview() {
  const [period] = useState<Period>('month')
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const businessCode = getBusinessCode()

  useEffect(() => {
    if (!isLocalPreviewMode()) return
    ensureSeededLocalPreview()
    setRefreshTick((t) => t + 1)
  }, [])

  const localPreview = isLocalPreviewMode()
  const localBase: LocalPreviewMonthBreakdownBase = useMemo(() => getLocalPreviewMonthBreakdownBase(), [refreshTick])

  const employeeCodes = useMemo(() => getEmployeeCodes(getDefaultEmployeeCount()), [refreshTick])
  const assistantCodes = useMemo(() => getAssistantCodes(getDefaultAssistantCount()), [refreshTick])

  const employeeRows = useMemo(() => {
    const codes = employeeCodes
    return codes.map((code, idx) => {
      const m = getEmployeeMultiplier(idx + 1)

      const totalHours = round2(localBase.totalHours * m)
      const normalHours = round2(localBase.normalHours * m)
      const weekdayOvertimeHours = round2(localBase.weekdayOvertimeHours * m)
      const saturdayHours = round2(localBase.saturdayHours * m)
      const sundayHours = round2(localBase.sundayHours * m)
      const publicHolidayHours = round2(localBase.publicHolidayHours * m)

      return {
        employeeCode: code,
        totalHours,
        normalHours,
        weekdayOvertimeHours,
        saturdayHours,
        sundayHours,
        publicHolidayHours,
        multiplier: m,
      }
    })
  }, [localBase, employeeCodes])

  // Template totals
  const displayedStats = useMemo(() => {
    const sumMultiplier = Array.from({ length: employeeCodes.length }, (_, i) => getEmployeeMultiplier(i + 1)).reduce((a, b) => a + b, 0)
    return {
      totalHours: employeeRows.reduce((acc, e) => acc + e.totalHours, 0),
      fuelCost: Math.round(localBase.fuelCost * sumMultiplier * 100) / 100,
      supplierSpend: Math.round(localBase.supplierSpend * sumMultiplier * 100) / 100,
    }
  }, [localBase, employeeRows, employeeCodes])

  const assistantProfiles = useMemo(() => {
    try {
      if (!businessCode) return getAssistantProfiles()

      const raw = localStorage.getItem(`ddworkrecord_business_${businessCode}_ddworkrecord_assistant_profiles_json`) ?? ''
      if (!raw) return getAssistantProfiles()

      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return getAssistantProfiles()

      const profiles = parsed
        .map((item) => item as Record<string, unknown>)
        .filter((v) => typeof v === 'object' && v !== null)
        .map((v) => {
          const codeRaw = v.code
          const firstRaw = v.firstName
          const lastRaw = v.lastName
          if (typeof codeRaw !== 'string' || typeof firstRaw !== 'string' || typeof lastRaw !== 'string') return null
          return { code: codeRaw.trim().toUpperCase(), firstName: firstRaw.trim(), lastName: lastRaw.trim() }
        })
        .filter((p): p is { code: string; firstName: string; lastName: string } => p !== null)

      return profiles.length ? profiles : getAssistantProfiles()
    } catch {
      return getAssistantProfiles()
    }
  }, [businessCode, refreshTick])

  const assistantRows = useMemo(() => {
    if (!assistantCodes.length) return []

    const assistantCount = assistantCodes.length
    const totalsByAssistant = assistantCodes.map((assistantCode) => ({
      assistantCode,
      totalHours: 0,
      normalHours: 0,
      weekdayOvertimeHours: 0,
      saturdayHours: 0,
      sundayHours: 0,
      publicHolidayHours: 0,
    }))

    for (let i = 0; i < employeeRows.length; i++) {
      const employeeIndex1Based = i + 1
      const assistantIndex1Based = getAssistantIndexForEmployee(employeeIndex1Based, assistantCount)
      const row = employeeRows[i]
      const target = totalsByAssistant[assistantIndex1Based - 1]

      target.totalHours += row.totalHours
      target.normalHours += row.normalHours
      target.weekdayOvertimeHours += row.weekdayOvertimeHours
      target.saturdayHours += row.saturdayHours
      target.sundayHours += row.sundayHours
      target.publicHolidayHours += row.publicHolidayHours
    }

    return totalsByAssistant.map((r) => ({
      ...r,
      totalHours: round2(r.totalHours),
      normalHours: round2(r.normalHours),
      weekdayOvertimeHours: round2(r.weekdayOvertimeHours),
      saturdayHours: round2(r.saturdayHours),
      sundayHours: round2(r.sundayHours),
      publicHolidayHours: round2(r.publicHolidayHours),
    }))
  }, [employeeRows, assistantCodes])

  const refresh = async () => {
    setError(null)
    setLoading(true)
    try {
      // In local preview we always ensure seeded drafts exist and then re-render derived totals.
      if (localPreview) {
        ensureSeededLocalPreview()
        setRefreshTick((t) => t + 1)
        return
      }

      // Keep legacy behavior in case this component is ever rendered in live mode.
      const adminToken = getAdminToken()
      if (!localPreview && adminToken) {
        const s = await fetchStats(period)
        setStats(s)
        await fetchLiveLocations().catch(() => undefined)
      } else if (!localPreview && businessCode) {
        const s = await fetchBusinessStats(period)
        setStats(s as unknown as StatsResponse)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const totalFuelForCharts = displayedStats.fuelCost
  const totalSupplierForCharts = displayedStats.supplierSpend

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Main Dashboard</h1>
          <p style={{ marginTop: 6, color: '#475569' }}>Month view (Sandbox Mode)</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void refresh()}
            style={{
              padding: '8px 12px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              cursor: 'pointer',
              fontWeight: 900,
              borderRadius: theme.radiusSm,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('ddworkrecord_admin_token')
              localStorage.removeItem('ddworkrecord_business_code')
              window.location.hash = '#home'
            }}
            style={{
              padding: '8px 12px',
              border: `2px solid ${theme.error}`,
              background: theme.surface,
              cursor: 'pointer',
              fontWeight: 900,
              color: theme.error,
              borderRadius: theme.radiusSm,
            }}
          >
            Logout
          </button>

          <button
            onClick={() => {
              window.location.hash = '#add'
            }}
            style={{
              padding: '10px 14px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              cursor: 'pointer',
              fontWeight: 1000,
              borderRadius: theme.radiusSm,
            }}
          >
            Add New Record
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

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Current Employees</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
          Total hours / Normal (Mon–Fri 07:30–16:30) / Overtime (Mon–Fri outside) / Sat / Sun / Public Holiday
        </div>

        <div style={{ marginTop: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: theme.pageBg }}>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>Employee</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>1) Total</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>2) Normal</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>3) Overtime (Mon–Fri)</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>4) Saturday</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>5) Sunday</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: `2px solid ${theme.text}`, fontWeight: 1000, color: theme.text }}>6) Public Holiday</th>
              </tr>
            </thead>
            <tbody>
              {employeeRows.map((row) => (
                <tr key={row.employeeCode}>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.hash = `#employee/${row.employeeCode}`
                      }}
                      style={{
                        display: 'inline-block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        border: '2px solid #0f172a',
                        borderRadius: 10,
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 1000,
                        color: '#0f172a',
                      }}
                    >
                      {row.employeeCode}
                    </button>
                  </td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.totalHours)}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.normalHours)}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.weekdayOvertimeHours)}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.saturdayHours)}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.sundayHours)}</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.publicHolidayHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Assistants (Hours)</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
          Local preview only • assistant hours are computed from assigned employees’ logs (no assistant records saved)
        </div>

        <div style={{ marginTop: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Assistant</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>1) Total</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>2) Normal</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>3) Overtime (Mon–Fri)</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>4) Saturday</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>5) Sunday</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>6) Public Holiday</th>
              </tr>
            </thead>
            <tbody>
              {assistantRows.length ? (
                assistantRows.map((row) => (
                  <tr key={row.assistantCode}>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.hash = `#assistant/${row.assistantCode}`
                        }}
                        style={{
                          display: 'inline-block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          border: '2px solid #0f172a',
                          borderRadius: 10,
                          background: '#fff',
                          cursor: 'pointer',
                          fontWeight: 1000,
                          color: '#0f172a',
                        }}
                      >
                        {(() => {
                          const code = row.assistantCode.toUpperCase()
                          const match = assistantProfiles.find((p) => p.code.toUpperCase() === code)
                          const first = match?.firstName?.trim()
                          const last = match?.lastName?.trim()

                          if (first || last) return `${row.assistantCode} (${[first, last].filter(Boolean).join(' ')})`
                          return row.assistantCode
                        })()}
                      </button>
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.totalHours)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.normalHours)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.weekdayOvertimeHours)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.saturdayHours)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.sundayHours)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.publicHolidayHours)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 900 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Expenses (All Employees)</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>Fuel + Supplier</div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Fuel Expenses</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>{format2(displayedStats.fuelCost)}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Supplier Expenses</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>{format2(displayedStats.supplierSpend)}</div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Expenses (Fuel + Supplier)</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>{format2(displayedStats.fuelCost + displayedStats.supplierSpend)}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Quick Visuals</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>Quick charts for design iteration (sandbox-safe)</div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 900 }}>Fuel expenses</div>
            <div style={{ marginTop: 8 }}>
              <GraphBar label="Fuel" value={round2(totalFuelForCharts)} max={Math.max(1, round2(totalFuelForCharts))} />
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 900 }}>Supplier expenses</div>
            <div style={{ marginTop: 8 }}>
              <GraphBar label="Spend" value={round2(totalSupplierForCharts)} max={Math.max(1, round2(totalSupplierForCharts))} />
            </div>
          </div>
        </div>
      </div>

      {/**
       * NOTE: iOS has its own pages for employee/assistant detail views;
       * those pages also use local preview modules. This split only affects
       * bundling of template seed code into the main live dashboard entry.
       */}
    </div>
  )
}
