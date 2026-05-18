import { useMemo, useState } from 'react'
import { theme } from '../lib/theme'

type AutomationRun = {
  id: string
  startedAtISO: string
  status: 'success' | 'failed' | 'running'
  summary: string
}

function formatShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function statusPill(status: AutomationRun['status']): { bg: string; color: string; border: string } {
  if (status === 'success') return { bg: '#dcfce7', color: '#166534', border: '#22c55e' }
  if (status === 'failed') return { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' }
  return { bg: '#ffedd5', color: '#9a3412', border: '#f97316' }
}

export default function Automation() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runs: AutomationRun[] = useMemo(() => {
    // UI-only for now. Backend wiring can be added later.
    return [
      { id: 'RUN-00042', startedAtISO: new Date(Date.now() - 1000 * 60 * 58).toISOString(), status: 'success', summary: 'Daily sync + recalculation' },
      { id: 'RUN-00041', startedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), status: 'success', summary: 'Late afternoon backlog processing' },
      { id: 'RUN-00040', startedAtISO: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), status: 'failed', summary: 'Supplier aggregation timeout' },
    ]
  }, [])

  const nextRun = useMemo(() => {
    const d = new Date(Date.now() + 1000 * 60 * 45)
    return d.toISOString()
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text }}>Automation</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850, maxWidth: 720 }}>
        Console UI for triggering and viewing automation runs. (Backend wiring can be connected later.)
      </p>

      {error ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: theme.errorBg,
            borderLeft: `4px solid ${theme.error}`,
            fontWeight: 950,
            borderRadius: theme.radiusSm,
            color: theme.text,
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ padding: 14, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ fontWeight: 1100, fontSize: 18, color: theme.text }}>Run now</div>
          <div style={{ marginTop: 6, color: theme.muted, fontWeight: 900, fontSize: 13 }}>
            Triggers the automation pipeline immediately.
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setError(null)
              setBusy(true)
              try {
                // UI-only for now
                await new Promise((r) => setTimeout(r, 650))
              } catch (e) {
                const message = e instanceof Error ? e.message : 'Failed to run automation'
                setError(message)
              } finally {
                setBusy(false)
              }
            }}
            style={{
              marginTop: 12,
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.text,
              color: '#fff',
              cursor: busy ? 'not-allowed' : 'pointer',
              fontWeight: 1100,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            {busy ? 'Running…' : 'Run Automation Pipeline'}
          </button>

          <div style={{ marginTop: 10, color: theme.muted2, fontWeight: 900, fontSize: 12.5 }}>
            Tip: connect API endpoint later to actually start server-side jobs.
          </div>
        </div>

        <div style={{ padding: 14, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ fontWeight: 1100, fontSize: 18, color: theme.text }}>Schedule</div>
          <div style={{ marginTop: 6, color: theme.muted, fontWeight: 900, fontSize: 13 }}>
            Next planned run (placeholder).
          </div>

          <div style={{ marginTop: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff', padding: 12 }}>
            <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Next run</div>
            <div style={{ marginTop: 6, fontWeight: 1100, color: theme.text }}>{formatShort(nextRun)}</div>
          </div>

          <div style={{ marginTop: 10, color: theme.muted2, fontWeight: 900, fontSize: 12.5 }}>
            When backend wiring is added, we can read the real schedule from the API.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 1100, fontSize: 16, color: theme.text }}>Recent runs</div>
        <div style={{ marginTop: 6, color: theme.muted, fontWeight: 900, fontSize: 12.5 }}>
          UI-only mock data for now.
        </div>

        <div style={{ marginTop: 12, border: '2px solid #0f172a', borderRadius: theme.radiusMd, background: '#fff', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Run ID</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Started</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Status</th>
                <th style={{ textAlign: 'left', padding: 12, borderBottom: '2px solid #0f172a', fontWeight: 1000 }}>Summary</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const s = statusPill(r.status)
                return (
                  <tr key={r.id}>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 950 }}>{r.id}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 900, color: theme.muted2 }}>{formatShort(r.startedAtISO)}</td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 10px',
                          borderRadius: theme.radiusSm,
                          background: s.bg,
                          color: s.color,
                          border: `2px solid ${s.border}`,
                          fontWeight: 1000,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: 12, borderBottom: '1px solid #e2e8f0', fontWeight: 900 }}>{r.summary}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
