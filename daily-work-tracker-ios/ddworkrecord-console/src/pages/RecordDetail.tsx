import { useEffect, useMemo, useState } from 'react'
import { getLocalPreviewWorkdays } from '../lib/localPreviewData'
import { isLocalPreviewMode } from '../lib/localPreview'
import { API_BASE_URL } from '../lib/api'
import { theme } from '../lib/theme'
import { getVehicleProfiles } from '../lib/localPreviewSeed'

type LocalRecord = ReturnType<typeof getLocalPreviewWorkdays>[number]

type LiveWorkday = {
  id: string
  employeeId: string
  date: string
  startMileage: number | null
  endMileage: number | null
  totalHours: number
  totalDistanceKm: number
  jobs: Array<{ jobId: string; startTime: string; endTime: string; status: string }>
  fuels: Array<{ litersFilled: number; totalCost: number; arrivalTime: string; departureTime?: string }>
  suppliers: Array<{ supplierName: string; amountSpent: number; arrivalTime: string; departureTime?: string }>
  workshops: unknown[]
  travels: Array<{
    startTime?: string
    endTime?: string
    startLocation?: unknown
    endLocation?: unknown
    startMileage?: number
    endMileage?: number
    vehicleId?: string | null
  }>
  privateSegments: unknown[]
  vehicleId?: string | null
  endNotes?: string | null
  dayStartLocation?: unknown
  dayEndLocation?: unknown
}

type TimelineEvent = {
  key: string
  time: string
  label: string
  detail: string
  timeSort: number
}

function format2(n: number): string {
  const v = Math.round(n * 100) / 100
  return v.toFixed(2)
}

