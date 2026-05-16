import { useMemo, useState } from 'react'
import { getLocalPreviewWorkdays, type FuelStop } from '../lib/localPreviewData'
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

function ReceiptCount({ ids }: { ids: string[] }) {
  return <span>{ids?.length ? `${ids.length} photo(s)` : '—'}</span>
}

export default function FuelStopsList() {
  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const employeeCodes = useMemo(() => getEmployeeCodes(EMPLOYEE_COUNT), [EMPLOYEE_COUNT])

  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [fromDate, setFromDate] = useState<string>('') // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>('') // YYYY-MM-DD
  const [fuelStationSearch, setFuelStationSearch] = useState<string>('') // substring

  const workdays = useMemo(() => getLocalPreviewWorkdays(), [])
  const rows = useMemo(() => {
    const from = fromDate.trim()
    const to = toDate.trim()

    const filteredWorkdays = workdays.filter((w) => {
      if (selectedEmployee !== 'all' && w.employeeCode !== selectedEmployee) return false
      if (from && w.date < from) return false
      if (to && w.date > to) return false

      if (fuelStationSearch.trim()) {
        const q = fuelStationSearch.trim()
        const anyStation = w.fuelStops.some((f) => (f.fuelStationName ?? '').toLowerCase().includes(q.toLowerCase()))
        if (!anyStation) return false
      }

      return true
    })

    return filteredWorkdays
  }, [workdays, selectedEmployee, fromDate, toDate, fuelStationSearch])

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Fuel Stops (Sandbox)</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 12 }}>
            Mirrors iOS FuelScreen stop-level fields (per-workday rows).
          </p>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, minWidth: 'min(240px, 100%)' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total fuel stops</div>
          <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 24 }}>
            {rows.reduce((acc, w) => acc + w.fuelStops.length, 0)}
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
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel station search</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Fuel station search"
              value={fuelStationSearch}
              onChange={(e) => setFuelStationSearch(e.target.value)}
              placeholder="e.g. Shell"
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
          <div style={{ padding: 14, border: '2px dashed #0f172a', borderRadius: 12, background: '#fff', fontWeight: 1000 }}>
            No fuel stops match these filters.
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
                  Fuel stops: {w.fuelStops.length}
                </div>
              </div>

              <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
                <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel cost (day total)</div>
                <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{format2(w.fuelCost)}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {w.fuelStops.map((s, idx) => (
                <FuelStopCard key={`${w.id}-f-${idx}`} stop={s} index={idx + 1} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FuelStopCard({ stop, index }: { stop: FuelStop; index: number }) {
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

      <div style={{ marginTop: 10, fontWeight: 1000, color: '#0f172a' }}>
        Station: {stop.fuelStationName ?? '—'}
      </div>

      <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Liters filled</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{format2(stop.litersFilled)}</div>
        </div>
        <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#f8fafc' }}>
          <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total cost</div>
          <div style={{ marginTop: 6, fontWeight: 1000 }}>{format2(stop.totalCost)}</div>
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
        <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Distance</div>
        <div style={{ marginTop: 6, fontWeight: 1000 }}>{formatDistanceKm(stop.distanceMeters)}</div>
      </div>

      <div style={{ marginTop: 8, padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
        <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Receipt photos</div>
        <div style={{ marginTop: 6, fontWeight: 1000 }}>
          <ReceiptCount ids={stop.photoReceiptIds} />
        </div>
      </div>

      <div style={{ marginTop: 8, padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
        <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Duration (hours)</div>
        <div style={{ marginTop: 6, fontWeight: 1000 }}>{format2(stop.durationHours)}</div>
      </div>
    </div>
  )
}
