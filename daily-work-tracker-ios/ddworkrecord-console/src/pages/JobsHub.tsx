import { useMemo, useState } from 'react'
import JobsList from './JobsList'
import JobsReports from './JobsReports'
import { theme } from '../lib/theme'

type HubTab = 'list' | 'reports'

export default function JobsHub() {
  const [tab, setTab] = useState<HubTab>('list')

  // Small helper so we can show a stable header even if underlying components change.
  const title = useMemo(() => {
    if (tab === 'list') return 'Jobs (List)'
    return 'Jobs (Reports)'
  }, [tab])

  return (
    <div style={{ fontFamily: 'system-ui', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ padding: 24, borderBottom: `3px solid ${theme.text}`, background: theme.topBarBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text }}>Jobs</h1>
            <div style={{ marginTop: 6, fontWeight: 900, color: theme.muted, fontSize: 12 }}>Combined list + reports</div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTab('list')}
              style={{
                padding: '10px 12px',
                border: `2px solid ${theme.text}`,
                background: tab === 'list' ? theme.text : theme.surface,
                color: tab === 'list' ? '#fff' : theme.text,
                cursor: 'pointer',
                fontWeight: 1000,
                borderRadius: theme.radiusSm,
                boxShadow: tab === 'list' ? `3px 3px 0 ${theme.text}` : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              List
            </button>

            <button
              type="button"
              onClick={() => setTab('reports')}
              style={{
                padding: '10px 12px',
                border: `2px solid ${theme.text}`,
                background: tab === 'reports' ? theme.text : theme.surface,
                color: tab === 'reports' ? '#fff' : theme.text,
                cursor: 'pointer',
                fontWeight: 1000,
                borderRadius: theme.radiusSm,
                boxShadow: tab === 'reports' ? `3px 3px 0 ${theme.text}` : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              Reports
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, fontWeight: 1000, color: theme.muted2, fontSize: 12 }}>{title}</div>
      </div>

      <div>
        {tab === 'list' ? <JobsList /> : null}
        {tab === 'reports' ? <JobsReports /> : null}
      </div>
    </div>
  )
}
