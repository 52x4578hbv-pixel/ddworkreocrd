import { useEffect, useMemo, useState } from 'react'
import { theme } from '../lib/theme'
import { fetchBusinessWorkdays, getBusinessCode, type PeriodRange } from '../lib/businessApi'

type Slot = {
  startMin: number
  endMin: number
}

type IntervalKind = 'workshop' | 'travel' | 'job' | 'break'

type TimesheetInterval = {
  kind: IntervalKind
  startMin: number
  endMin: number
  // Activity text rules:
  // - For job: jobId + km (optional)
  // - For travel: km (optional)
  // - For workshop/break: no activity text in the attachment rules; only tick
  activity?: string
  hasTick: boolean
}

type BusinessWorkday = Awaited<ReturnType<typeof fetchBusinessWorkdays>>[number]

const pad2 = (n: number) => String(n).padStart(2, '0')

function parseTimeToMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') {
    // tolerate non-string times (e.g., Firestore Timestamp objects)
    if (raw && typeof raw === 'object' && 'toDate' in raw) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (raw as any).toDate?.()
        if (d instanceof Date && Number.isFinite(d.getTime())) return d.getHours() * 60 + d.getMinutes()
      } catch {
        return null
      }
    }
    return null
  }

  const s = raw.trim()

  // HH:MM
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (m) {
    const hh = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
    return hh * 60 + mm
  }

  // ISO-like (fallback)
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function formatKmOrBlank(startKm: unknown, endKm: unknown): string {
  const a = asNumber(startKm)
  const b = asNumber(endKm)
  if (a === null || b === null) return ''
  const km = b - a
  if (!Number.isFinite(km)) return ''
  if (Math.abs(km) < 0.000001) return '0'
  return km.toFixed(1)
}

function extractWorkshopInterval(seg: unknown): TimesheetInterval | null {
  if (!seg || typeof seg !== 'object') return null
  const s = seg as Record<string, unknown>

  const startMin = parseTimeToMinutes(s.start ?? s.startTime ?? s.start_time)
  const endMin = parseTimeToMinutes(s.end ?? s.endTime ?? s.end_time)
  if (startMin === null || endMin === null || endMin <= startMin) return null

  return {
    kind: 'workshop',
    startMin,
    endMin,
    hasTick: true,
  }
}

function extractTravelInterval(seg: unknown): TimesheetInterval | null {
  if (!seg || typeof seg !== 'object') return null
  const s = seg as Record<string, unknown>

  const startMin = parseTimeToMinutes(s.startTime ?? s.start_time ?? s.start)
  const endMin = parseTimeToMinutes(s.endTime ?? s.end_time ?? s.end)
  if (startMin === null || endMin === null || endMin <= startMin) return null

  const km = formatKmOrBlank(s.startMileage ?? s.start_mileage, s.endMileage ?? s.end_mileage)
  return {
    kind: 'travel',
    startMin,
    endMin,
    activity: km || undefined,
    hasTick: true,
  }
}

function extractJobInterval(seg: unknown): TimesheetInterval | null {
  if (!seg || typeof seg !== 'object') return null
  const s = seg as Record<string, unknown>

  const jobIdRaw = s.jobId ?? s.job_id ?? s.job
  const jobId = typeof jobIdRaw === 'string' ? jobIdRaw.trim() : ''

  const startMin = parseTimeToMinutes(s.startTime ?? s.start_time ?? s.start)
  const endMin = parseTimeToMinutes(s.endTime ?? s.end_time ?? s.end)
  if (startMin === null || endMin === null || endMin <= startMin) return null

  const km = formatKmOrBlank(s.startMileage ?? s.start_mileage, s.endMileage ?? s.end_mileage)
  const activityParts: string[] = []
  if (jobId) activityParts.push(jobId)
  if (km) activityParts.push(`${km} km`)

  const activity = activityParts.join(' • ')
  return {
    kind: 'job',
    startMin,
    endMin,
    activity: activity || undefined,
    hasTick: true,
  }
}

