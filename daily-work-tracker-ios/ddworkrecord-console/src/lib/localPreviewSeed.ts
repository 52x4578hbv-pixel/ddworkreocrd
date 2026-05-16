import type { Period } from './api'
import { getLocalPreviewMonthBreakdownBase } from './localPreviewData'

type SyncStatus = 'idle' | 'queued' | 'syncing' | 'synced' | 'error'

type JobStatus = 'complete' | 'return-required'

type SupplierStopDraft = {
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
}

type FuelStopDraft = {
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
}

type Draft = {
  localId: string
  date: string
  startTime: string
  endTime: string
  employeeCode: string

  // iOS job segment times (used for job-segment hour reporting)
  jobStartTime?: string
  jobEndTime?: string

  // local-preview only (for “Travel started/stopped (draft)” display)
  vehicleId: string | null

  mileage: number | null
  fuelCost: number | null
  supplierCost: number | null

  // iOS job fields (needed for the Jobs tab filters)
  jobIdNumber: string
  clientName: string
  siteName: string
  location: string
  jobStatus: JobStatus

  jobDescription: string
  notes: string
  attachmentUrls: string[]

  // iOS supplier/fuel stop fields (for supplier/fuel tabs)
  supplierStops: SupplierStopDraft[]
  fuelStops: FuelStopDraft[]

  syncStatus: SyncStatus
  syncPayloadId: string
}

const STORAGE_KEY = 'ddworkrecord_draft_queue_v1'

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStringToInt(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0')
}

function employeeCode(i: number): string {
  return `EMP-${pad3(i)}`
}

function seededNumber(seed: number, min: number, max: number): number {
  const rnd = mulberry32(seed)
  return min + (max - min) * rnd()
}

function pick<T>(seed: number, values: readonly T[]): T {
  const rnd = mulberry32(seed)
  const idx = Math.floor(rnd() * values.length)
  return values[Math.max(0, Math.min(values.length - 1, idx))]
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`
}

function calcTotalMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map((x) => Number(x))
  const [eh, em] = endTime.split(':').map((x) => Number(x))
  if (!Number.isFinite(sh) || !Number.isFinite(sm) || !Number.isFinite(eh) || !Number.isFinite(em)) return 0
  return (eh * 60 + em) - (sh * 60 + sm)
}

function generateStartEndTimes(rndSeed: number): { startTime: string; endTime: string } {
  const startHour = clamp(Math.round(seededNumber(rndSeed + 1, 7, 9)), 7, 9)
  const startMin = clamp(Math.round(seededNumber(rndSeed + 2, 0, 55) / 5) * 5, 0, 55)

  const startTotal = startHour * 60 + startMin
  let endTotal = startTotal + Math.max(60, Math.round(seededNumber(rndSeed + 3, 7, 10) * 60))

  const dayMax = 23 * 60 + 55
  if (endTotal > dayMax) endTotal = dayMax
  if (endTotal <= startTotal) endTotal = Math.min(dayMax, startTotal + 60)

  const endHour = Math.floor(endTotal / 60)
  const endMin = endTotal % 60

  return { startTime: `${pad2(startHour)}:${pad2(startMin)}`, endTime: `${pad2(endHour)}:${pad2(endMin)}` }
}

function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${pad2(h)}:${pad2(m)}`
}

