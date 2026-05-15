import PDFDocument from 'pdfkit'
import type { Response } from 'express'
import type { WorkdayRecordForReports } from './memoryStore'

type UnknownRecord = Record<string, unknown>

const safeString = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

const safeDate = (v: unknown): Date | null => {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

type TimelineActivity = {
  time: Date
  type: 'JOB' | 'TRAVEL' | 'FUEL'
  desc: string
}

const buildActivities = (record: WorkdayRecordForReports): TimelineActivity[] => {
  const jobs = Array.isArray(record.jobs) ? (record.jobs as unknown[]) : []
  const travels = Array.isArray(record.travels) ? (record.travels as unknown[]) : []
  const fuels = Array.isArray(record.fuels) ? (record.fuels as unknown[]) : []

  const activities: TimelineActivity[] = []

  for (const j of jobs) {
    const job = j as UnknownRecord
    const time = safeDate(job.startTime)
    if (!time) continue

    activities.push({
      time,
      type: 'JOB',
      desc: safeString(job.clientName) || safeString(job.jobId) || 'Job',
    })
  }

  for (const t of travels) {
    const travel = t as UnknownRecord
    const time = safeDate(travel.startTime)
    if (!time) continue

    const startMileage = safeString(travel.startMileage)
    const endMileage = safeString(travel.endMileage)
    activities.push({
      time,
      type: 'TRAVEL',
      desc: `${startMileage} -> ${endMileage}`,
    })
  }

  for (const f of fuels) {
    const fuel = f as UnknownRecord
    const time = safeDate(fuel.arrivalTime)
    if (!time) continue

    const station = safeString(fuel.fuelStationName)
    activities.push({
      time,
      type: 'FUEL',
      desc: station || 'Fuel',
    })
  }

  return activities.sort((a, b) => a.time.getTime() - b.time.getTime())
}

export const generateDailyPDF = (record: WorkdayRecordForReports, res: Response) => {
  const doc = new PDFDocument({ margin: 50 })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Report_${safeString(record.employeeId)}_${safeString(record.date)}.pdf`
  )
  doc.pipe(res)

  // Header
  doc.fontSize(20).text('Daily Work Report', { align: 'center' })
  doc.moveDown()

  doc.fontSize(12).text(`Employee: ${safeString(record.employeeId)}`)
  doc.text(`Date: ${safeString(record.date)}`)
  doc.text(`Vehicle: ${record.vehicleId ? String(record.vehicleId) : 'N/A'}`)
  doc.moveDown()

  // Summary Table
  doc.fontSize(14).text('Summary', { underline: true })
  doc.fontSize(12).text(`Total Hours: ${(record.totalHours ?? 0).toFixed(2)}`)
  doc.text(`Total Distance: ${(record.totalDistanceKm ?? 0).toFixed(2)} km`)
  doc.text(`Start Mileage: ${record.startMileage ?? 'N/A'}`)
  doc.text(`End Mileage: ${record.endMileage ?? 'N/A'}`)
  doc.moveDown()

  // Activity Timeline
  doc.fontSize(14).text('Activity Timeline', { underline: true })
  doc.moveDown(0.5)

  const activities = buildActivities(record)
  if (activities.length === 0) {
    doc.fontSize(10).text('No timeline activities found in this record payload.')
    doc.end()
    return
  }

  for (const act of activities) {
    const timeStr = act.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    doc.fontSize(10).text(`[${timeStr}] ${act.type}: ${act.desc}`)
  }

  if (record.endNotes) {
    doc.moveDown().fontSize(12).text('Notes:', { underline: true }).text(safeString(record.endNotes))
  }

  doc.end()
}