function extractBreakInterval(seg: unknown): TimesheetInterval | null {
  if (!seg || typeof seg !== 'object') return null
  const s = seg as Record<string, unknown>

  const startMin = parseTimeToMinutes(s.startTime ?? s.start_time ?? s.start)
  const endMin = parseTimeToMinutes(s.endTime ?? s.end_time ?? s.end)
  if (startMin === null || endMin === null || endMin <= startMin) return null

  return {
    kind: 'break',
    startMin,
    endMin,
    hasTick: true,
  }
}

function intervalOverlapsSlot(interval: TimesheetInterval, slot: Slot): boolean {
  return Math.max(slot.startMin, interval.startMin) < Math.min(slot.endMin, interval.endMin)
}

function yyyyMmDd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return `${y}-${pad2(m)}-${pad2(day)}`
}

function dateRangeForPreset(preset: 'week' | 'month' | 'threeMonths'): PeriodRange {
  const now = new Date()
  const end = new Date(now)
  // Align to UTC day boundaries
  end.setUTCHours(0, 0, 0, 0)

  const days = preset === 'week' ? 7 : preset === 'month' ? 30 : 90
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))

  return {
    startDate: yyyyMmDd(start),
    endDate: yyyyMmDd(end),
  }
}

type TimesheetPreset = 'week' | 'month' | 'threeMonths'

