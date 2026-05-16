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
  // local-preview only
  vehicleId: string | null
  totalHours: number
  jobHours: number
  jobStartTime: string
  jobEndTime: string
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

  // Mon–Fri within 07:30–16:30 (non-holiday)
  normalHours: number

  // Mon–Fri outside 07:30–16:30 (non-holiday)
  weekdayOvertimeHours: number

  // Saturday (non-holiday)
  saturdayHours: number

  // Sunday (non-holiday)
  sundayHours: number

  // Public holiday hours depend on the local-preview sandbox country selection.
  publicHolidayHours: number

  // Legacy field used by existing UI: overtimeHours = totalHours - normalHours
  overtimeHours: number

  fuelCost: number
  supplierSpend: number
}

type Draft = {
  localId: string
  date: string
  startTime: string
  endTime: string
  // new: seed now stores the employeeCode directly
  employeeCode?: string
  // local-preview only
  vehicleId?: string | null
  mileage: number | null
  fuelCost: number | null
  supplierCost: number | null

  // iOS job segment times (for job-segment hour reports)
  jobStartTime?: string
  jobEndTime?: string

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
const LOCAL_PREVIEW_COUNTRY_KEY = 'ddworkrecord_local_preview_country'
const BUSINESS_COUNTRY_KEY = 'ddworkrecord_business_country'
type PreviewCountry = 'ZA' | 'US'

function normalizeCountry(raw: string | null): PreviewCountry | null {
  if (raw === 'US') return 'US'
  if (raw === 'ZA') return 'ZA'
  return null
}

function readPreviewCountry(): PreviewCountry {
  try {
    // 1) explicit sandbox override
    const localRaw = localStorage.getItem(LOCAL_PREVIEW_COUNTRY_KEY)
    const local = normalizeCountry(localRaw)
    if (local) return local

    // 2) fallback to globally registered business country
    const businessRaw = localStorage.getItem(BUSINESS_COUNTRY_KEY)
    const business = normalizeCountry(businessRaw)
    if (business) return business

    // 3) default
    return 'ZA'
  } catch {
    return 'ZA'
  }
}

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

      const jobStartTime =
        typeof d.jobStartTime === 'string' && d.jobStartTime.trim() ? d.jobStartTime.trim() : d.startTime

      const jobEndTime =
        typeof d.jobEndTime === 'string' && d.jobEndTime.trim() ? d.jobEndTime.trim() : d.endTime

      const jobHours = calcDurationHours(jobStartTime, jobEndTime)

      // Back-compat: older seeded drafts didn't store employeeCode.
      const employeeCode =
        typeof d.employeeCode === 'string' && d.employeeCode.trim()
          ? d.employeeCode.trim()
          : codes[hashStringToInt(`${d.localId}:${d.date}:${d.startTime}`) % codes.length]

      const vehicleId = typeof d.vehicleId === 'string' && d.vehicleId.trim() ? d.vehicleId.trim() : null

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
        vehicleId,
        totalHours,
        jobHours,
        jobStartTime,
        jobEndTime,
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

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const parseDateUtc = (isoDate: string) => new Date(`${isoDate}T00:00:00.000Z`)

  const previewCountry = readPreviewCountry()

  // Public holiday calculation for sandbox preview-only.
  // Fixed-date holidays only (movable holidays not included yet).
  const isPublicHolidayUtc = (isoDate: string): boolean => {
    const d = parseDateUtc(isoDate)
    const month = d.getUTCMonth() // 0-11
    const day = d.getUTCDate() // 1-31

    if (previewCountry === 'US') {
      // Minimal fixed-date USA set for now (extend later).
      const fixedUS: Array<[number, number]> = [
        [0, 1], // Jan 1
        [6, 4], // Jul 4
        [11, 25], // Dec 25
      ]
      return fixedUS.some(([m, dd]) => m === month && dd === day)
    }

    // South Africa fixed-date public holidays (preview-only).
    const fixedZA: Array<[number, number]> = [
      [0, 1], // Jan 1
      [2, 21], // Mar 21
      [3, 27], // Apr 27 (Freedom Day)
      [4, 1], // May 1 (Workers' Day)
      [5, 16], // Jun 16 (Youth Day)
      [7, 9], // Aug 9 (National Women's Day)
      [8, 24], // Sep 24 (Heritage Day)
      [11, 16], // Dec 16 (Day of Reconciliation)
      [11, 25], // Dec 25 (Christmas)
      [11, 26], // Dec 26 (Day of Goodwill)
    ]

    return fixedZA.some(([m, dd]) => m === month && dd === day)
  }

  const normalStartMin = 7 * 60 + 30 // 07:30
  const normalEndMin = 16 * 60 + 30 // 16:30

  let totalMinutes = 0
  let normalMinutes = 0
  let weekdayOvertimeMinutes = 0
  let saturdayMinutes = 0
  let sundayMinutes = 0
  let publicHolidayMinutes = 0

  let fuelCost = 0
  let supplierSpend = 0

  for (const d of drafts) {
    const start = toMinutes(d.startTime)
    const end = toMinutes(d.endTime)
    if (start === null || end === null) continue

    const minutes = Math.max(0, end - start)
    if (minutes <= 0) continue

    totalMinutes += minutes

    const isHoliday = isPublicHolidayUtc(d.date)
    const dateUtc = parseDateUtc(d.date)
    const dow = dateUtc.getUTCDay() // Sun=0..Sat=6

    if (isHoliday) {
      publicHolidayMinutes += minutes
    } else if (dow === 6) {
      // Saturday
      saturdayMinutes += minutes
    } else if (dow === 0) {
      // Sunday
      sundayMinutes += minutes
    } else {
      // Mon-Fri: split normal vs weekday overtime
      const overlap = clamp(Math.min(end, normalEndMin) - Math.max(start, normalStartMin), 0, minutes)
      normalMinutes += overlap
      weekdayOvertimeMinutes += minutes - overlap
    }

    fuelCost += d.fuelCost ?? 0
    supplierSpend += d.supplierCost ?? 0
  }

  const totalHours = roundHours(totalMinutes / 60)
  const normalHours = roundHours(normalMinutes / 60)
  const weekdayOvertimeHours = roundHours(weekdayOvertimeMinutes / 60)
  const saturdayHours = roundHours(saturdayMinutes / 60)
  const sundayHours = roundHours(sundayMinutes / 60)
  const publicHolidayHours = roundHours(publicHolidayMinutes / 60)

  return {
    totalHours,
    normalHours,
    weekdayOvertimeHours,
    saturdayHours,
    sundayHours,
    publicHolidayHours,
    // legacy field expected by existing UI:
    // "overtimeHours" = weekday overtime only (Sat/Sun/PH are separate buckets)
    overtimeHours: weekdayOvertimeHours,
    fuelCost: Math.round(fuelCost * 100) / 100,
    supplierSpend: Math.round(supplierSpend * 100) / 100,
  }
}
