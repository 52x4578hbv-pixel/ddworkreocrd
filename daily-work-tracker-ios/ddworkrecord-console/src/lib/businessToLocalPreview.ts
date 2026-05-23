import type { FuelStop, LocalPreviewWorkday, SupplierStop } from './localPreviewData'

const asNumber = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const asNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const toHHMM = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return ''
    // ISO datetime
    if (s.length >= 16 && s.includes('T')) return s.slice(11, 16)
    // already HH:mm (one/two digits)
    if (/^\d{1,2}:\d{2}$/.test(s)) return s.length === 4 ? `0${s}` : s
    // HH:mm:ss
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5)
    // fallback: try first 5 chars
    if (s.length >= 5) return s.slice(0, 5)
    return ''
  }
  const d = new Date(v as any)
  if (!Number.isFinite(d.getTime())) return ''
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

const hoursFromHHMM = (start: string, end: string): number => {
  const m1 = start.match(/^(\d{1,2}):(\d{2})$/)
  const m2 = end.match(/^(\d{1,2}):(\d{2})$/)
  if (!m1 || !m2) return 0
  const h1 = Number(m1[1])
  const mStart = h1 * 60 + Number(m1[2])
  const h2 = Number(m2[1])
  const mEnd = h2 * 60 + Number(m2[2])
  const minutes = mEnd - mStart
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  return Math.round((minutes / 60) * 100) / 100
}

const toLocationString = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const lat = o.lat ?? o.latitude
    const lng = o.lng ?? o.longitude
    const latOk = typeof lat === 'number' || typeof lat === 'string'
    const lngOk = typeof lng === 'number' || typeof lng === 'string'
    if (latOk && lngOk) return `${lat},${lng}`
  }
  return ''
}

const normalizeJobStatus = (raw: unknown): LocalPreviewWorkday['jobStatus'] => {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : String(raw ?? '').trim().toLowerCase()
  if (!s) return 'complete'
  if (s.includes('return')) return 'return-required'
  if (s.includes('complete')) return 'complete'
  return 'complete'
}

const mapPhotoIds = (v: unknown): string[] => {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0)
}

const supplierStopsFrom = (suppliers: unknown[]): SupplierStop[] => {
  return (Array.isArray(suppliers) ? suppliers : []).map((s: any) => {
    const arrivalTime = toHHMM(s?.arrivalTime ?? s?.arrival_time ?? '')
    const departureTime = toHHMM(s?.departureTime ?? s?.departure_time ?? '')
    const durationHours = hoursFromHHMM(arrivalTime, departureTime)

    const startMileage = asNullableNumber(s?.startMileage ?? s?.startingMileage ?? s?.start_mileage ?? null)
    const endMileage = asNullableNumber(s?.endMileage ?? s?.endingMileage ?? s?.end_mileage ?? null)

    const distanceMeters =
      asNullableNumber(s?.distanceMeters ?? s?.distance_meters ?? null) ??
      (startMileage !== null && endMileage !== null ? Math.max(0, (endMileage - startMileage) * 1000) : null)

    return {
      arrivalTime,
      departureTime,
      arrivalLocation: toLocationString(s?.arrivalLocation ?? s?.arrival_location ?? null),
      departureLocation: toLocationString(s?.departureLocation ?? s?.departure_location ?? null),
      supplierName: String(s?.supplierName ?? s?.supplier_name ?? ''),
      amountSpent: asNumber(s?.amountSpent ?? s?.amount_spent ?? 0),
      whatPurchased: String(s?.whatPurchased ?? s?.purchaseNotes ?? s?.purchase_notes ?? ''),
      jobId: s?.jobId ?? s?.job_id ? String(s?.jobId ?? s?.job_id) : null,
      startMileage,
      endMileage,
      distanceMeters,
      durationHours,
      photoReceiptIds: mapPhotoIds(s?.photoReceiptIds ?? s?.photo_receipt_ids ?? []),
    }
  })
}

