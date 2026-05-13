// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { useEffect, useMemo, useState } from 'react'
import { isLocalPreviewMode } from '../lib/localPreview'
import { API_BASE_URL } from '../lib/api'

type SyncStatus = 'idle' | 'queued' | 'syncing' | 'synced' | 'error'

type WorkdayRecordDraft = {
  localId: string
  // Required master-prompt fields
  date: string
  startTime: string
  endTime: string
  mileage: number | null
  fuelCost: number | null
  supplierCost: number | null
  jobDescription: string
  notes: string
  // Optional photo URLs after upload
  attachmentUrls: string[]
  // Offline sync bookkeeping
  syncStatus: SyncStatus
  lastError?: string
  // Payload shape expected by backend `/api/v1/workday/sync`
  syncPayloadId: string
}

const STORAGE_KEY = 'ddworkrecord_draft_queue_v1'

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10)

const calcTotalHours = (startTime: string, endTime: string): number => {
  // startTime/endTime are "HH:MM"
  const [sh, sm] = startTime.split(':').map((x) => Number(x))
  const [eh, em] = endTime.split(':').map((x) => Number(x))
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 0

  const start = sh * 60 + sm
  const end = eh * 60 + em
  const minutes = end - start
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

function loadQueue(): WorkdayRecordDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as WorkdayRecordDraft[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveQueue(items: WorkdayRecordDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

async function uploadPhoto(file: File, token: string | null): Promise<string> {
  const form = new FormData()
  form.append('photo', file)

  // Backend multer filename uses req.body.photoId (optional). We'll generate one.
  const photoId = crypto.randomUUID()
  form.append('photoId', photoId)

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const base = API_BASE_URL?.trim() || ''
  const url = `${base}/api/v1/media/upload`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
  })

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = (await res.json()) as { success: boolean; url: string }
  return data.url
}

async function syncOne(draft: WorkdayRecordDraft, token: string | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  // Backend expects these fields:
  // id, employeeId, date, startMileage/endMileage, totalHours, totalDistanceKm
  // plus jobs/fuels/suppliers arrays and endNotes.
  const totalHours = calcTotalHours(draft.startTime, draft.endTime)

  const payload = {
    id: draft.syncPayloadId,
    employeeId: 'UNKNOWN', // TODO: set from logged-in identity/claims
    date: draft.date,
    startMileage: draft.mileage,
    endMileage: draft.mileage,
    totalHours,
    totalDistanceKm: draft.mileage ?? 0,
    jobs: [
      {
        jobId: 'job',
        startTime: draft.startTime,
        endTime: draft.endTime,
        status: 'completed',
      },
    ],
    fuels: [
      {
        litersFilled: 0,
        totalCost: draft.fuelCost ?? 0,
        arrivalTime: `${draft.date}T${draft.endTime}:00.000Z`,
      },
    ],
    suppliers: [
      {
        supplierName: 'supplier',
        amountSpent: draft.supplierCost ?? 0,
        arrivalTime: `${draft.date}T${draft.endTime}:00.000Z`,
      },
    ],
    workshops: [],
    travels: [],
    privateSegments: [],
    vehicleId: null,
    endNotes: draft.notes || null,
    dayStartLocation: undefined,
    dayEndLocation: undefined,
  }

  const base = API_BASE_URL?.trim() || ''
  const url = `${base}/api/v1/workday/sync`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sync failed: ${res.status} ${body}`.trim())
  }
  return res.json().catch(() => ({}))
}

export default function AddDailyRecord() {
  const token = localStorage.getItem('ddworkrecord_admin_token')
  const localPreview = isLocalPreviewMode()

  const today = useMemo(() => toIsoDate(new Date()), [])
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [mileage, setMileage] = useState<string>('')
  const [fuelCost, setFuelCost] = useState<string>('')
  const [supplierCost, setSupplierCost] = useState<string>('')
  const [jobDescription, setJobDescription] = useState('')
  const [notes, setNotes] = useState('')

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const totalHours = useMemo(() => calcTotalHours(startTime, endTime), [startTime, endTime])

  // Online auto-sync (best-effort) — disabled in local preview mode
  useEffect(() => {
    if (localPreview) return

    const trySyncQueue = async () => {
      const queue = loadQueue()
      if (!navigator.onLine || queue.length === 0) return

      let changed = false
      for (const item of queue) {
        if (item.syncStatus !== 'queued' && item.syncStatus !== 'error') continue

        try {
          changed = true
          setSyncStatus('syncing')
          const next = loadQueue()
          const before = next.find((x) => x.localId === item.localId)
          if (!before) continue
          before.syncStatus = 'syncing'
          before.lastError = undefined
          saveQueue(next)

          await syncOne(before, token)

          const afterSync = loadQueue()
          const after = afterSync.find((x) => x.localId === item.localId)
          if (after) {
            after.syncStatus = 'synced'
            after.lastError = undefined
          }
          saveQueue(afterSync)
          changed = true
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Sync error'
          const afterErr = loadQueue()
          const target = afterErr.find((x) => x.localId === item.localId)
          if (target) {
            target.syncStatus = 'error'
            target.lastError = message
          }
          saveQueue(afterErr)
          setError(message)
          setSyncStatus('error')
          changed = true
        }
      }

      if (changed) {
        const latest = loadQueue()
        const anyQueued = latest.some((x) => x.syncStatus === 'queued')
        if (!anyQueued) setSyncStatus('synced')
      }
    }

    window.addEventListener('online', () => {
      void trySyncQueue()
    })

    // Initial attempt
    void trySyncQueue()

    return () => {
      window.removeEventListener('online', () => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const queueDraft = () => {
    const localId = crypto.randomUUID()
    const syncPayloadId = crypto.randomUUID()

    const mileageNum = mileage.trim() ? Number(mileage) : null
    const fuelNum = fuelCost.trim() ? Number(fuelCost) : null
    const supplierNum = supplierCost.trim() ? Number(supplierCost) : null

    const draft: WorkdayRecordDraft = {
      localId,
      syncPayloadId,
      date,
      startTime,
      endTime,
      mileage: Number.isFinite(mileageNum) && mileageNum !== null ? mileageNum : null,
      fuelCost: Number.isFinite(fuelNum) && fuelNum !== null ? fuelNum : null,
      supplierCost: Number.isFinite(supplierNum) && supplierNum !== null ? supplierNum : null,
      jobDescription,
      notes,
      attachmentUrls: [],
      syncStatus: navigator.onLine ? 'queued' : 'queued',
    }

    const queue = loadQueue()
    queue.push(draft)
    saveQueue(queue)
    setSyncStatus('queued')
    setError(null)
  }

  const validate = (): string | null => {
    if (!date.trim()) return 'Date is required.'
    if (!startTime.trim()) return 'Start time is required.'
    if (!endTime.trim()) return 'End time is required.'
    if (!totalHours || totalHours <= 0) return 'End time must be after start time.'
    return null
  }

  const submit = async () => {
    setError(null)
    const v = validate()
    if (v) {
      setError(v)
      setSyncStatus('error')
      return
    }

    if (!localPreview && !token) {
      setError('Cloud sync requires an active admin token. Please login first.')
      setSyncStatus('error')
      return
    }

    setSyncStatus('syncing')

    // Auto-save draft into local queue for offline-first behavior.
    queueDraft()
    setSyncStatus('queued')

    // Best-effort immediate sync if online (disabled in local preview mode)
    if (!localPreview && navigator.onLine) {
      try {
        const queue = loadQueue()
        const newest = queue[queue.length - 1]
        await syncOne(newest, token)
        const after = loadQueue()
        const item = after.find((x) => x.localId === newest.localId)
        if (item) item.syncStatus = 'synced'
        saveQueue(after)
        setSyncStatus('synced')
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Sync error'
        setError(message)
        setSyncStatus('error')
      }
    } else if (localPreview) {
      setSyncStatus('synced')
    }
  }

  const syncLabel =
    syncStatus === 'queued'
      ? 'Queued (will sync when online)'
      : syncStatus === 'syncing'
        ? 'Syncing…'
        : syncStatus === 'synced'
          ? 'Synced ✓'
          : syncStatus === 'error'
            ? 'Sync error'
            : 'Idle'

  const [showErrorDetails, setShowErrorDetails] = useState(false)

  const formatErrorForUi = (raw: string): { title: string; short: string; long: string } => {
    const cleaned = raw.replace(/\s+/g, ' ').trim()
    const long = raw
    const shortLimit = 220
    const short =
      cleaned.length > shortLimit ? `${cleaned.slice(0, shortLimit)}… (truncated)` : cleaned
    const title =
      raw.toLowerCase().includes('unauthorized') || raw.toLowerCase().includes('forbidden')
        ? 'Sync failed: token/permissions rejected'
        : raw.toLowerCase().includes('missing')
          ? 'Sync failed: missing required data'
          : 'Sync failed'

    return { title, short, long }
  }

  const errorUi = error ? formatErrorForUi(error) : null

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Add Daily Record</h1>
      <p style={{ marginTop: 8, color: '#475569' }}>
        Offline-first entry form. We auto-save to local storage and sync when online.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 14,
          border: '2px solid #0f172a',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900 }}>
            Sync status: {syncLabel}
          </div>

          {error ? (
            <button
              type="button"
              onClick={() => setShowErrorDetails((v) => !v)}
              style={{
                padding: '8px 10px',
                border: '2px solid #0f172a',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              {showErrorDetails ? 'Hide details' : 'View details'}
            </button>
          ) : null}
        </div>

        {error ? (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: '#b91c1c', fontWeight: 1000 }}>{errorUi?.title}</div>
            <div style={{ marginTop: 6, color: '#dc2626', fontWeight: 750 }}>
              {errorUi?.short}
            </div>

            {showErrorDetails ? (
              <pre
                style={{
                  marginTop: 10,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: '#0b1220',
                  color: '#e5e7eb',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid #334155',
                  fontSize: 12,
                  maxHeight: 260,
                  overflow: 'auto',
                }}
              >
                {errorUi?.long}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Date</label>
          <input
            title="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Start time</label>
          <input
            title="Start time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            type="time"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>End time</label>
          <input
            title="End time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            type="time"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Auto total hours</label>
          <div style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 900 }}>{totalHours}</div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Mileage (km)</label>
          <input
            title="Mileage (kilometers)"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 120"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Fuel cost</label>
          <input
            title="Fuel cost"
            value={fuelCost}
            onChange={(e) => setFuelCost(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 45"
            style={{ width: '100%', padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Supplier cost</label>
          <input
            value={supplierCost}
            onChange={(e) => setSupplierCost(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 80"
            style={{ width: '100%', padding: 10 }}
            title="Supplier cost"
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Job description</label>
        <textarea
          title="Job description"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: 10 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Notes</label>
        <textarea
          title="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ width: '100%', padding: 10 }}
        />
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          disabled={syncStatus === 'syncing'}
          onClick={() => { if (syncStatus !== 'syncing') void submit() }}
          style={{
            padding: '12px 16px',
            border: '2px solid #0f172a',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 900,
          }}
        >
          {syncStatus === 'syncing' ? 'Saving...' : 'Save (offline-ready)'}
        </button>

        <div style={{ color: '#64748b', fontWeight: 700 }}>
          Required fields: Date, Start time, End time, Mileage (optional), Fuel/Supplier (optional), Job + Notes (optional).
        </div>
      </div>
    </div>
  )
}
