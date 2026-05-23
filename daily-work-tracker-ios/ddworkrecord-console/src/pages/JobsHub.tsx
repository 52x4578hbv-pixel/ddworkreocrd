import { useMemo } from 'react'
import JobsList from './JobsList'
import { theme } from '../lib/theme'

export default function JobsHub() {
  const title = useMemo(() => 'Jobs', [])

  return (
    <div style={{ fontFamily: 'system-ui', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ padding: 24, borderBottom: `3px solid ${theme.text}`, background: theme.topBarBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text }}>{title}</h1>
            <div style={{ marginTop: 6, fontWeight: 900, color: theme.muted, fontSize: 12 }}>Live jobs list</div>
          </div>
        </div>
        <div style={{ marginTop: 12, fontWeight: 1000, color: theme.muted2, fontSize: 12 }}>
          Derived from cloud business workdays (no admin/Firebase).
        </div>
      </div>

      <div>
        <JobsList />
      </div>
    </div>
  )
}
