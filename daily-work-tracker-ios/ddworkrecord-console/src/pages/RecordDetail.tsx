import { useEffect, useMemo, useState } from 'react'
import { getLocalPreviewWorkdays } from '../lib/localPreviewData'
import { isLocalPreviewMode } from '../lib/localPreview'
import { API_BASE_URL } from '../lib/api'
import { theme } from '../lib/theme'

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
          detail: `${base} • Start time ${startTime}`,
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
          detail: `${base} • End time ${endTime}`,
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
