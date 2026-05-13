import type { Period } from './api'
import { getEmployeeCodes, getDefaultEmployeeCount } from './localPreviewSeed'

type LocalPreviewAttachment = { id: string; url: string }

export type SupplierStop = {
  arrivalTime: string
  departureTime: string
  arrivalLocation: string
  departureLocation: string
  supplierName: string
  amountSpent: number
  whatPurchased: string
  jobId: string | null
  startMileage: number | null
  endMileage: number | null
  distanceMeters: number | null
  durationHours: number
  photoReceiptIds: string[]
}

export type FuelStop = {
  arrivalTime: string
  departureTime: string
  arrivalLocation: string
  departureLocation: string
  startMileage: number | null
  endMileage: number | null
  distanceMeters: number | null
  litersFilled: number
  totalCost: number
  fuelStationName: string | null
  photoReceiptIds: string[]
  durationHours: number
}

export type LocalPreviewWorkday = {
  id: string
  date: string
  startTime: string
  endTime: string
  employeeCode: string
  totalHours: number
  totalDistanceKm: number
  mileage: number | null
  fuelCost: number
  supplierSpend: number
  notes: string
  attachmentUrls: string[]

  // iOS job fields (for Jobs tab filters/UI)
  jobIdNumber: string
  clientName: string
  siteName: string
  location: string
  jobStatus: 'complete' | 'return-required'
  jobDescription: string

  // iOS supplier/fuel fields (for dedicated tabs)
  supplierStops: SupplierStop[]
  fuelStops: FuelStop[]
}

export type LocalPreviewMonthBreakdownBase = {
  totalHours: number
  normalHours: number
  overtimeHours: number
  fuelCost: number
  supplierSpend: number
}

type Draft = {
  localId: string
  date: string
  startTime: string
  endTime: string
  mileage: number | null
  fuelCost: number | null
  supplierCost: number | null

  // iOS job fields (needed for the Jobs tab filters)
  jobIdNumber: string
  clientName: string
  siteName: string
  location: string
  jobStatus: 'complete' | 'return-required'

  jobDescription: string
  notes: string
  attachmentUrls: string[]

  // iOS supplier/fuel stop fields (for supplier/fuel tabs)
  supplierStops: Array<{
    arrivalTime: string
    departureTime: string
    arrivalLocation: string
    departureLocation: string
    supplierName: string
    amountSpent: number
    whatPurchased: string
    jobId: string | null
    startMileage: number | null
    endMileage: number | null
    distanceMeters: number | null
    photoReceiptIds: string[]
  }>

  fuelStops: Array<{
    arrivalTime: string
    departureTime: string
    arrivalLocation: string
    departureLocation: string
    startMileage: number | null
    endMileage: number | null
    distanceMeters: number | null
    litersFilled: number
    totalCost: number
    fuelStationName: string | null
    photoReceiptIds: string[]
  }>

  syncStatus: 'idle' | 'queued' | 'syncing' | 'synced' | 'error'
}

const STORAGE_KEY = 'ddworkrecord_draft_queue_v1'

export function toMinutes(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function roundHours(h: number): number {
  return Math.round(h * 100) / 100
}

function calcTotalHours(startTime: string, endTime: string): number {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null) return 0
  const minutes = end - start
  if (minutes <= 0) return 0
  return roundHours(minutes / 60)
}

function calcNormalOvertimeHours(startTime: string, endTime: string): { normalHours: number; overtimeHours: number } {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null) return { normalHours: 0, overtimeHours: 0 }
  const totalMinutes = end - start
  if (totalMinutes <= 0) return { normalHours: 0, overtimeHours: 0 }

  const normalStart = 7 * 60
  const normalEnd = 17 * 60

  const normalOverlapStart = Math.max(start, normalStart)
  const normalOverlapEnd = Math.min(end, normalEnd)
  const normalMinutes = Math.max(0, normalOverlapEnd - normalOverlapStart)
  const overtimeMinutes = Math.max(0, totalMinutes - normalMinutes)

  return { normalHours: roundHours(normalMinutes / 60), overtimeHours: roundHours(overtimeMinutes / 60) }
}

function calcDurationHours(startTime: string, endTime: string): number {
  const h = calcTotalHours(startTime, endTime)
  return h
}

