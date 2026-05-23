import { useEffect, useMemo, useState } from 'react'
import type { LocalPreviewWorkday } from '../lib/localPreviewData'
import { businessWorkdayToLocalPreviewWorkday } from '../lib/businessToLocalPreview'
import { fetchBusinessWorkdays, getBusinessCode } from '../lib/businessApi'
import { getDefaultEmployeeCount, getEmployeeCodes } from '../lib/localPreviewSeed'
import { theme } from '../lib/theme'

type JobRow = LocalPreviewWorkday & {
  isComplete: boolean
  isRequired: boolean
}

function normalizeDate(d: string): string {
  return d.trim().slice(0, 10)
}

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export default function JobsList() {
  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const seedEmployeeCodes = useMemo(() => getEmployeeCodes(EMPLOYEE_COUNT), [EMPLOYEE_COUNT])

  const [liveWorkdays, setLiveWorkdays] = useState<LocalPreviewWorkday[]>([])
  const [employeeCodes, setEmployeeCodes] = useState<string[]>(seedEmployeeCodes)

  useEffect(() => {
    const run = async () => {
      try {
        const businessCode = getBusinessCode()
        if (!businessCode) {
          setLiveWorkdays([])
          setEmployeeCodes([])
          window.location.hash = '#business-login'
          return
        }

        const now = new Date()
        const endDate = now.toISOString().slice(0, 10)
        const start = new Date(now)
        start.setUTCDate(start.getUTCDate() - 90)
        const startDate = start.toISOString().slice(0, 10)

        const businessWorkdays = await fetchBusinessWorkdays({
          range: { startDate, endDate },
        })

        const mapped = (Array.isArray(businessWorkdays) ? businessWorkdays : []).map((w) =>
          businessWorkdayToLocalPreviewWorkday(w),
        )

        const uniq = new Set<string>()
        for (const w of mapped) {
          if (w.employeeCode) uniq.add(w.employeeCode)
        }

        setLiveWorkdays(mapped as unknown as LocalPreviewWorkday[])
        setEmployeeCodes(Array.from(uniq).sort((a, b) => a.localeCompare(b)))
      } catch {
        // ignore (UI will just show empty until data arrives)
      }
    }

    void run()
  }, [])

  const workdays = liveWorkdays

  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('') // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>('') // YYYY-MM-DD
  const [jobIdSearch, setJobIdSearch] = useState<string>('') // substring
  const [completeFilter, setCompleteFilter] = useState<'all' | 'complete' | 'incomplete'>('all')
  const [clientSearch, setClientSearch] = useState<string>('') // substring

  const rows: JobRow[] = useMemo(() => {
    return workdays.map((w) => {
      const isComplete = w.jobStatus === 'complete'
      const isRequired = w.jobStatus === 'return-required'
      return { ...w, isComplete, isRequired }
    })
  }, [workdays])

  const filtered = useMemo(() => {
    const from = fromDate ? normalizeDate(fromDate) : ''
    const to = toDate ? normalizeDate(toDate) : ''

    return rows.filter((r) => {
      if (selectedEmployee !== 'all' && r.employeeCode !== selectedEmployee) return false
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      if (jobIdSearch.trim() && !includesCI(r.jobIdNumber, jobIdSearch.trim())) return false

      if (completeFilter === 'complete' && !r.isComplete) return false
      if (completeFilter === 'incomplete' && r.isComplete) return false

      if (clientSearch.trim() && !includesCI(r.clientName, clientSearch.trim())) return false

      return true
    })
  }, [rows, selectedEmployee, fromDate, toDate, jobIdSearch, clientSearch, completeFilter])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Jobs (Live)</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            Derived from cloud business workdays: /api/v1/business/workdays.
          </p>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, minWidth: 'min(240px, 100%)' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total jobs</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>{filtered.length}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Filter by employee</div>
          <div style={{ marginTop: 8 }}>
            <select
              aria-label="Filter by employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
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

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>From date</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="From date"
              title="From date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>To date</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="To date"
              title="To date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Job id search</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Job id search"
              value={jobIdSearch}
              onChange={(e) => setJobIdSearch(e.target.value)}
              placeholder="e.g. 123"
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
              }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Complete filter</div>
          <div style={{ marginTop: 8 }}>
            <select
              aria-label="Complete filter"
              value={completeFilter}
              onChange={(e) => setCompleteFilter(e.target.value as typeof completeFilter)}
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
              }}
            >
              <option value="all">All</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>

        <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Client search</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Client search"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="e.g. Acme"
              style={{
                width: '100%',
                padding: 10,
                border: '2px solid #0f172a',
                borderRadius: 10,
                fontWeight: 900,
                background: '#fff',
                color: '#0f172a',
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: 14,
              border: `2px dashed ${theme.text}`,
              borderRadius: theme.radiusMd,
              background: theme.surface,
            }}
          >
            <div style={{ fontWeight: 1000 }}>No live jobs for these filters</div>
            <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
              Try expanding the date range, switching employee to <b>All</b>, or clearing complete filters.
            </div>
          </div>
        ) : null}

        {filtered.map((r) => (
          <div key={r.id} style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{r.date}</div>
                <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  {r.startTime} → {r.endTime} • {r.employeeCode}
                </div>

                <div style={{ marginTop: 8, color: '#0f172a', fontWeight: 1000, fontSize: 13 }}>Job ID: {r.jobIdNumber}</div>
                <div style={{ marginTop: 4, color: '#475569', fontWeight: 900, fontSize: 12 }}>
                  Client: {r.clientName} • Site: {r.siteName}
                </div>
                <div style={{ marginTop: 4, color: '#475569', fontWeight: 800, fontSize: 12 }}>Location: {r.location}</div>

                <div style={{ marginTop: 8, color: '#0f172a', fontWeight: 1000, fontSize: 12 }}>
                  Status: {r.isComplete ? '✅ Complete' : '⏳ Incomplete'} • {r.isRequired ? '⭐ Return Required' : '• Not required'}
                </div>
              </div>

              <div style={{ padding: 10, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
                <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Starting mileage</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 16 }}>{r.mileage ?? '—'} km</div>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 12, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Job description</div>
              <div style={{ marginTop: 6, fontWeight: 1000, lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
                {r.jobDescription || '—'}
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 12, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Notes (end-day / employee log)</div>
              <div style={{ marginTop: 6, fontWeight: 900, lineHeight: 1.35, whiteSpace: 'pre-wrap', color: '#0f172a' }}>
                {r.notes || '—'}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = `#record/${r.id}`
                }}
                style={{
                  padding: '10px 12px',
                  border: `2px solid ${theme.text}`,
                  borderRadius: theme.radiusSm,
                  background: theme.surface,
                  cursor: 'pointer',
                  fontWeight: 1000,
                  boxShadow: `3px 3px 0 ${theme.text}`,
                  width: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                Open record detail
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
