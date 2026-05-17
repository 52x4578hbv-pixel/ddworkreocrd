import type { LocalPreviewWorkday } from './localPreviewData'

type Insights = {
  totalHours: number
  fuelCost: number
  supplierSpend: number
  topSupplier: { supplierName: string; amountSpent: number } | null
  busiestDay: { date: string; totalHours: number } | null
  highestFuelDay: { date: string; fuelCost: number } | null
  jobsCompleteHours: number
  jobsReturnRequiredHours: number
}

type JobRow = {
  jobIdNumber: string
  completeHours: number
  returnHours: number
  count: number
  totalHours: number
}

export type AiReportContext = {
  filtered: LocalPreviewWorkday[]
  insights: Insights
  jobBreakdown: JobRow[]
  selectedEmployee: string
  jobIdSearch: string
  supplierSearch: string
  minHours: number | null
}

function format2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n * 100)}%`
}

function safeNumber(n: number): number {
  return Number.isFinite(n) ? n : 0
}

function clampText(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > 220 ? `${t.slice(0, 220)}…` : t
}

function median(values: number[]): number | null {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (arr.length === 0) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid]
}

function topSupplierShare(top: { supplierName: string; amountSpent: number } | null, supplierSpend: number): number | null {
  if (!top) return null
  if (!Number.isFinite(supplierSpend) || supplierSpend <= 0) return null
  return top.amountSpent / supplierSpend
}

function computeFuelPerHourMedian(filtered: LocalPreviewWorkday[], totalHours: number, fuelCost: number): { avgFuelPerHour: number; medianFuelPerHour: number | null } {
  const avgFuelPerHour = totalHours > 0 ? fuelCost / totalHours : 0

  const perWorkday: number[] = []
  for (const w of filtered) {
    const h = safeNumber(w.totalHours)
    const f = safeNumber(w.fuelCost)
    if (h > 0) perWorkday.push(f / h)
  }

  return { avgFuelPerHour, medianFuelPerHour: median(perWorkday) }
}

export function buildAiResearchReport(ctx: AiReportContext): string {
  const { filtered, insights, jobBreakdown, selectedEmployee, jobIdSearch, supplierSearch, minHours } = ctx

  const workdayCount = filtered.length
  const completedCount = filtered.filter((w) => w.jobStatus === 'complete').length
  const returnRequiredCount = filtered.filter((w) => w.jobStatus === 'return-required').length

  const completionRate = workdayCount > 0 ? completedCount / workdayCount : 0
  const returnRequiredRate = workdayCount > 0 ? returnRequiredCount / workdayCount : 0

  const { avgFuelPerHour, medianFuelPerHour } = computeFuelPerHourMedian(filtered, insights.totalHours, insights.fuelCost)
  const fuelDeltaPct =
    medianFuelPerHour !== null && medianFuelPerHour !== 0 ? (avgFuelPerHour - medianFuelPerHour) / medianFuelPerHour : null

  const topShare = topSupplierShare(insights.topSupplier, insights.supplierSpend)

  const topJobs = jobBreakdown.slice(0, 6)

  const contextLine = [
    selectedEmployee !== 'all' ? `Employee: ${selectedEmployee}` : 'Employee: All',
    jobIdSearch.trim() ? `Job filter: “${clampText(jobIdSearch)}”` : 'Job filter: None',
    supplierSearch.trim() ? `Supplier filter: “${clampText(supplierSearch)}”` : 'Supplier filter: None',
    minHours !== null ? `Min total hours: ${minHours}` : 'Min total hours: None',
  ].join(' • ')

  const topJobNarratives =
    topJobs.length === 0
      ? '• —'
      : topJobs
          .map((r) => {
            const total = r.totalHours
            const completeShare = total > 0 ? r.completeHours / total : 0
            const returnShare = total > 0 ? r.returnHours / total : 0
            return `• Job ${r.jobIdNumber}: ${format2(total)}h total (complete ${formatPct(completeShare)}, return-required ${formatPct(returnShare)}) — seen ${r.count} time(s)`
          })
          .join('\n')

  const opportunities: string[] = []

  // 1) Rework / return-required signal
  if (returnRequiredRate >= 0.25) {
    opportunities.push(
      `High rework signal: ${formatPct(returnRequiredRate)} of workdays are “return-required”. This usually means the job did not fully meet acceptance criteria (missing parts/materials, under-allocation of time, or coordination gaps).`
    )
  } else {
    opportunities.push(`Rework appears contained: return-required workdays are ${formatPct(returnRequiredRate)}. To reduce it further, target the repeat jobs with the highest return-required hours.`)
  }

  // 2) Fuel efficiency drift signal
  if (medianFuelPerHour !== null && fuelDeltaPct !== null) {
    const direction = fuelDeltaPct > 0 ? 'higher' : 'lower'
    const absPct = Math.abs(fuelDeltaPct)
    opportunities.push(
      `Fuel efficiency check: average fuel-per-hour is ${format2(avgFuelPerHour)} vs median ${format2(medianFuelPerHour)} (${direction} by ${formatPct(absPct)}). If this persists, tighten travel/routing so high-hours days have better job density.`
    )
  } else {
    opportunities.push(`Fuel efficiency check: average fuel-per-hour is ${format2(avgFuelPerHour)}. Compare across weeks to spot drift and routing changes.`)
  }

  // 3) Supplier concentration / risk signal
  if (topShare !== null) {
    if (topShare >= 0.55) {
      opportunities.push(
        `Supplier concentration: top supplier (“${insights.topSupplier?.supplierName ?? 'Unknown'}”) accounts for ${formatPct(topShare)} of supplier spend. This can improve speed but increases risk (price changes, lead-time delays, single-point failure). Consider negotiating volume tiers or defining a fallback supplier.`
      )
    } else {
      opportunities.push(
        `Supplier mix looks more balanced. Top supplier (“${insights.topSupplier?.supplierName ?? 'Unknown'}”) is ${formatPct(topShare)} of spend. If you want faster turnaround, standardize best-value suppliers by job type rather than changing suppliers ad-hoc.`
      )
    }
  } else {
    opportunities.push('Supplier concentration: insufficient supplier spend in the filtered dataset to assess concentration.')
  }

  // 4) Job-level operational signal
  if (jobBreakdown.length > 0) {
    const worstJob = jobBreakdown
      .slice()
      .sort((a, b) => b.returnHours - a.returnHours)[0]

    if (worstJob && worstJob.totalHours > 0) {
      const returnShare = worstJob.returnHours / worstJob.totalHours
      if (returnShare >= 0.3) {
        opportunities.push(
          `Operational job signal: job ${worstJob.jobIdNumber} has the highest return-required hours (return share ${formatPct(returnShare)}). Start process improvements at this job: update prep checklist, clarify required artifacts, and add a time buffer for common missing items.`
        )
      } else {
        opportunities.push(`Operational job signal: return-required hours are spread across jobs. Focus improvements on the top 2–3 jobs by total hours that also have non-trivial return share.`)
      }
    }
  }

  // Recommended action plan (detailed, business-facing)
  const recommendedActions: string[] = []

  recommendedActions.push(`1) Target the rework root cause\n   - Pick the top “return-required” jobs.\n   - Add/adjust a pre-visit checklist that ensures required parts/materials are verified.\n   - Require job notes template entries that explain what was completed vs what still needs closure.\n   - Add a “final verification” step before marking the job as complete.`)

  recommendedActions.push(`2) Improve routing + scheduling\n   - If fuel-per-hour is drifting higher, cluster jobs geographically and schedule higher-density days.\n   - Track fuel-per-hour after routing changes (use the AI Analyzer filters to compare subsets).\n   - Reduce “travel-heavy” days by batching recurring job types.`)

  recommendedActions.push(`3) Reduce supplier risk + improve consistency\n   - If one supplier dominates spend, negotiate service-level expectations (lead time + substitutions).\n   - Define fallback suppliers for the same materials/categories.\n   - Standardize “best value” supplier choices by job type.`)

  recommendedActions.push(`4) Balance capacity by employee patterns\n   - If some employees have systematically lower utilization, adjust job assignment constraints.\n   - Monitor for repeat under/over-run patterns and enforce a standard planning cadence (same preparation steps every day).`)

  // Executive summary
  const report = [
    'DD Work Record — AI Research Report (Local Analyzer)',
    '======================================================',
    `Executive summary (generated from ${workdayCount} local workday(s))`,
    `• Context: ${contextLine}`,
    `• Total hours: ${format2(safeNumber(insights.totalHours))}h`,
    `• Fuel cost: ${format2(safeNumber(insights.fuelCost))}`,
    `• Supplier spend: ${format2(safeNumber(insights.supplierSpend))}`,
    `• Completion: ${formatPct(completionRate)} (${completedCount}/${workdayCount})`,
    `• Return-required: ${formatPct(returnRequiredRate)} (${returnRequiredCount}/${workdayCount})`,
    insights.topSupplier
      ? `• Top supplier: ${insights.topSupplier.supplierName} (${format2(insights.topSupplier.amountSpent)} • ${formatPct(topShare ?? 0)})`
      : `• Top supplier: — (no supplier spend detected in filtered dataset)`,
    '',
    'Busiest day & fuel peak',
    '------------------------',
    insights.busiestDay
      ? `• Busiest day: ${insights.busiestDay.date} (${format2(insights.busiestDay.totalHours)}h)`
      : `• Busiest day: —`,
    insights.highestFuelDay
      ? `• Highest fuel day: ${insights.highestFuelDay.date} (${format2(insights.highestFuelDay.fuelCost)})`
      : `• Highest fuel day: —`,
    '',
    'Top jobs (by total job hours)',
    '-------------------------------',
    topJobNarratives || '• —',
    '',
    'Where the business can improve (opportunities)',
    '-----------------------------------------------',
    opportunities.map((o) => `• ${o}`).join('\n') || '• —',
    '',
    'Recommended action plan',
    '-------------------------',
    recommendedActions.join('\n\n'),
    '',
    'Notes / how to use this report',
    '--------------------------------',
    `• Use the filters to isolate patterns by employee/job/supplier/min-hours and regenerate.`,
    `• Treat “return-required” as a proxy signal for acceptance-process gaps (prep, parts/materials verification, time allocation, coordination).`,
    `• Treat “fuel-per-hour drift” as a proxy signal for scheduling/routing efficiency.`,
  ].join('\n')

  return report
}
