import { useEffect, useMemo, useState } from 'react'
import type { Period } from '../lib/api'
import { fetchBusinessStats } from '../lib/businessApi'
import { theme } from '../lib/theme'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export default function BusinessDashboard() {
  const [period] = useState<Period>('month')
  const [stats, setStats] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: theme.text }}>Business Dashboard</h1>
          <p style={{ marginTop: 6, color: theme.muted, fontWeight: 800 }}>
            Period: {period} {loading ? '(Loading…)' : ''}
          </p>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('ddworkrecord_business_code')
            window.location.hash = '#business-login'
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
          Logout
        </button>
      </div>

      {error ? (
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
    </div>
  )
}