export default function Timesheet() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [preset, setPreset] = useState<TimesheetPreset>('week')
  const [selectedEmployeeCode, setSelectedEmployeeCode] = useState<string | null>(null)

  const [workdays, setWorkdays] = useState<BusinessWorkday[]>([])

  const businessCode = useMemo(() => getBusinessCode(), [])
  const range = useMemo(() => dateRangeForPreset(preset), [preset])

  useEffect(() => {
    setError(null)

    if (!businessCode) {
      setError('Business not logged in. Please open #business-login to get an access code.')
      return
    }

    const run = async () => {
      setLoading(true)
      try {
        const all = await fetchBusinessWorkdays({ range, employeeCode: null })
        setWorkdays(all)
        const codes = Array.from(new Set(all.map((w) => String(w.employeeId ?? '').trim()).filter(Boolean)))
        if (!selectedEmployeeCode && codes.length > 0) setSelectedEmployeeCode(codes[0])
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, businessCode])

  const employees = useMemo(() => {
    const codes = Array.from(new Set(workdays.map((w) => String(w.employeeId ?? '').trim()).filter(Boolean)))
    codes.sort()
    return codes
  }, [workdays])

  const datesInRange = useMemo(() => {
    // Build inclusive day list based on UTC dates.
    const start = new Date(`${range.startDate}T00:00:00.000Z`)
    const end = new Date(`${range.endDate}T00:00:00.000Z`)
    const days: string[] = []

    const cursor = new Date(start)
    while (cursor.getTime() <= end.getTime()) {
      days.push(yyyyMmDd(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return days
  }, [range.endDate, range.startDate])

  const workdayByDate = useMemo(() => {
    if (!selectedEmployeeCode) return new Map<string, BusinessWorkday>()
    const m = new Map<string, BusinessWorkday>()
    for (const w of workdays) {
      const code = String(w.employeeId ?? '').trim()
      if (!code || code !== selectedEmployeeCode) continue
      const dateKey = String(w.date ?? '').slice(0, 10)
      if (!dateKey) continue
      // If multiple, keep latest (string compare)
      const prev = m.get(dateKey)
      if (!prev || String(prev.id ?? '') < String(w.id ?? '')) m.set(dateKey, w)
    }
    return m
  }, [selectedEmployeeCode, workdays])

  const slots = useMemo((): Slot[] => {
    const arr: Slot[] = []
    for (let i = 0; i < 48; i++) {
      const startMin = i * 30
      arr.push({ startMin, endMin: startMin + 30 })
    }
    return arr
  }, [])

  const buildIntervalsForDay = (w: BusinessWorkday | undefined): TimesheetInterval[] => {
    if (!w) return []

    const intervals: TimesheetInterval[] = []

    // workshops
    if (Array.isArray((w as any).workshops)) {
      for (const seg of (w as any).workshops) {
        const it = extractWorkshopInterval(seg)
        if (it) intervals.push(it)
      }
    }

    // travels
    if (Array.isArray((w as any).travels)) {
      for (const seg of (w as any).travels) {
        const it = extractTravelInterval(seg)
        if (it) intervals.push(it)
      }
    }

    // jobs
    if (Array.isArray((w as any).jobs)) {
      for (const seg of (w as any).jobs) {
        const it = extractJobInterval(seg)
        if (it) intervals.push(it)
      }
    }

    // break/private segments
    // note: backend returns privateSegments as unknown[] if present
    if (Array.isArray((w as any).privateSegments)) {
      for (const seg of (w as any).privateSegments) {
        const it = extractBreakInterval(seg)
        if (it) intervals.push(it)
      }
    }

    // Sort for deterministic behavior
    return intervals.sort((a, b) => a.startMin - b.startMin)
  }

  if (error && !businessCode) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980, margin: '0 auto' }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Timesheet</div>
        <div style={{ marginTop: 10, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 800 }}>
          {error}
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#business-login'
            }}
            style={{
              padding: '10px 14px',
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 950,
              boxShadow: '3px 3px 0 #0f172a',
            }}
          >
            Go to Business Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Timesheet</div>
          <div style={{ marginTop: 6, color: '#475569', fontWeight: 900, fontSize: 12 }}>
            Business code mode • {range.startDate} → {range.endDate}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Employee</div>
            <select
              aria-label="Employee"
              value={selectedEmployeeCode ?? ''}
              onChange={(e) => setSelectedEmployeeCode(e.target.value || null)}
              style={{
                padding: '10px 12px',
                border: '2px solid #0f172a',
                background: '#fff',
                fontWeight: 950,
                borderRadius: 10,
                minWidth: 220,
              }}
            >
              {employees.length === 0 ? <option value="">(no workdays yet)</option> : null}
              {employees.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Time Period</div>
            <select
              aria-label="Time period"
              value={preset}
              onChange={(e) => setPreset(e.target.value as TimesheetPreset)}
              style={{
                padding: '10px 12px',
                border: '2px solid #0f172a',
                background: '#fff',
                fontWeight: 950,
                borderRadius: 10,
                minWidth: 200,
              }}
            >
              <option value="week">Last week</option>
              <option value="month">Last month</option>
              <option value="threeMonths">Last 3 months</option>
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 900 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, color: '#64748b', fontWeight: 900 }}>Loading workdays…</div>
      ) : null}

      {!selectedEmployeeCode ? null : (
        <div style={{ marginTop: 18, display: 'grid', gap: 18 }}>
          {datesInRange.map((dateKey) => {
            const w = workdayByDate.get(dateKey)
            const intervals = buildIntervalsForDay(w)
            const relevantIntervals = intervals.filter((i) => i.kind === 'workshop' || i.kind === 'travel' || i.kind === 'job')
            const timeIn = relevantIntervals.length ? Math.min(...relevantIntervals.map((i) => i.startMin)) : null
            const timeOut = relevantIntervals.length ? Math.max(...relevantIntervals.map((i) => i.endMin)) : null

            return (
              <div key={`${selectedEmployeeCode}-${dateKey}`} style={{ border: '2px solid #0f172a', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
                <div style={{ padding: 12, background: '#f8fafc', borderBottom: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 1100, fontSize: 16 }}>{dateKey}</div>
                    <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12, marginTop: 4 }}>{selectedEmployeeCode}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
                      <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Time in</div>
                      <div style={{ fontWeight: 1100, fontSize: 18, marginTop: 6 }}>
                        {timeIn === null ? '' : `${pad2(Math.floor(timeIn / 60))}:${pad2(timeIn % 60)}`}
                      </div>
                    </div>
                    <div style={{ padding: 10, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
                      <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Time out</div>
                      <div style={{ fontWeight: 1100, fontSize: 18, marginTop: 6 }}>
                        {timeOut === null ? '' : `${pad2(Math.floor(timeOut / 60))}:${pad2(timeOut % 60)}`}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <div
                    style={{
                      minWidth: 900,
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 1fr 1fr 1fr',
                      borderBottom: '2px solid #0f172a',
                    }}
                  >
                    <div style={{ padding: 10, borderRight: '2px solid #0f172a', fontWeight: 1100 }}>Time</div>
                    <div style={{ padding: 10, borderRight: '2px solid #0f172a', fontWeight: 1100 }}>Workshop</div>
                    <div style={{ padding: 10, borderRight: '2px solid #0f172a', fontWeight: 1100 }}>Travel</div>
                    <div style={{ padding: 10, borderRight: '2px solid #0f172a', fontWeight: 1100 }}>Job</div>
                    <div style={{ padding: 10, fontWeight: 1100 }}>Break</div>
                  </div>

                  <div style={{ minWidth: 900 }}>
                    {slots.map((slot, idx) => {
                      const workshop = intervals.filter((i) => i.kind === 'workshop' && intervalOverlapsSlot(i, slot))
                      const travel = intervals.filter((i) => i.kind === 'travel' && intervalOverlapsSlot(i, slot))
                      const job = intervals.filter((i) => i.kind === 'job' && intervalOverlapsSlot(i, slot))
                      const brk = intervals.filter((i) => i.kind === 'break' && intervalOverlapsSlot(i, slot))

                      const travelActivity = travel.length ? travel.map((t) => t.activity).filter(Boolean).join(' + ') : ''
                      const jobActivity = job.length ? job.map((j) => j.activity).filter(Boolean).join(' + ') : ''

                      const workshopTick = workshop.length ? '✓' : ''
                      const travelTick = travel.length ? '✓' : ''
                      const jobTick = job.length ? '✓' : ''
                      const breakTick = brk.length ? '✓' : ''

                      return (
                        <div
                          key={`${dateKey}-${idx}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '120px 1fr 1fr 1fr 1fr',
                            borderBottom: '2px solid #0f172a',
                          }}
                        >
                          <div style={{ padding: 8, borderRight: '2px solid #0f172a', fontWeight: 950, color: '#0f172a', background: idx % 2 === 0 ? '#fff' : '#fbfdff' }}>
                            {pad2(Math.floor(slot.startMin / 60))}:{pad2(slot.startMin % 60)}
                          </div>

                          <div style={{ padding: 8, borderRight: '2px solid #0f172a', minHeight: 34, background: '#fff' }}>
                            <div style={{ fontWeight: 1100, fontSize: 14 }}>{workshopTick}</div>
                          </div>

                          <div style={{ padding: 8, borderRight: '2px solid #0f172a', minHeight: 34, background: '#fff' }}>
                            <div style={{ fontWeight: 1100, fontSize: 14 }}>{travelTick}</div>
                            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 950, color: '#0f172a' }}>{travelActivity}</div>
                          </div>

                          <div style={{ padding: 8, borderRight: '2px solid #0f172a', minHeight: 34, background: '#fff' }}>
                            <div style={{ fontWeight: 1100, fontSize: 14 }}>{jobTick}</div>
                            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 950, color: '#0f172a' }}>{jobActivity}</div>
                          </div>

                          <div style={{ padding: 8, minHeight: 34, background: '#fff' }}>
                            <div style={{ fontWeight: 1100, fontSize: 14 }}>{breakTick}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
