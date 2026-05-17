import { useState } from 'react'
import SupplierStopsList from './SupplierStopsList'
import SupplierReports from './SupplierReports'
import { theme } from '../lib/theme'

type HubTab = 'stops' | 'reports'

export default function SuppliersHub() {
  const [tab, setTab] = useState<HubTab>('stops')

  return (
    <div style={{ fontFamily: 'system-ui', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ padding: 24, borderBottom: `3px solid ${theme.text}`, background: theme.topBarBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, color: theme.text }}>Suppliers</h1>
            <div style={{ marginTop: 6, fontWeight: 900, color: theme.muted, fontSize: 12 }}>Combined stops + reports</div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTab('stops')}
              style={{
                padding: '10px 12px',
                border: `2px solid ${theme.text}`,
                background: tab === 'stops' ? theme.text : theme.surface,
                color: tab === 'stops' ? '#fff' : theme.text,
                cursor: 'pointer',
                fontWeight: 1000,
                borderRadius: theme.radiusSm,
                boxShadow: tab === 'stops' ? `3px 3px 0 ${theme.text}` : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              Stops
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

        <div style={{ marginTop: 12, fontWeight: 1000, color: theme.muted2, fontSize: 12 }}>
          {tab === 'stops' ? 'Stop-level supplier entries (sandbox)' : 'Aggregated supplier spend (sandbox)'}
        </div>
      </div>

      <div>
        {tab === 'stops' ? <SupplierStopsList /> : null}
        {tab === 'reports' ? <SupplierReports /> : null}
      </div>
    </div>
  )
}