function toMinutes(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map((x) => Number(x))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function computeHours(startTime: string, endTime: string): number {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start === null || end === null) return 0
  const minutes = end - start
  if (minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

function computeDistanceMeters(startMileage: number, endMileage: number): number {
  const km = Math.max(0, endMileage - startMileage)
  return km * 1000
}

function loadQueue(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Draft[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue(queue: Draft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

function computeMileageKm(rnd: number): number {
  return Math.round(rnd * 220 + 20)
}

function calcTotalHours(startTime: string, endTime: string): number {
  return computeHours(startTime, endTime)
}

export type LocalPreviewSeedConfig = {
  employeeCount: number
  months: number
  workdaysPerMonth: number
}

function makeReceiptId(seed: number, idx: number): string {
  return `rcpt-${seed.toString(16)}-${idx}-${Math.floor(mulberry32(seed + idx)() * 1e6).toString(16)}`
}

function makeLocations(seed: number): { arrival: string; departure: string; arrivalLoc: string; departureLoc: string } {
  const yards = ['Port Area', 'Main Yard', 'Client Depot', 'Warehouse District', 'City Service Center', 'Industrial Gate']
  const arrival = pick(seed + 1, yards)
  const departure = pick(seed + 2, yards)
  return {
    arrival,
    departure,
    arrivalLoc: `${arrival} • Marigot`,
    departureLoc: `${departure} • Marigot`,
  }
}

function makeSupplierStops(seedBase: number, jobIdNumber: string, totalStart: string, totalEnd: string, startMileage: number | null, endMileage: number | null): SupplierStopDraft[] {
  const suppliers = ['Supreme Parts', 'AgriSupply', 'BuildRight', 'WestFuel Supplies', 'ToolTown']
  const purchased = ['parts + consumables', 'spare components', 'cleaning supplies', 'service kits', 'hardware + fasteners']

  const totalStartMin = toMinutes(totalStart) ?? 0
  const totalEndMin = toMinutes(totalEnd) ?? (totalStartMin + 1)

  const count = 1 + Math.floor(mulberry32(seedBase + 123)() * 2) // 1-2 stops
  const stops: SupplierStopDraft[] = []

  let mileageCursor = startMileage ?? 10

  for (let i = 0; i < count; i++) {
    const arrivalOffset = Math.round(seededNumber(seedBase + i * 7, 30, Math.max(30, (totalEndMin - totalStartMin) - 90)))
    const duration = Math.round(seededNumber(seedBase + i * 11, 20, 70))
    const arrivalMin = clamp(totalStartMin + arrivalOffset, 0, 23 * 60 + 55)
    const departureMin = clamp(arrivalMin + duration, arrivalMin + 5, 23 * 60 + 55)

    const arrivalTime = minutesToHHMM(arrivalMin)
    const departureTime = minutesToHHMM(departureMin)

    const locs = makeLocations(seedBase + i * 31)
    const supplierName = pick(seedBase + 100 + i, suppliers)
    const whatPurchased = pick(seedBase + 200 + i, purchased)

    const amountSpent = Math.round(
      computeMileageKm(mulberry32(seedBase + i + 999)()) * (0.04 + mulberry32(seedBase + i + 888)() * 0.12) * 100
    ) / 100

    const startM = startMileage !== null ? mileageCursor : null
    const endM = startMileage !== null ? startM! + Math.round(seededNumber(seedBase + i * 13, 1, 18)) / 10 : null
    mileageCursor = (endM ?? mileageCursor)

    const distanceMeters = startM !== null && endM !== null ? computeDistanceMeters(startM, endM) : null

    stops.push({
      arrivalTime,
      departureTime,
      arrivalLocation: locs.arrivalLoc,
      departureLocation: locs.departureLoc,
      supplierName,
      amountSpent,
      whatPurchased,
      jobId: pick(seedBase + 300 + i, [jobIdNumber, '']) ? jobIdNumber : null,
      startMileage: startM,
      endMileage: endM,
      distanceMeters,
      photoReceiptIds: [makeReceiptId(seedBase + 400 + i, 1), ...(mulberry32(seedBase + 401 + i)() > 0.6 ? [makeReceiptId(seedBase + 400 + i, 2)] : [])],
    })
  }

  return stops
}

function makeFuelStops(seedBase: number, totalStart: string, totalEnd: string, startMileage: number | null, endMileage: number | null): FuelStopDraft[] {
  const stations = ['Shell Marigot', 'Texaco Marigot', 'TotalEnergies Port', 'PetroGate Fuel', 'Marigot Fuel Hub', 'QuickStop Fuel']
  const count = 1 + Math.floor(mulberry32(seedBase + 321)() * 2) // 1-2

  const totalStartMin = toMinutes(totalStart) ?? 0
  const totalEndMin = toMinutes(totalEnd) ?? (totalStartMin + 1)

  const stops: FuelStopDraft[] = []
  let mileageCursor = startMileage ?? 10

  for (let i = 0; i < count; i++) {
    const arrivalOffset = Math.round(seededNumber(seedBase + i * 17, 60, Math.max(60, (totalEndMin - totalStartMin) - 60)))
    const duration = Math.round(seededNumber(seedBase + i * 23, 10, 35))
    const arrivalMin = clamp(totalStartMin + arrivalOffset, 0, 23 * 60 + 55)
    const departureMin = clamp(arrivalMin + duration, arrivalMin + 3, 23 * 60 + 55)

    const arrivalTime = minutesToHHMM(arrivalMin)
    const departureTime = minutesToHHMM(departureMin)

    const locs = makeLocations(seedBase + i * 47)
    const startM = startMileage !== null ? mileageCursor : null
    const endM = startMileage !== null ? startM! + Math.round(seededNumber(seedBase + i * 29, 1, 25)) / 10 : null
    mileageCursor = (endM ?? mileageCursor)

    const distanceMeters = startM !== null && endM !== null ? computeDistanceMeters(startM, endM) : null

    const litersFilled = Math.round(seededNumber(seedBase + 777 + i, 20, 65) * 10) / 10
    const unitPrice = 0.95 + mulberry32(seedBase + 778 + i)() * 0.9 // fake per-liter price
    const totalCost = Math.round(litersFilled * unitPrice * 100) / 100

    const stationName = pick(seedBase + 888 + i, stations)
    stops.push({
      arrivalTime,
      departureTime,
      arrivalLocation: locs.arrivalLoc,
      departureLocation: locs.departureLoc,
      startMileage: startM,
      endMileage: endM,
      distanceMeters,
      litersFilled,
      totalCost,
      fuelStationName: stationName,
      photoReceiptIds: [makeReceiptId(seedBase + 999 + i, 1), ...(mulberry32(seedBase + 1000 + i)() > 0.55 ? [makeReceiptId(seedBase + 999 + i, 2)] : [])],
    })
  }

  return stops
}

export function ensureSeededLocalPreview(config?: Partial<LocalPreviewSeedConfig>) {
  const cfg: LocalPreviewSeedConfig = {
    employeeCount: config?.employeeCount ?? 20,
    months: config?.months ?? 3,
    workdaysPerMonth: config?.workdaysPerMonth ?? 18,
  }

  const vehicleCount = getDefaultVehicleCount()
  const vehicleCodes = getVehicleCodes(vehicleCount)

  const existing = loadQueue()
  if (existing.length > 0) {
    const allZero = existing.every((d) => calcTotalHours(d.startTime, d.endTime) <= 0)

    // Back-compat: if drafts were generated before supplierStops/fuelStops existed,
    // we must re-seed so the Supplier/Fuel tabs have data.
    const anyMissingStopFields = existing.some(
      (d) => !('supplierStops' in d) || !('fuelStops' in d) || !(d as unknown as { supplierStops?: unknown; fuelStops?: unknown }).supplierStops || !(d as unknown as { supplierStops?: unknown; fuelStops?: unknown }).fuelStops
    )

    const anyMissingJobSegmentFields = existing.some((d) => {
      const jd = (d as unknown as { jobStartTime?: unknown }).jobStartTime
      const je = (d as unknown as { jobEndTime?: unknown }).jobEndTime
      return typeof jd !== 'string' || typeof je !== 'string'
    })

    if (!allZero && !anyMissingStopFields && !anyMissingJobSegmentFields) return
    localStorage.removeItem(STORAGE_KEY)
  }

  const now = new Date()
  const baseMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const phrases = [
    'Daily maintenance and check',
    'Client visit + fuel log',
    'Workshop pickup / delivery',
    'Route planning + returns',
    'Equipment servicing and notes',
  ] as const

  const jobDescriptors = ['Routine route work', 'Field visit', 'Delivery + pickup', 'Inspection run', 'Workshop support'] as const

  const queue: Draft[] = []

  const totalDays = cfg.months * cfg.workdaysPerMonth
  const employeeStride = Math.max(1, Math.round(cfg.employeeCount / 6))

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = new Date(baseMonth)
    date.setMonth(baseMonth.getMonth() + Math.floor(dayIndex / cfg.workdaysPerMonth))
    date.setDate(1 + (dayIndex % cfg.workdaysPerMonth))

    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue

    const empIndex = ((dayIndex * employeeStride) % cfg.employeeCount) + 1
    const code = employeeCode(empIndex)

    const seedBase = hashStringToInt(`${code}:${toIsoDate(date)}:${dayIndex}`)
    const { startTime, endTime } = generateStartEndTimes(seedBase)

    const startMin = toMinutes(startTime) ?? 0
    const endMin = toMinutes(endTime) ?? (startMin + 60)

    // Job segment is a sub-window inside the travel window so job-hours differ from day-hours.
    const jobSeed = hashStringToInt(`JOB:${seedBase}:${dayIndex}`)
    const jobStartOffsetMin = Math.round(seededNumber(jobSeed + 1, 10, 45))
    const jobEndOffsetMin = Math.round(seededNumber(jobSeed + 2, 10, 75))

    let jobStartMin = clamp(startMin + jobStartOffsetMin, 0, 23 * 60 + 55)
    let jobEndMin = clamp(endMin - jobEndOffsetMin, jobStartMin + 15, 23 * 60 + 55)
    if (jobEndMin <= jobStartMin) jobEndMin = Math.min(23 * 60 + 55, jobStartMin + 30)

    const jobStartTime = minutesToHHMM(jobStartMin)
    const jobEndTime = minutesToHHMM(jobEndMin)

    const vehicleId =
      vehicleCodes.length > 0 ? vehicleCodes[hashStringToInt(`VEH-${seedBase}:${dayIndex}`) % vehicleCodes.length] : null

    const rnd = mulberry32(seedBase + 999)()
    const mileage = computeMileageKm(rnd)

    const jobIdNumber = String((seedBase % 9000) + 1000)
    const clientNames = ['Acme Ltd', 'Sunrise Co', 'Blue Harbor LLC', 'Northwind', 'Evergreen'] as const
    const siteNames = ['Port Area', 'Main Yard', 'Client Depot', 'Warehouse District', 'City Service Center'] as const

    const clientName = pick(seedBase + 41, clientNames)
    const siteName = pick(seedBase + 42, siteNames)
    const location = `${siteName} • Marigot`

    const jobStatus: JobStatus = pick(seedBase + 43, ['complete', 'return-required'] as const)

    const supplierStops = makeSupplierStops(seedBase, jobIdNumber, startTime, endTime, mileage, mileage + 1.2)
    const fuelStops = makeFuelStops(seedBase, startTime, endTime, mileage, mileage + 0.9)

    const fuelCost = Math.round(fuelStops.reduce((acc, f) => acc + f.totalCost, 0) * 100) / 100
    const supplierCost = Math.round(supplierStops.reduce((acc, s) => acc + s.amountSpent, 0) * 100) / 100

    const draft: Draft = {
      localId: safeUUID(),
      syncPayloadId: safeUUID(),
      date: toIsoDate(date),
      startTime,
      endTime,
      employeeCode: code,
      vehicleId,
      mileage,
      fuelCost,
      supplierCost,

      // job-segment times (real reporting basis for Jobs tab/Reports)
      jobStartTime,
      jobEndTime,

      jobIdNumber,
      clientName,
      siteName,
      location,
      jobStatus,

      jobDescription: pick(seedBase + 10, jobDescriptors),
      notes: `${pick(seedBase + 20, phrases)} for ${code}.`,
      attachmentUrls: [],

      supplierStops,
      fuelStops,

      syncStatus: 'queued',
    }

    queue.push(draft)
  }

  saveQueue(queue)
}

export function getEmployeeCodes(employeeCount: number): string[] {
  const profiles = safeReadEmployeeProfiles()
  if (profiles.length > 0) {
    // Keep order from stored profiles; if the caller asks for fewer, slice.
    return profiles.slice(0, employeeCount).map((p) => p.code)
  }

  return Array.from({ length: employeeCount }, (_, i) => employeeCode(i + 1))
}

export function getEmployeeMultiplier(employeeIndex1Based: number): number {
  const seed = hashStringToInt(`EMP-${pad3(employeeIndex1Based)}`)
  const t = mulberry32(seed)()
  return Math.round((0.3 + t * 0.8) * 100) / 100
}

export function getEmployeeHourlyRate(employeeIndex1Based: number): number {
  const seed = hashStringToInt(`RATE-${pad3(employeeIndex1Based)}`)
  const t = mulberry32(seed + 7)()
  return Math.round(14 + t * 18)
}

export type EmployeeProfile = { code: string; firstName: string; lastName: string }

export type AssistantProfile = { code: string; firstName?: string; lastName?: string }

export type VehicleProfile = {
  code: string
  carType: string
  registrationNumber: string
  nickname?: string
}

const LS_EMPLOYEE_PROFILES_KEY = 'ddworkrecord_employee_profiles_json'
const LS_ASSISTANT_PROFILES_KEY = 'ddworkrecord_assistant_profiles_json'
const LS_VEHICLE_PROFILES_KEY = 'ddworkrecord_vehicle_profiles_json'

// legacy/local-only CSV storage (used by older UI)
const LS_ASSISTANT_CODES = 'ddworkrecord_assistant_codes_csv'
const LS_VEHICLE_CODES = 'ddworkrecord_vehicle_codes_csv'

function safeReadEmployeeProfiles(): EmployeeProfile[] {
  try {
    const raw = localStorage.getItem(LS_EMPLOYEE_PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const profiles: EmployeeProfile[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue
      const v = item as Record<string, unknown>
      const codeRaw = v.code
      const firstNameRaw = v.firstName
      const lastNameRaw = v.lastName
      if (typeof codeRaw !== 'string' || typeof firstNameRaw !== 'string' || typeof lastNameRaw !== 'string') continue

      const code = codeRaw.trim().toUpperCase()
      const firstName = firstNameRaw.trim()
      const lastName = lastNameRaw.trim()
      if (!code || !firstName || !lastName) continue

      profiles.push({ code, firstName, lastName })
    }
    return profiles
  } catch {
    return []
  }
}

export function getEmployeeProfiles(): EmployeeProfile[] {
  return safeReadEmployeeProfiles()
}

export function getDefaultEmployeeCount(): number {
  const profiles = safeReadEmployeeProfiles()
  return profiles.length > 0 ? profiles.length : 20
}

function safeReadAssistantProfiles(): AssistantProfile[] {
  try {
    const raw = localStorage.getItem(LS_ASSISTANT_PROFILES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const profiles: AssistantProfile[] = []
        for (const item of parsed) {
          if (typeof item !== 'object' || item === null) continue
          const v = item as Record<string, unknown>
          const codeRaw = v.code
          if (typeof codeRaw !== 'string') continue
          const code = codeRaw.trim().toUpperCase()
          if (!code) continue
          const firstName = typeof v.firstName === 'string' ? v.firstName.trim() : undefined
          const lastName = typeof v.lastName === 'string' ? v.lastName.trim() : undefined
          profiles.push({ code, firstName: firstName || undefined, lastName: lastName || undefined })
        }
        // stable order by numeric suffix (AS-001 < AS-010)
        profiles.sort((a, b) => {
          const ai = Number((a.code.match(/^AS-(\d{3})$/) ?? [])[1] ?? 0)
          const bi = Number((b.code.match(/^AS-(\d{3})$/) ?? [])[1] ?? 0)
          return ai - bi
        })
        if (profiles.length > 0) return profiles
      }
    }
  } catch {
    // fallthrough
  }

  // Back-compat: if only AS code CSV exists, use it for count.
  try {
    const rawCsv = localStorage.getItem(LS_ASSISTANT_CODES)
    if (!rawCsv) return []
    const codes = rawCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((c) => c.toUpperCase())
    return codes.map((code) => ({ code }))
  } catch {
    return []
  }
}

function safeReadVehicleProfiles(): VehicleProfile[] {
  try {
    const raw = localStorage.getItem(LS_VEHICLE_PROFILES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const profiles: VehicleProfile[] = []
        for (const item of parsed) {
          if (typeof item !== 'object' || item === null) continue
          const v = item as Record<string, unknown>
          const codeRaw = v.code
          const carTypeRaw = v.carType
          const regRaw = v.registrationNumber
          if (typeof codeRaw !== 'string' || typeof carTypeRaw !== 'string' || typeof regRaw !== 'string') continue
          const code = codeRaw.trim().toUpperCase()
          const carType = carTypeRaw.trim()
          const registrationNumber = regRaw.trim()
          if (!code || !carType || !registrationNumber) continue
          const nickname = typeof v.nickname === 'string' ? v.nickname.trim() : undefined
          profiles.push({ code, carType, registrationNumber, nickname: nickname || undefined })
        }
        profiles.sort((a, b) => {
          const ai = Number((a.code.match(/^VEH-(\d{3})$/) ?? [])[1] ?? 0)
          const bi = Number((b.code.match(/^VEH-(\d{3})$/) ?? [])[1] ?? 0)
          return ai - bi
        })
        if (profiles.length > 0) return profiles
      }
    }
  } catch {
    // fallthrough
  }

  // Back-compat: if only VEH code CSV exists, use it for count.
  try {
    const rawCsv = localStorage.getItem(LS_VEHICLE_CODES)
    if (!rawCsv) return []
    const codes = rawCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((c) => c.toUpperCase())
    // minimal profiles so vehicle IDs exist
    return codes.map((code) => ({
      code,
      carType: 'Car',
      registrationNumber: code,
      nickname: undefined,
    }))
  } catch {
    return []
  }
}

export function getDefaultAssistantCount(): number {
  // Display-only assistants shown on the local preview dashboard.
  const profiles = safeReadAssistantProfiles()
  return profiles.length > 0 ? profiles.length : 6
}

export function assistantCode(i: number): string {
  return `AS-${pad3(i)}`
}

// Deterministic assignment: maps an employee index to a fixed assistant index.
// This models "assistants are assigned to employees" for display-only hour attribution.
export function getAssistantIndexForEmployee(employeeIndex1Based: number, assistantCount: number): number {
  const seed = hashStringToInt(`ASSET:${employeeIndex1Based}:${assistantCount}`)
  const t = mulberry32(seed)()
  return Math.max(1, Math.min(assistantCount, Math.floor(t * assistantCount) + 1))
}

export function getAssistantProfiles(): AssistantProfile[] {
  return safeReadAssistantProfiles()
}

export function getAssistantCodes(assistantCount: number): string[] {
  return Array.from({ length: assistantCount }, (_, i) => assistantCode(i + 1))
}

function vehicleCode(i: number): string {
  return `VEH-${pad3(i)}`
}

export function getVehicleProfiles(): VehicleProfile[] {
  return safeReadVehicleProfiles()
}

export function getDefaultVehicleCount(): number {
  const profiles = safeReadVehicleProfiles()
  return profiles.length > 0 ? profiles.length : 6
}

export function getVehicleCodes(vehicleCount: number): string[] {
  const profiles = safeReadVehicleProfiles()
  if (profiles.length > 0) return profiles.slice(0, vehicleCount).map((p) => p.code)
  return Array.from({ length: vehicleCount }, (_, i) => vehicleCode(i + 1))
}

export function getDefaultSeedMonths(): number {
  return 3
}

export function getDefaultWorkdaysPerMonth(): number {
  return 18
}
