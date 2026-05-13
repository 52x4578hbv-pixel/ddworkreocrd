import { useMemo, useState } from 'react'

type DummyWorkday = {
  id: string
  employeeCode: string
  date: string
  startTime: string
  endTime: string
  totalHours: number
  totalDistanceKm: number
  fuelCost: number
  supplierSpend: number
  notes: string
}

function calcTotalHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 0
  const start = sh * 60 + sm
  const end = eh * 60 + em
  const minutes = end - start
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

export default function DummyLocalPreview() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [date, setDate] = useState<string>(today)
  const [startTime, setStartTime] = useState<string>('08:00')
  const [endTime, setEndTime] = useState<string>('17:00')
  const [mileage, setMileage] = useState<string>('120')
  const [fuelCost, setFuelCost] = useState<string>('45')
  const [supplierSpend, setSupplierSpend] = useState<string>('80')
  const [notes, setNotes] = useState<string>('Local preview only — no API calls, no cloud writes.')

  const hours = useMemo(() => calcTotalHours(startTime, endTime), [startTime, endTime])

  const dummy: DummyWorkday = useMemo(() => {
    const mileageNum = Number(mileage)
    const fuelNum = Number(fuelCost)
    const supplierNum = Number(supplierSpend)

    return {
      id: 'local-1',
      employeeCode: 'EMP-LOCAL',
      date,
      startTime,
      endTime,
      totalHours: hours,
      totalDistanceKm: Number.isFinite(mileageNum) ? mileageNum : 0,
      fuelCost: Number.isFinite(fuelNum) ? fuelNum : 0,
      supplierSpend: Number.isFinite(supplierNum) ? supplierNum : 0,
      notes,
    }
  }, [date, endTime, fuelCost, hours, mileage, notes, startTime, supplierSpend])

  const max = Math.max(1, dummy.totalHours, dummy.totalDistanceKm, dummy.fuelCost, dummy.supplierSpend)

  const [selectedMetric, setSelectedMetric] = useState<'hours' | 'km' | 'fuel' | 'spend'>('hours')

  const metricValue = selectedMetric === 'hours' ? dummy.totalHours : selectedMetric === 'km' ? dummy.totalDistanceKm : selectedMetric === 'fuel' ? dummy.fuelCost : dummy.supplierSpend
  const pct = Math.max(0, Math.min(100, (metricValue / max) * 100))

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0 }}>Local Dummy Preview</h1>
          <p style={{ marginTop: 8, color: '#475569', fontWeight: 700 }}>
            Design sandbox: this page uses in-memory/mock data only.
          </p>
          <p style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            It never calls <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>/api/…</code>.
          </p>
        </div>

        <div
          style={{
            padding: 12,
            border: '2px solid #0f172a',
            borderRadius: 12,
            background: '#fff',
            maxWidth: 360,
          }}
        >
          <div style={{ fontWeight: 1000 }}>Preview quick stats</div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Hours</div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{dummy.totalHours}</div>
            </div>
            <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Km</div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{dummy.totalDistanceKm}</div>
            </div>
            <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel</div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{dummy.fuelCost}</div>
            </div>
            <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 10, background: '#fff' }}>
              <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Spend</div>
              <div style={{ fontWeight: 1000, fontSize: 22 }}>{dummy.supplierSpend}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div style={{ padding: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ fontWeight: 1000 }}>Mock inputs</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Date</label>
              <input
                title="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                type="date"
                style={{ width: '100%', padding: 10 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Start</label>
                <input
                  title="Start time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  type="time"
                  style={{ width: '100%', padding: 10 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>End</label>
                <input
                  title="End time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  type="time"
                  style={{ width: '100%', padding: 10 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Mileage (km)</label>
                <input
                  title="Mileage (km)"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 120"
                  style={{ width: '100%', padding: 10 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Fuel cost</label>
                <input
                  title="Fuel cost"
                  value={fuelCost}
                  onChange={(e) => setFuelCost(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 45"
                  style={{ width: '100%', padding: 10 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Supplier spend</label>
              <input
                title="Supplier spend"
                value={supplierSpend}
                onChange={(e) => setSupplierSpend(e.target.value)}
                inputMode="decimal"
                placeholder="e.g. 80"
                style={{ width: '100%', padding: 10 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 900, marginBottom: 6 }}>Notes</label>
              <textarea
                title="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes for the preview…"
                style={{ width: '100%', padding: 10 }}
              />
            </div>

            <div style={{ padding: 12, border: '1px dashed #334155', borderRadius: 10, background: '#f8fafc' }}>
              <div style={{ fontWeight: 1000 }}>Computed hours</div>
              <div style={{ marginTop: 6, fontWeight: 1000, fontSize: 18 }}>{hours}</div>
              <div style={{ marginTop: 6, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
                Used only for rendering the preview UI.
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
          <div style={{ fontWeight: 1000 }}>Brutal bar (preview)</div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(
              [
                { key: 'hours', label: 'Hours' },
                { key: 'km', label: 'Km' },
                { key: 'fuel', label: 'Fuel' },
                { key: 'spend', label: 'Spend' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMetric(m.key)}
                style={{
                  padding: '10px 12px',
                  border: '2px solid #0f172a',
                  background: selectedMetric === m.key ? '#0f172a' : '#fff',
                  color: selectedMetric === m.key ? '#fff' : '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 1000,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, height: 18, border: '2px solid #0f172a', borderRadius: 999, overflow: 'hidden', background: '#f1f5f9' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#fff', borderRight: '2px solid #0f172a' }} />
          </div>

          <div style={{ marginTop: 8, color: '#64748b', fontWeight: 900, fontSize: 12 }}>
            Selected: {selectedMetric} • value: {metricValue} • {Math.round(pct)}%
          </div>

          <div style={{ marginTop: 16, padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
            <div style={{ fontWeight: 1000 }}>Mock payload (for UI wiring)</div>
            <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0b1220', color: '#e5e7eb', padding: 12, borderRadius: 10 }}>
              {JSON.stringify(dummy, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