function parseRecordIdFromHash(): string | null {
  // expects: #record/<id>
  const h = window.location.hash.replace('#', '').replace(/^\//, '')
  const parts = h.split('/')
  if (parts.length < 2) return null
  return parts[1] || null
}

function timeToSortValue(isoLike: string): number {
  const d = new Date(isoLike)
  const t = d.getTime()
  return Number.isFinite(t) ? t : 0
}

function ensureNonEmpty(s: string | null | undefined): string {
  const v = (s ?? '').toString().trim()
  return v ? v : '—'
}

function formatVehicleDisplay(vehicleId: string | null): string {
  if (!vehicleId) return '—'

  const vehicleProfiles = getVehicleProfiles()
  const match = vehicleProfiles.find((p) => p.code.toUpperCase() === vehicleId.toUpperCase())
  if (!match) return vehicleId

  const parts = [`${match.carType}`, `${match.registrationNumber}`]
  if (match.nickname && match.nickname.trim()) parts.push(match.nickname.trim())

  return parts.join(' – ')
}

function parseTimeToMinutes(raw: string): number | null {
  const s = raw.trim()
  // HH:MM (local preview + most backend times in this UI)
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (m) {
    const hh = Number(m[1])
    const mm = Number(m[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
    return hh * 60 + mm
  }

  // ISO-like (fallback): try Date parse then take local time-of-day
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

type LatLng = { lat: number; lng: number }

function tryParseLatLng(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, unknown>

  const lat = typeof v.lat === 'number' ? v.lat : typeof v.latitude === 'number' ? (v.latitude as number) : null
  const lng = typeof v.lng === 'number' ? v.lng : typeof v.longitude === 'number' ? (v.longitude as number) : null

  if (lat === null || lng === null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90) return null
  if (lng < -180 || lng > 180) return null

  return { lat, lng }
}

function mapsLink(latLng: LatLng): string {
  const qs = new URLSearchParams()
  qs.set('q', `${latLng.lat},${latLng.lng}`)
  return `https://www.google.com/maps?${qs.toString()}`
}

export default function RecordDetail() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordId = useMemo(() => parseRecordIdFromHash(), [window.location.hash])
  const isLocalPreview = isLocalPreviewMode()

  const localRecords = useMemo(() => getLocalPreviewWorkdays(), [])
  const localRecord = useMemo(() => {
    if (!recordId) return null
    return localRecords.find((r) => r.id === recordId) ?? null
  }, [recordId, localRecords])

  const [liveRecord, setLiveRecord] = useState<LiveWorkday | null>(null)

  useEffect(() => {
    setError(null)

    if (!recordId) return
    if (isLocalPreview) return

    const token = localStorage.getItem('ddworkrecord_admin_token')
    if (!token) {
      setError('Missing admin token. Paste a Firebase ID token into Token Viewer and try again.')
      return
    }

    const run = async () => {
      setLoading(true)
      try {
        const base = API_BASE_URL?.trim() || ''
        const url = `${base}/api/v1/console/workdays/${encodeURIComponent(recordId)}`
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Fetch failed: ${res.status} ${text}`.trim())
        }

        const data = (await res.json()) as LiveWorkday
        setLiveRecord(data)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [recordId, isLocalPreview])

  const backToRecords = () => {
    window.location.hash = '#records'
  }

  const recordTitle = localRecord
    ? { date: localRecord.date, employeeCode: localRecord.employeeCode, startTime: localRecord.startTime, endTime: localRecord.endTime }
    : liveRecord
      ? { date: liveRecord.date, employeeCode: liveRecord.employeeId, startTime: '', endTime: '' }
      : null

  const timelineEvents: TimelineEvent[] | null = useMemo(() => {
    if (isLocalPreview) {
      if (!localRecord) return null

      const startTime = localRecord.startTime
      const endTime = localRecord.endTime
      const base = `Local preview ${localRecord.date} (${localRecord.employeeCode})`

      return [
        {
          key: `start-${localRecord.id}`,
          time: startTime,
          label: 'Travel started (draft)',
          detail: `${base} • Vehicle: ${formatVehicleDisplay(localRecord.vehicleId)} • Start time ${startTime}`,
          timeSort: timeToSortValue(`1970-01-01T${startTime}:00Z`),
        },
        {
          key: `job-${localRecord.id}`,
          time: `${localRecord.date}T${startTime}`,
          label: 'Job entry (draft)',
          detail: ensureNonEmpty(localRecord.notes),
          timeSort: timeToSortValue(`1970-01-01T${startTime}:00Z`),
        },
        {
          key: `end-${localRecord.id}`,
          time: endTime,
          label: 'Travel stopped (draft)',
          detail: `${base} • Vehicle: ${formatVehicleDisplay(localRecord.vehicleId)} • End time ${endTime}`,
          timeSort: timeToSortValue(`1970-01-01T${endTime}:00Z`),
        },
      ].sort((a, b) => a.timeSort - b.timeSort)
    }

    if (!liveRecord) return null

    const events: TimelineEvent[] = []

    for (const t of liveRecord.travels ?? []) {
      const start = t.startTime
      const end = t.endTime

      if (start) {
        events.push({
          key: `travel-start-${start}-${events.length}`,
          time: start,
          label: 'Travel started',
          detail: `Vehicle: ${ensureNonEmpty(t.vehicleId ?? '')}`,
          timeSort: timeToSortValue(start),
        })
      }
      if (end) {
        events.push({
          key: `travel-end-${end}-${events.length}`,
          time: end,
          label: 'Travel stopped',
          detail: 'End location / mileage recorded',
          timeSort: timeToSortValue(end),
        })
      }
    }

    for (const j of liveRecord.jobs ?? []) {
      if (j.startTime) {
        events.push({
          key: `job-start-${j.startTime}-${events.length}`,
          time: j.startTime,
          label: 'Job started',
          detail: `jobId: ${ensureNonEmpty(j.jobId)}`,
          timeSort: timeToSortValue(j.startTime),
        })
      }
      if (j.endTime) {
        events.push({
          key: `job-end-${j.endTime}-${events.length}`,
          time: j.endTime,
          label: 'Job stopped',
          detail: `jobId: ${ensureNonEmpty(j.jobId)}`,
          timeSort: timeToSortValue(j.endTime),
        })
      }
    }

    for (const s of liveRecord.suppliers ?? []) {
      const arrival = s.arrivalTime
      const dep = s.departureTime

      if (arrival) {
        events.push({
          key: `supplier-start-${arrival}-${events.length}`,
          time: arrival,
          label: 'Supplier started',
          detail: `Supplier: ${ensureNonEmpty(s.supplierName)}`,
          timeSort: timeToSortValue(arrival),
        })
      }
      if (dep) {
        events.push({
          key: `supplier-end-${dep}-${events.length}`,
          time: dep,
          label: 'Supplier stopped',
          detail: `Amount spent: ${format2(Number(s.amountSpent ?? 0))}`,
          timeSort: timeToSortValue(dep),
        })
      }
    }

    for (const f of liveRecord.fuels ?? []) {
      const arrival = f.arrivalTime
      const dep = f.departureTime

      if (arrival) {
        events.push({
          key: `fuel-start-${arrival}-${events.length}`,
          time: arrival,
          label: 'Fuel started',
          detail: `Fuel cost: ${format2(Number(f.totalCost ?? 0))}`,
          timeSort: timeToSortValue(arrival),
        })
      }
      if (dep) {
        events.push({
          key: `fuel-end-${dep}-${events.length}`,
          time: dep,
          label: 'Fuel stopped',
          detail: `Liters filled: ${format2(Number(f.litersFilled ?? 0))}`,
          timeSort: timeToSortValue(dep),
        })
      }
    }

    const notes = ensureNonEmpty(liveRecord.endNotes ?? '')
    if (notes !== '—') {
      events.push({
        key: `notes-${liveRecord.id}`,
        time: liveRecord.date,
        label: 'Employee log entries',
        detail: notes,
        timeSort: timeToSortValue(`${liveRecord.date}T00:00:00Z`),
      })
    }

    return events.sort((a, b) => a.timeSort - b.timeSort)
  }, [isLocalPreview, localRecord, liveRecord])

  type TimeLogKind = 'Travel' | 'Job' | 'Supplier' | 'Fuel'
  type TimeSegment = { kind: TimeLogKind; startMin: number; endMin: number }

  const timeLogRows = useMemo(() => {
    const pad2Local = (n: number) => String(n).padStart(2, '0')
    const minutesToHHMM = (m: number) => `${pad2Local(Math.floor(m / 60))}:${pad2Local(m % 60)}`

    const segments: TimeSegment[] = []

    if (isLocalPreview) {
      if (localRecord) {
        const travelStart = parseTimeToMinutes(localRecord.startTime)
        const travelEnd = parseTimeToMinutes(localRecord.endTime)
        if (travelStart !== null && travelEnd !== null && travelEnd > travelStart) {
          segments.push({ kind: 'Travel', startMin: travelStart, endMin: travelEnd })
        }

        const jobStart = parseTimeToMinutes(localRecord.jobStartTime)
        const jobEnd = parseTimeToMinutes(localRecord.jobEndTime)
        if (jobStart !== null && jobEnd !== null && jobEnd > jobStart) {
          segments.push({ kind: 'Job', startMin: jobStart, endMin: jobEnd })
        }

        for (const s of localRecord.supplierStops ?? []) {
          const a = parseTimeToMinutes(s.arrivalTime)
          const d = parseTimeToMinutes(s.departureTime)
          if (a !== null && d !== null && d > a) segments.push({ kind: 'Supplier', startMin: a, endMin: d })
        }

        for (const f of localRecord.fuelStops ?? []) {
          const a = parseTimeToMinutes(f.arrivalTime)
          const d = parseTimeToMinutes(f.departureTime)
          if (a !== null && d !== null && d > a) segments.push({ kind: 'Fuel', startMin: a, endMin: d })
        }
      }
    } else {
      if (liveRecord) {
        for (const t of liveRecord.travels ?? []) {
          const start = t.startTime ? parseTimeToMinutes(t.startTime) : null
          const end = t.endTime ? parseTimeToMinutes(t.endTime) : null
          if (start !== null && end !== null && end > start) segments.push({ kind: 'Travel', startMin: start, endMin: end })
        }

        for (const j of liveRecord.jobs ?? []) {
          const start = j.startTime ? parseTimeToMinutes(j.startTime) : null
          const end = j.endTime ? parseTimeToMinutes(j.endTime) : null
          if (start !== null && end !== null && end > start) segments.push({ kind: 'Job', startMin: start, endMin: end })
        }

        for (const s of liveRecord.suppliers ?? []) {
          const a = s.arrivalTime ? parseTimeToMinutes(s.arrivalTime) : null
          const d = s.departureTime ? parseTimeToMinutes(s.departureTime) : null
          if (a !== null && d !== null && d > a) segments.push({ kind: 'Supplier', startMin: a, endMin: d })
        }

        for (const f of liveRecord.fuels ?? []) {
          const a = f.arrivalTime ? parseTimeToMinutes(f.arrivalTime) : null
          const d = f.departureTime ? parseTimeToMinutes(f.departureTime) : null
          if (a !== null && d !== null && d > a) segments.push({ kind: 'Fuel', startMin: a, endMin: d })
        }
      }
    }

    // 00:00 → 23:30
    const rows = []
    for (let i = 0; i < 48; i++) {
      const startMin = i * 30
      const endMin = startMin + 30

      const activeKinds = new Set<TimeLogKind>()
      for (const seg of segments) {
        const overlap = Math.max(startMin, seg.startMin) < Math.min(endMin, seg.endMin)
        if (!overlap) continue
        activeKinds.add(seg.kind)
      }

      const label = activeKinds.size ? Array.from(activeKinds).join(' + ') : '—'
      rows.push({
        timeRange: `${minutesToHHMM(startMin)}–${minutesToHHMM(endMin)}`,
        label,
      })
    }

    return rows
  }, [isLocalPreview, localRecord, liveRecord])

  type GpsPoint = { time: string; label: string; latLng: { lat: number; lng: number } }

  const gpsPoints = useMemo((): GpsPoint[] => {
    const points: GpsPoint[] = []

    if (isLocalPreview) {
      return points
    }

    if (!liveRecord) return points

    const dayStart = tryParseLatLng(liveRecord.dayStartLocation)
    if (dayStart) points.push({ time: `${liveRecord.date} • day start`, label: 'Day start GPS', latLng: dayStart })

    const dayEnd = tryParseLatLng(liveRecord.dayEndLocation)
    if (dayEnd) points.push({ time: `${liveRecord.date} • day end`, label: 'Day end GPS', latLng: dayEnd })

    for (const t of liveRecord.travels ?? []) {
      const startLoc = tryParseLatLng(t.startLocation)
      const endLoc = tryParseLatLng(t.endLocation)

      if (startLoc && t.startTime) points.push({ time: `${liveRecord.date} ${t.startTime}`, label: 'Travel start GPS', latLng: startLoc })
      if (endLoc && t.endTime) points.push({ time: `${liveRecord.date} ${t.endTime}`, label: 'Travel end GPS', latLng: endLoc })
    }

    return points
  }, [isLocalPreview, liveRecord])

  const receiptsUrls = localRecord?.attachmentUrls ?? []
  const receiptsCount = localRecord?.attachmentUrls.length ?? 0

  if (!recordId) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Record</div>
        <div style={{ marginTop: 10, color: '#ef4444', fontWeight: 900 }}>
          Missing record id in URL hash. Expected: <span style={{ fontFamily: 'ui-monospace' }}>{'#record/<id>'}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 800 }}>
          {error}
        </div>
      </div>
    )
  }

  if (isLocalPreview && !localRecord) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Record Detail</div>
        <div style={{ marginTop: 10, color: '#ef4444', fontWeight: 900 }}>Record not found in sandbox drafts.</div>
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#records'
            }}
            style={{
              padding: '8px 12px',
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 900,
            }}
          >
            ← Back to Records
          </button>
        </div>
      </div>
    )
  }

  if (!isLocalPreview && loading) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Loading record…</div>
        <div style={{ marginTop: 8, color: '#64748b', fontWeight: 800 }}>Fetching synced workday detail.</div>
      </div>
    )
  }

  if (!isLocalPreview && !liveRecord) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 920 }}>
        <div style={{ fontWeight: 1000, fontSize: 18 }}>Record Detail</div>
        <div style={{ marginTop: 10, color: '#ef4444', fontWeight: 900 }}>Workday record not found.</div>
      </div>
    )
  }

  if (!recordTitle || !timelineEvents) return null

  const startTimeLabel = isLocalPreview ? localRecord!.startTime : '—'
  const endTimeLabel = isLocalPreview ? localRecord!.endTime : '—'

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
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Full Day Report</div>
          <div style={{ marginTop: 6, color: '#475569', fontWeight: 900 }}>
            {recordTitle.date} • {recordTitle.employeeCode}
          </div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {startTimeLabel} → {endTimeLabel}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={backToRecords}
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
            ← Back to Records
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface, overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: `2px solid ${theme.text}`, background: theme.accentBg }}>
          <div style={{ fontWeight: 1000 }}>Totals</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {isLocalPreview ? 'Sandbox record' : 'Synced record'}
          </div>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Total Hours</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {isLocalPreview ? format2(localRecord!.totalHours) : format2(liveRecord!.totalHours)}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Distance (Km)</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {isLocalPreview ? format2(localRecord!.totalDistanceKm) : format2(liveRecord!.totalDistanceKm)}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Fuel</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {isLocalPreview ? format2(localRecord!.fuelCost) : '—'}
            </div>
          </div>

          <div style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12 }}>
            <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Supplier</div>
            <div style={{ marginTop: 8, fontSize: 26, fontWeight: 1000 }}>
              {isLocalPreview ? format2(localRecord!.supplierSpend) : '—'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Full Day Report</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {isLocalPreview
              ? 'Timeline (sandbox draft) • Derived from iOS entry times + notes'
              : 'Timeline (synced) • Derived from travels/jobs/suppliers/fuels segments'}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {timelineEvents.map((e) => (
              <div key={e.key} style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 1000 }}>{e.label}</div>
                  <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>{e.time}</div>
                </div>
                <div style={{ marginTop: 6, color: '#0f172a', fontWeight: 800, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{e.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exact time log (30-minute intervals) */}
      <div style={{ marginTop: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Exact Time Log (30 min)</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {isLocalPreview ? 'Sandbox draft • derived from travel/job/supplier/fuel windows' : 'Synced • derived from travels/jobs/suppliers/fuels segments'}
          </div>
        </div>

        <div style={{ padding: 14, overflow: 'auto' }}>
          {timeLogRows.length === 0 ? (
            <div style={{ padding: 12, border: '2px dashed #0f172a', borderRadius: 12, fontWeight: 900, color: '#64748b' }}>
              No time-log data found.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {timeLogRows.map((r, i) => (
                <div key={`${r.timeRange}-${i}`} style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 1000 }}>{r.timeRange}</div>
                    <div style={{ color: '#64748b', fontWeight: 900, fontSize: 12 }}>Active</div>
                  </div>
                  <div style={{ marginTop: 8, fontWeight: 1000, color: '#0f172a' }}>{r.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GPS points */}
      <div style={{ marginTop: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
          <div style={{ fontWeight: 1000, fontSize: 16 }}>Saved GPS points</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {isLocalPreview ? 'Sandbox drafts don’t persist GPS yet.' : 'Travel segment endpoints + day start/end (when available).'}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          {isLocalPreview ? (
            <div style={{ padding: 12, border: '2px dashed #0f172a', borderRadius: 12, fontWeight: 900, color: '#64748b' }}>
              GPS is not stored in the local preview sandbox.
            </div>
          ) : gpsPoints.length === 0 ? (
            <div style={{ padding: 12, border: '2px dashed #0f172a', borderRadius: 12, fontWeight: 900, color: '#64748b' }}>
              No GPS coordinates returned for this record.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {gpsPoints.map((p, i) => (
                <div key={`${p.time}-${i}`} style={{ padding: 12, border: '2px solid #0f172a', borderRadius: 12, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 1000 }}>{p.label}</div>
                      <div style={{ marginTop: 4, color: '#475569', fontWeight: 800, fontSize: 12 }}>{p.time}</div>
                      <div style={{ marginTop: 6, color: '#0f172a', fontWeight: 1000, fontFamily: 'ui-monospace' }}>
                        {p.latLng.lat.toFixed(6)}, {p.latLng.lng.toFixed(6)}
                      </div>
                    </div>

                    <a
                      href={mapsLink(p.latLng)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '10px 12px',
                        border: `2px solid #0f172a`,
                        borderRadius: 10,
                        background: '#fff',
                        cursor: 'pointer',
                        fontWeight: 1000,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Open in Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '2px solid #0f172a', background: '#f8fafc' }}>
          <div style={{ fontWeight: 1000 }}>Receipts / Invoices</div>
          <div style={{ marginTop: 4, color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            {isLocalPreview ? `${receiptsCount} attachment(s)` : '— synced receipts not wired yet'}
          </div>
        </div>

        <div style={{ padding: 14 }}>
          {isLocalPreview ? (
            receiptsUrls.length === 0 ? (
              <div style={{ padding: 12, border: '2px dashed #0f172a', borderRadius: 12, fontWeight: 900, color: '#64748b' }}>
                No receipt photos for this sandbox record.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {receiptsUrls.map((url, i) => (
                  <div key={`${url}-${i}`} style={{ border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                    <img src={url} alt={`receipt-${i + 1}`} style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: 10, fontSize: 12, fontWeight: 900, color: '#0f172a' }}>Receipt #{i + 1}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ padding: 12, border: '2px dashed #0f172a', borderRadius: 12, fontWeight: 900, color: '#64748b' }}>
              Synced receipt URLs not yet included in this backend response.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