const fuelStopsFrom = (fuels: unknown[]): FuelStop[] => {
  return (Array.isArray(fuels) ? fuels : []).map((f: any) => {
    const arrivalTime = toHHMM(f?.arrivalTime ?? f?.arrival_time ?? '')
    const departureTime = toHHMM(f?.departureTime ?? f?.departure_time ?? '')
    const durationHours = hoursFromHHMM(arrivalTime, departureTime)

    const startMileage = asNullableNumber(f?.startMileage ?? f?.startingMileage ?? f?.start_mileage ?? null)
    const endMileage = asNullableNumber(f?.endMileage ?? f?.endingMileage ?? f?.end_mileage ?? null)

    const distanceMeters =
      asNullableNumber(f?.distanceMeters ?? f?.distance_meters ?? null) ??
      (startMileage !== null && endMileage !== null ? Math.max(0, (endMileage - startMileage) * 1000) : null)

    return {
      arrivalTime,
      departureTime,
      arrivalLocation: toLocationString(f?.arrivalLocation ?? f?.arrival_location ?? null),
      departureLocation: toLocationString(f?.departureLocation ?? f?.departure_location ?? null),
      startMileage,
      endMileage,
      distanceMeters,
      litersFilled: asNumber(f?.litersFilled ?? f?.liters_filled ?? 0),
      totalCost: asNumber(f?.totalCost ?? f?.total_cost ?? 0),
      fuelStationName: f?.fuelStationName ?? f?.fuel_station_name ? String(f?.fuelStationName ?? f?.fuel_station_name) : null,
      photoReceiptIds: mapPhotoIds(f?.photoReceiptIds ?? f?.photo_receipt_ids ?? []),
      durationHours,
    }
  })
}

export function businessWorkdayToLocalPreviewWorkday(raw: any): LocalPreviewWorkday {
  const jobs = Array.isArray(raw?.jobs) ? raw.jobs : []
  const travels = Array.isArray(raw?.travels) ? raw.travels : []
  const fuels = Array.isArray(raw?.fuels) ? raw.fuels : []
  const suppliers = Array.isArray(raw?.suppliers) ? raw.suppliers : []

  const firstJob = jobs[0] ?? {}
  const lastTravel = travels.length ? travels[travels.length - 1] : null

  const jobIdNumber = String(firstJob?.jobIdNumber ?? firstJob?.job_id ?? firstJob?.jobId ?? '').trim()
  const jobStatus = normalizeJobStatus(firstJob?.jobStatus ?? firstJob?.status ?? firstJob?.job_status ?? '')
  const jobDescription = String(firstJob?.jobDescription ?? firstJob?.description ?? firstJob?.job_description ?? '').trim()

  const jobStartTime = toHHMM(firstJob?.jobStartTime ?? firstJob?.startTime ?? firstJob?.start_time ?? '')
  const jobEndTime = toHHMM(firstJob?.jobEndTime ?? firstJob?.endTime ?? firstJob?.end_time ?? '')
  const jobHours = hoursFromHHMM(jobStartTime, jobEndTime)

  const clientName = String(firstJob?.clientName ?? firstJob?.client_name ?? '').trim()
  const siteName = String(firstJob?.siteName ?? firstJob?.site_name ?? '').trim()

  const location =
    toLocationString(firstJob?.location ?? firstJob?.locationString ?? firstJob?.startLocation ?? firstJob?.start_location ?? null) ||
    toLocationString(firstJob?.endLocation ?? firstJob?.end_location ?? null) ||
    ''

  const startTime = toHHMM(travels?.[0]?.startTime ?? travels?.[0]?.start_time ?? firstJob?.startTime ?? firstJob?.start_time ?? '')
  const endTime = lastTravel
    ? toHHMM(lastTravel?.endTime ?? lastTravel?.end_time ?? firstJob?.endTime ?? firstJob?.end_time ?? '')
    : jobEndTime

  const supplierStops = supplierStopsFrom(suppliers)
  const fuelStops = fuelStopsFrom(fuels)

  const fuelCost = Math.round(fuelStops.reduce((acc, s) => acc + asNumber(s.totalCost), 0) * 100) / 100
  const supplierSpend = Math.round(supplierStops.reduce((acc, s) => acc + asNumber(s.amountSpent), 0) * 100) / 100

  const notes = String(raw?.endNotes ?? raw?.end_notes ?? '').trim()

  const totalHours = asNumber(raw?.totalHours ?? raw?.total_hours ?? 0)
  const totalDistanceKm = asNumber(raw?.totalDistanceKm ?? raw?.total_distance_km ?? 0)

  const mileage = (raw?.startMileage ?? raw?.start_mileage ?? null) as number | null

  const employeeId = String(raw?.employeeId ?? raw?.employee_id ?? '').trim()
  const employeeCode = employeeId

  return {
    id: String(raw?.id ?? ''),
    date: String(raw?.date ?? raw?.workDate ?? raw?.work_date ?? '').slice(0, 10),
    startTime,
    endTime,

    employeeCode,
    // local-preview only
    vehicleId: (raw?.vehicleId ?? raw?.vehicle_id ?? null) as string | null,

    totalHours,
    jobHours,
    jobStartTime,
    jobEndTime,

    totalDistanceKm,
    mileage,

    fuelCost,
    supplierSpend,
    notes,
    attachmentUrls: [],

    // iOS job fields
    jobIdNumber,
    clientName,
    siteName,
    location,
    jobStatus,
    jobDescription,

    // iOS supplier/fuel stop fields
    supplierStops,
    fuelStops,
  }
}
