import { useMemo, useState } from 'react'
import { getLocalPreviewWorkdays, type SupplierStop } from '../lib/localPreviewData'
import { getDefaultEmployeeCount, getEmployeeCodes } from '../lib/localPreviewSeed'
import { theme } from '../lib/theme'

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function format2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function formatDistanceKm(distanceMeters: number | null): string {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return '—'
  return `${format2(distanceMeters / 1000)} km`
}

function fmtMiles(v: number | null): string {
  return v === null || !Number.isFinite(v) ? '—' : `${format2(v)} km`
}

function fmtJobId(jobId: string | null): string {
  return jobId ? jobId : '—'
}

function ReceiptCount({ ids }: { ids: string[] }) {
  return <span>{ids?.length ? `${ids.length} photo(s)` : '—'}</span>
}

export default function SupplierStopsList() {
  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const employeeCodes = useMemo(() => getEmployeeCodes(EMPLOYEE_COUNT), [EMPLOYEE_COUNT])

  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('') // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>('') // YYYY-MM-DD
  const [supplierSearch, setSupplierSearch] = useState<string>('') // substring
  const [jobIdSearch, setJobIdSearch] = useState<string>('') // substring

  const workdays = useMemo(() => getLocalPreviewWorkdays(), [])
  const rows = useMemo(() => {
    const from = fromDate.trim()
    const to = toDate.trim()

    const filteredWorkdays = workdays.filter((w) => {
      if (selectedEmployee !== 'all' && w.employeeCode !== selectedEmployee) return false
      if (from && w.date < from) return false
      if (to && w.date > to) return false

      if (supplierSearch.trim()) {
        const q = supplierSearch.trim()
        const anySupplier = w.supplierStops.some((s) => includesCI(s.supplierName ?? '', q))
        if (!anySupplier) return false
      }

      if (jobIdSearch.trim()) {
        const q = jobIdSearch.trim()
        const anyJob = w.supplierStops.some((s) => (s.jobId ?? '').includes(q))
        if (!anyJob) return false
      }

      return true
    })

    return filteredWorkdays
  }, [workdays, selectedEmployee, fromDate, toDate, supplierSearch, jobIdSearch])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Supplier Stops (Sandbox)</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            Mirrors iOS SupplierScreen stop-level fields (per-workday rows).
          </p>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, minWidth: 240 }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total supplier stops</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>
            {rows.reduce((acc, w) => acc + w.supplierStops.length, 0)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Employee filter</div>
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

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
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

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
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

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier search</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Supplier search"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder="e.g. Supreme"
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

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Job id search</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Job id search"
              value={jobIdSearch}
              onChange={(e) => setJobIdSearch(e.target.value)}
              placeholder="e.g. 1234"
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

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {rows.length === 0 ? (
          <div style={{ padding: 14, border: `2px dashed ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, fontWeight: 1000 }}>
            No supplier stops match these filters.
          </div>
        ) : null}

        {rows.map((w) => (
          <div key={w.id} style={{ padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>{w.date}</div>
                <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  {w.startTime} → {w.endTime} • {w.employeeCode}
                </div>
                <div style={{ marginTop: 6, color: '#475569', fontWeight: 800, fontSize: 12 }}>
                  Supplier stops: {w.supplierStops.length}
                </div>
              </div>

              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Spend</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{format2(w.supplierSpend)}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
              {w.supplierStops.map((s, idx) => (
                <SupplierStopCard key={`${w.id}-s-${idx}`} stop={s} index={idx + 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SupplierStopCard({ stop, index }: { stop: SupplierStop; index: number }) {
  return (
    <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: theme.surface }}>
      <div style={{ fontWeight: 1000, fontSize: 14 }}>Stop #{index}</div>

      <div style={{ marginTop: 8, color: '#475569', fontWeight: 900, fontSize: 12 }}>
        {stop.arrivalLocation} → {stop.departureLocation}
      </div>

      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Arrival</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{stop.arrivalTime}</div>
        </div>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Departure</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{stop.departureTime}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontWeight: 1000, color: '#0f172a' }}>Supplier: {stop.supplierName}</div>

      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Amount spent</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{format2(stop.amountSpent)}</div>
        </div>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Duration (hours)</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{format2(stop.durationHours)}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
        <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>What purchased</div>
        <div style={{ marginTop: 6, fontWeight: 900, whiteSpace: 'pre-wrap' }}>{stop.whatPurchased}</div>
      </div>

      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Job ID (optional)</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{fmtJobId(stop.jobId)}</div>
        </div>

        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Distance</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{formatDistanceKm(stop.distanceMeters)}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Start mileage</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{fmtMiles(stop.startMileage)}</div>
        </div>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>End mileage</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{fmtMiles(stop.endMileage)}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
        <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Receipt photos</div>
        <div style={{ marginTop: 6, fontWeight: 1000 }}>
          <ReceiptCount ids={stop.photoReceiptIds} />
        </div>
      </div>
    </div>
  )
}
