import { useEffect, useMemo, useState } from 'react'
import { getLocalPreviewWorkdays, type LocalPreviewWorkday } from '../lib/localPreviewData'
import { getEmployeeCodes, getDefaultEmployeeCount } from '../lib/localPreviewSeed'
import { isLocalPreviewMode } from '../lib/localPreview'
import { API_BASE_URL } from '../lib/api'
import { theme } from '../lib/theme'

export default function RecordsList() {
  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const employeeCodes = useMemo(() => getEmployeeCodes(EMPLOYEE_COUNT), [EMPLOYEE_COUNT])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [liveWorkdays, setLiveWorkdays] = useState<LocalPreviewWorkday[]>([])
  const [loading, setLoading] = useState(false)

  const isLocal = isLocalPreviewMode()

  useEffect(() => {
    if (isLocal) return

    const fetchCloudRecords = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('ddworkrecord_admin_token')
        const base = API_BASE_URL?.trim() || ''
        const res = await fetch(`${base}/api/v1/console/workdays`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const workdaysList = Array.isArray(data) ? data : (data?.workdays ?? [])
          setLiveWorkdays(workdaysList as unknown as LocalPreviewWorkday[])
        }
      } catch (e) {
        console.error('Failed to fetch cloud records', e)
      } finally {
        setLoading(false)
      }
    }

    void fetchCloudRecords()
  }, [isLocal])

  const workdays = useMemo(() => {
    return isLocal ? getLocalPreviewWorkdays() : liveWorkdays
  }, [isLocal, liveWorkdays])

  const filteredWorkdays = useMemo(() => {
    const getEmployeeCode = (w: LocalPreviewWorkday): string => {
      const anyW = w as unknown as { employeeCode?: unknown; employeeId?: unknown }
      const raw = anyW.employeeCode ?? anyW.employeeId
      return String(raw ?? '').trim()
    }

    const base = selectedEmployee === 'all' ? workdays : workdays.filter((w) => getEmployeeCode(w) === selectedEmployee)

    // Sort by employee id/code asc, then date desc
    return base
      .slice()
      .sort((a, b) => {
        const ea = getEmployeeCode(a)
        const eb = getEmployeeCode(b)
        if (ea === eb) return b.date.localeCompare(a.date)
        return ea.localeCompare(eb)
      })
  }, [selectedEmployee, workdays])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>
            Records List {isLocal ? '(Sandbox)' : ''}
          </h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            {isLocal 
              ? 'Fake records pulled from local preview drafts. No cloud calls.' 
              : 'Live records synchronized from the cloud.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, minWidth: 'min(240px, 100%)' }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total records</div>
            <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{filteredWorkdays.length}</div>
          </div>

          <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, minWidth: 'min(260px, 100%)' }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Filter by employee</div>
            <div style={{ marginTop: 8 }}>
              <select
                title="Filter by employee"
                aria-label="Filter by employee"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  border: `2px solid ${theme.text}`,
                  borderRadius: theme.radiusSm,
                  fontWeight: 900,
                  background: theme.surface,
                  color: theme.text,
                }}
              >
                <option value="all">All employees</option>
                {employeeCodes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {filteredWorkdays.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 14, border: `2px dashed ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
            <div style={{ fontWeight: 1000 }}>No records found</div>
            <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
              {selectedEmployee === 'all' ? (
                <>
                  No records available for display.
                </>
              ) : (
                <>No records found for {selectedEmployee}.</>
              )}
            </div>
          </div>
        ) : null}

        {filteredWorkdays.map((w) => (
          <div
            key={w.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              window.location.hash = `#record/${w.id}`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                window.location.hash = `#record/${w.id}`
              }
            }}
            style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{w.date}</div>
                <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  {(w as any).startTime ?? (w as any).start_time ?? '—'} → {(w as any).endTime ?? (w as any).end_time ?? '—'} • {(w as any).employeeCode ?? (w as any).employeeId ?? (w as any).employee_id ?? '—'}
                </div>
              </div>

              <div style={{ padding: 10, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Hours</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 22 }}>{(w as any).totalHours ?? '—'}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Km</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{(w as any).totalDistanceKm ?? '—'}</div>
              </div>

              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{(w as any).fuelCost ?? '—'}</div>
              </div>

              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Spend</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{(w as any).supplierSpend ?? '—'}</div>
              </div>

              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Notes</div>
                <div style={{ marginTop: 6, fontWeight: 850, fontSize: 12, color: '#0f172a', lineHeight: 1.35 }}>
                  {(w as any).notes ?? (w as any).endNotes ?? '—'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