function loadDrafts(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Draft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getLocalPreviewDraftCount(): number {
  return loadDrafts().length
}

export function getLocalPreviewWorkdays(): LocalPreviewWorkday[] {
  const drafts = loadDrafts()
  const employeeCount = getDefaultEmployeeCount()
  const codes = getEmployeeCodes(employeeCount)

  function hashStringToInt(s: string): number {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

  return drafts
    .map((d) => {
      const totalHours = calcTotalHours(d.startTime, d.endTime)
      const totalDistanceKm = d.mileage ?? 0
      const fuelCost = d.fuelCost ?? 0
      const supplierSpend = d.supplierCost ?? 0

      const idx = hashStringToInt(`${d.localId}:${d.date}:${d.startTime}`) % codes.length
      const employeeCode = codes[idx]

      const supplierStops: SupplierStop[] = (d.supplierStops ?? []).map((s) => {
        const durationHours = calcDurationHours(s.arrivalTime, s.departureTime)
        return {
          arrivalTime: s.arrivalTime,
          departureTime: s.departureTime,
          arrivalLocation: s.arrivalLocation,
          departureLocation: s.departureLocation,
          supplierName: s.supplierName,
          amountSpent: s.amountSpent,
          whatPurchased: s.whatPurchased,
          jobId: s.jobId,
          startMileage: s.startMileage,
          endMileage: s.endMileage,
          distanceMeters: s.distanceMeters,
          durationHours,
          photoReceiptIds: s.photoReceiptIds ?? [],
        }
      })

      const fuelStops: FuelStop[] = (d.fuelStops ?? []).map((f) => {
        const durationHours = calcDurationHours(f.arrivalTime, f.departureTime)
        return {
          arrivalTime: f.arrivalTime,
          departureTime: f.departureTime,
          arrivalLocation: f.arrivalLocation,
          departureLocation: f.departureLocation,
          startMileage: f.startMileage,
          endMileage: f.endMileage,
          distanceMeters: f.distanceMeters,
          litersFilled: f.litersFilled,
          totalCost: f.totalCost,
          fuelStationName: f.fuelStationName,
          photoReceiptIds: f.photoReceiptIds ?? [],
          durationHours,
        }
      })

      return {
        id: d.localId,
        date: d.date,
        startTime: d.startTime,
        endTime: d.endTime,
        employeeCode,
        totalHours,
        totalDistanceKm,
        mileage: d.mileage ?? null,
        fuelCost,
        supplierSpend,
        jobIdNumber: d.jobIdNumber,
        clientName: d.clientName,
        siteName: d.siteName,
        location: d.location,
        jobStatus: d.jobStatus,
        jobDescription: d.jobDescription ?? '',
        notes: d.notes ?? '',
        attachmentUrls: d.attachmentUrls ?? [],

        supplierStops,
        fuelStops,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getLocalPreviewSummary(period: Period, employeeCode?: string | null) {
  const workdays = getLocalPreviewWorkdays()

  const filtered =
    employeeCode && employeeCode.trim()
      ? workdays.filter((w) => w.employeeCode === employeeCode.trim())
      : workdays

  const totalHours = filtered.reduce((acc, w) => acc + (Number.isFinite(w.totalHours) ? w.totalHours : 0), 0)
  const totalDistanceKm = filtered.reduce((acc, w) => acc + (Number.isFinite(w.totalDistanceKm) ? w.totalDistanceKm : 0), 0)
  const fuelCost = filtered.reduce((acc, w) => acc + (Number.isFinite(w.fuelCost) ? w.fuelCost : 0), 0)
  const supplierSpend = filtered.reduce((acc, w) => acc + (Number.isFinite(w.supplierSpend) ? w.supplierSpend : 0), 0)

  return { period, totalHours, totalDistanceKm, fuelCost, supplierSpend, count: filtered.length }
}

export function getLocalPreviewMonthBreakdownBase(): LocalPreviewMonthBreakdownBase {
  const drafts = loadDrafts()

  let totalHours = 0
  let normalHours = 0
  let overtimeHours = 0
  let fuelCost = 0
  let supplierSpend = 0

  for (const d of drafts) {
    const h = calcTotalHours(d.startTime, d.endTime)
    const split = calcNormalOvertimeHours(d.startTime, d.endTime)

    totalHours += h
    normalHours += split.normalHours
    overtimeHours += split.overtimeHours

    fuelCost += d.fuelCost ?? 0
    supplierSpend += d.supplierCost ?? 0
  }

  return {
    totalHours: roundHours(totalHours),
    normalHours: roundHours(normalHours),
    overtimeHours: roundHours(overtimeHours),
    fuelCost: Math.round(fuelCost * 100) / 100,
    supplierSpend: Math.round(supplierSpend * 100) / 100,
  }
}
