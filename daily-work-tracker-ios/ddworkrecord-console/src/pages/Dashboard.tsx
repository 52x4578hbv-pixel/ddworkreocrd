import { useEffect, useMemo, useState } from 'react'
import { fetchLiveLocations, fetchStats, type Period } from '../lib/api'
import { isLocalPreviewMode } from '../lib/localPreview'
import { getLocalPreviewMonthBreakdownBase, type LocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import {
  getEmployeeCodes,
  getEmployeeMultiplier,
  getDefaultEmployeeCount,
  getDefaultAssistantCount,
  getAssistantCodes,
  getAssistantIndexForEmployee,
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
    <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontWeight: 1000 }}>{props.label}</div>
        <div style={{ fontWeight: 1000 }}>{format2(value)}</div>
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

const EMPLOYEE_COUNT = getDefaultEmployeeCount()

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

export default function Dashboard() {
  const [period] = useState<Period>('month')
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const localPreview = isLocalPreviewMode()

  const localBase: LocalPreviewMonthBreakdownBase = getLocalPreviewMonthBreakdownBase()

  const employeeRows = useMemo(() => {
    const codes = getEmployeeCodes(EMPLOYEE_COUNT)

    return codes.map((code, idx) => {
      const m = getEmployeeMultiplier(idx + 1)
      const totalHours = round2(localBase.totalHours * m)
      const normalHours = round2(localBase.normalHours * m)
      const overtimeHours = round2(localBase.overtimeHours * m)
      return { employeeCode: code, totalHours, normalHours, overtimeHours, multiplier: m }
    })
  }, [localBase])

  // Non-sandbox totals fallback (cloud-driven)
  const cloudTotals = useMemo(() => {
    return {
      totalHours: stats?.grandTotals?.totalHours ?? 0,
      fuelCost: stats?.grandTotals?.fuelCost ?? 0,
      supplierSpend: stats?.grandTotals?.supplierSpend ?? 0,
    }
  }, [stats])

  const assistantRows = useMemo(() => {
    if (!localPreview) return null
    const assistantCount = getDefaultAssistantCount()
    const assistantCodes = getAssistantCodes(assistantCount)

    const totalsByAssistant = assistantCodes.map((assistantCode) => ({
      assistantCode,
      totalHours: 0,
      normalHours: 0,
      overtimeHours: 0,
    }))

    for (let i = 0; i < employeeRows.length; i++) {
      const employeeIndex1Based = i + 1
      const assistantIndex1Based = getAssistantIndexForEmployee(employeeIndex1Based, assistantCount)
      const row = employeeRows[i]
      const target = totalsByAssistant[assistantIndex1Based - 1]
      target.totalHours += row.totalHours
      target.normalHours += row.normalHours
      target.overtimeHours += row.overtimeHours
    }

    return totalsByAssistant.map((r) => ({
      ...r,
      totalHours: round2(r.totalHours),
      normalHours: round2(r.normalHours),
      overtimeHours: round2(r.overtimeHours),
    }))
  }, [employeeRows, localPreview])

  const displayedStats = useMemo(() => {
    if (localPreview) {
      const sumMultiplier = Array.from({ length: EMPLOYEE_COUNT }, (_, i) => getEmployeeMultiplier(i + 1)).reduce(
        (a, b) => a + b,
        0
      )
      return {
        totalHours: employeeRows.reduce((acc, e) => acc + e.totalHours, 0),
        fuelCost: Math.round(localBase.fuelCost * sumMultiplier * 100) / 100,
        supplierSpend: Math.round(localBase.supplierSpend * sumMultiplier * 100) / 100,
      }
    }
    return cloudTotals
  }, [localPreview, localBase, cloudTotals, employeeRows])

  const refresh = async () => {
    setError(null)
    setLoading(true)
    try {
      const s = await fetchStats(period)
      setStats(s)
      await fetchLiveLocations().catch(() => undefined)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalHoursForCharts = displayedStats.totalHours
  const totalFuelForCharts = displayedStats.fuelCost
  const totalSupplierForCharts = displayedStats.supplierSpend

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Main Dashboard</h1>
          <p style={{ marginTop: 6, color: '#475569' }}>Month view {localPreview ? '(Sandbox Mode)' : '(Live Data)'}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void refresh()}
            style={{
              padding: '8px 12px',
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('ddworkrecord_admin_token')
              window.location.hash = '#login'
            }}
            style={{
              padding: '8px 12px',
              border: '2px solid #ef4444',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
              color: '#dc2626',
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
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 900,
            }}
          >
            Add New Record
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      {/* Current Employees Table + Hours Summary */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Current Employees</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
          Total hours / normal hours (7am-5pm) / overtime (outside 7am-5pm)
        </div>

        <div style={{ marginTop: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Employee</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>1) Total Hours</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>2) Normal Hours</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>3) Overtime Hours</th>
              </tr>
            </thead>
            <tbody>
              {localPreview ? (
                employeeRows.map((row) => {
                  return (
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
                      <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(row.overtimeHours)}</td>
                        </tr>
                  )
                })
              ) : (
                stats ? (
                  <tr>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 900 }}>Cloud Aggregate Summary</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>{format2(cloudTotals.totalHours)} hrs</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#64748b', fontWeight: 800 }}>
                      {loading ? 'Refreshing cloud metrics...' : 'No cloud data available. Log in and sync to begin.'}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assistants (display-only hours attribution) */}
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
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>1) Total Hours</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>2) Normal Hours</th>
                <th style={{ textAlign: 'right', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>3) Overtime Hours</th>
              </tr>
            </thead>
            <tbody>
              {localPreview && assistantRows ? (
                assistantRows.map((row) => (
                  <tr key={row.assistantCode}>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                      <div
                        style={{
                          display: 'inline-block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 8px',
                          border: '2px solid #0f172a',
                          borderRadius: 10,
                          background: '#fff',
                          cursor: 'default',
                          fontWeight: 1000,
                          color: '#0f172a',
                        }}
                      >
                        {row.assistantCode}
                      </div>
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>
                      {format2(row.totalHours)}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>
                      {format2(row.normalHours)}
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>
                      {format2(row.overtimeHours)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 900 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                  <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1000 }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses Section */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Expenses (All Employees)</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>Fuel + Supplier</div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Fuel Expenses</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>
              {format2(displayedStats.fuelCost)}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Supplier Expenses</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>
              {format2(displayedStats.supplierSpend)}
            </div>
          </div>


          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ color: '#64748b', fontWeight: 800 }}>Total Expenses (Fuel + Supplier)</div>
            <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>
              {format2(displayedStats.fuelCost + displayedStats.supplierSpend)}
            </div>
          </div>
        </div>
      </div>

      {/* Brutal charts (optional template) */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1000, fontSize: 16 }}>Quick Visuals</div>
        <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
          Quick charts for design iteration (sandbox-safe)
        </div>

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
    </div>
  )
}
