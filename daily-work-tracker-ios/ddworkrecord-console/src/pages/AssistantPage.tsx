import { useEffect, useMemo, useState } from 'react'
import { fetchStats, type Period } from '../lib/api'
import { isLocalPreviewMode } from '../lib/localPreview'
import { getLocalPreviewMonthBreakdownBase, type LocalPreviewMonthBreakdownBase } from '../lib/localPreviewData'
import { getEmployeeMultiplier, getDefaultEmployeeCount, getAssistantProfiles, getAssistantIndexForEmployee, getDefaultAssistantCount } from '../lib/localPreviewSeed'
import { theme } from '../lib/theme'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function format2(n: number): string {
  return round2(n).toFixed(2)
}

function parseAssistantCode(raw: string | null, assistantCount: number): string | null {
  if (!raw) return null
  const m = /^AS-(\d{3})$/.exec(raw.trim())
  if (!m) return null
  const idx = Number(m[1])
  if (!Number.isFinite(idx)) return null
  if (idx < 1 || idx > assistantCount) return null
  return `AS-${m[1]}`
}

export default function AssistantPage() {
  const localPreview = isLocalPreviewMode()
  const [period] = useState<Period>('month')

  const employeeCount = getDefaultEmployeeCount()
  const assistantCount = getDefaultAssistantCount()

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const assistantCode = useMemo(() => {
    const h = window.location.hash.split('?')[0].replace('#', '').replace(/^\//, '')
    const parts = h.split('/')
    const maybeCode = parts.length >= 2 ? parts[1] : null
    return parseAssistantCode(maybeCode, assistantCount)
  }, [assistantCount, window.location.hash])

  const assistantProfiles = useMemo(() => getAssistantProfiles(), [])
  const assistantProfile = useMemo(() => {
    if (!assistantCode) return null
    const upper = assistantCode.toUpperCase()
    return assistantProfiles.find((p) => (p.code ?? '').toUpperCase() === upper) ?? null
  }, [assistantCode, assistantProfiles])

  useEffect(() => {
    // For now, live assistant totals aren’t wired in this MVP. Show template totals in local preview;
    // if not local preview, we’ll attempt to load page stats but only display what’s available.
    if (localPreview) return
    if (!assistantCode) return

    let cancelled = false
    const run = async () => {
      setError(null)
      setLoading(true)
      try {
        const s = await fetchStats(period)
        if (cancelled) return

        // We don’t have per-assistant buckets from backend yet; keep UI stable.
        // (Still lets the page show something if backend grandTotals exist.)
        void s
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : 'Unknown error'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [assistantCode, localPreview, period])

  const localRow = useMemo(() => {
    if (!assistantCode) return null
    const assistantIndex1Based = Number(/^AS-(\d{3})$/.exec(assistantCode)?.[1] ?? '1') || 1

    const localBase: LocalPreviewMonthBreakdownBase = getLocalPreviewMonthBreakdownBase()

    const totals = {
      totalHours: 0,
      normalHours: 0,
      weekdayOvertimeHours: 0,
      saturdayHours: 0,
      sundayHours: 0,
      publicHolidayHours: 0,
    }

    for (let employeeIndex1Based = 1; employeeIndex1Based <= employeeCount; employeeIndex1Based++) {
      const mappedAssistantIndex = getAssistantIndexForEmployee(employeeIndex1Based, assistantCount)
      if (mappedAssistantIndex !== assistantIndex1Based) continue

      const multiplier = getEmployeeMultiplier(employeeIndex1Based)

      totals.totalHours += localBase.totalHours * multiplier
      totals.normalHours += localBase.normalHours * multiplier
      totals.weekdayOvertimeHours += localBase.weekdayOvertimeHours * multiplier
      totals.saturdayHours += localBase.saturdayHours * multiplier
      totals.sundayHours += localBase.sundayHours * multiplier
      totals.publicHolidayHours += localBase.publicHolidayHours * multiplier
    }

    return {
      totalHours: round2(totals.totalHours),
      normalHours: round2(totals.normalHours),
      weekdayOvertimeHours: round2(totals.weekdayOvertimeHours),
      saturdayHours: round2(totals.saturdayHours),
      sundayHours: round2(totals.sundayHours),
      publicHolidayHours: round2(totals.publicHolidayHours),
    }
  }, [assistantCode, assistantCount, employeeCount])

  const backToDashboard = () => {
    window.location.hash = localPreview ? '#local-preview' : '#dashboard'
  }

  if (!assistantCode) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Assistant</div>
        <div style={{ marginTop: 10, color: '#ef4444', fontWeight: 900 }}>
          Missing/invalid assistant code in URL hash. Expected: <span style={{ fontFamily: 'ui-monospace' }}>#assistant/AS-001</span> (through AS-{String(assistantCount).padStart(3, '0')})
        </div>
      </div>
    )
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Assistant Detail</div>
          <div style={{ marginTop: 6, color: '#475569', fontWeight: 900 }}>
            Assistant: {assistantCode}
            {assistantProfile ? (
              <span style={{ marginLeft: 10, color: '#0f172a', fontWeight: 1000, fontSize: 13 }}>
                {[assistantProfile.firstName, assistantProfile.lastName].filter(Boolean).join(' ')}
              </span>
            ) : null}
          </div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {localPreview ? 'Sandbox template only • assistant totals computed from assigned employees' : 'Cloud totals (if available)'}
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
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.weekdayOvertimeHours) : '—'}</div>
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
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>{localRow ? format2(localRow.publicHolidayHours) : '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
        {localPreview
          ? 'Assistant totals are computed from assigned employees’ template hours.'
          : 'Backend per-assistant totals are not wired yet in this MVP; template behavior is shown for now.'}
      </div>
    </div>
  )
}
