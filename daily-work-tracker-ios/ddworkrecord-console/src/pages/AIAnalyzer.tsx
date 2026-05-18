import { useEffect, useMemo, useState } from 'react'
import type { LocalPreviewWorkday, SupplierStop } from '../lib/localPreviewData'
import { getDefaultEmployeeCount, getEmployeeCodes } from '../lib/localPreviewSeed'
import { getLocalPreviewWorkdays } from '../lib/localPreviewData'
import { theme } from '../lib/theme'
import { buildAiResearchReport } from '../lib/aiAnalyzerReport'
import { fetchGeminiAnalyzerReport } from '../lib/geminiAnalyzer'

type Focus = 'report' | 'jobs' | 'expenses'

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function format2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

function getTopSupplier(stops: SupplierStop[]): { supplierName: string; amountSpent: number } | null {
  const map = new Map<string, number>()
  for (const s of stops) {
    const name = s.supplierName?.trim() || 'Unknown'
    map.set(name, (map.get(name) ?? 0) + (Number.isFinite(s.amountSpent) ? s.amountSpent : 0))
  }
  let best: { supplierName: string; amountSpent: number } | null = null
  for (const [supplierName, amountSpent] of map.entries()) {
    if (!best || amountSpent > best.amountSpent) best = { supplierName, amountSpent }
  }
  return best
}

function safeNumberOrNull(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function AIAnalyzer() {
  const [focus, setFocus] = useState<Focus>('report')

  const EMPLOYEE_COUNT = getDefaultEmployeeCount()
  const employeeCodes = useMemo(() => getEmployeeCodes(EMPLOYEE_COUNT), [EMPLOYEE_COUNT])

  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [jobIdSearch, setJobIdSearch] = useState<string>('')
  const [supplierSearch, setSupplierSearch] = useState<string>('')
  const [minHours, setMinHours] = useState<string>('') // numeric input

  const workdays = useMemo(() => getLocalPreviewWorkdays(), [])
  const minHoursNum = useMemo(() => safeNumberOrNull(minHours), [minHours])

  const filtered = useMemo(() => {
    const qJob = jobIdSearch.trim()
    const qSupplier = supplierSearch.trim()

    return workdays.filter((w: LocalPreviewWorkday) => {
      if (selectedEmployee !== 'all' && w.employeeCode !== selectedEmployee) return false
      if (qJob && !includesCI(w.jobIdNumber, qJob)) return false
      if (minHoursNum !== null && Number.isFinite(minHoursNum) && w.totalHours < minHoursNum) return false

      if (qSupplier) {
        const matches = w.supplierStops.some((s) => includesCI(s.supplierName ?? '', qSupplier))
        if (!matches) return false
      }

      return true
    })
  }, [workdays, selectedEmployee, jobIdSearch, supplierSearch, minHoursNum])

  const insights = useMemo(() => {
    const totalHours = sum(filtered.map((w) => (Number.isFinite(w.totalHours) ? w.totalHours : 0)))
    const fuelCost = sum(filtered.map((w) => (Number.isFinite(w.fuelCost) ? w.fuelCost : 0)))
    const supplierSpend = sum(filtered.map((w) => (Number.isFinite(w.supplierSpend) ? w.supplierSpend : 0)))

    const allStops = filtered.flatMap((w) => w.supplierStops ?? [])
    const topSupplier = getTopSupplier(allStops)

    const busiestDay = [...filtered].sort((a, b) => b.totalHours - a.totalHours)[0] ?? null
    const highestFuelDay = [...filtered].sort((a, b) => b.fuelCost - a.fuelCost)[0] ?? null

    const jobsCompleteHours = filtered
      .filter((w) => w.jobStatus === 'complete')
      .reduce((acc, w) => acc + (Number.isFinite(w.jobHours) ? w.jobHours : 0), 0)

    const jobsReturnRequiredHours = filtered
      .filter((w) => w.jobStatus === 'return-required')
      .reduce((acc, w) => acc + (Number.isFinite(w.jobHours) ? w.jobHours : 0), 0)

    return {
      totalHours,
      fuelCost,
      supplierSpend,
      topSupplier,
      busiestDay: busiestDay ? { date: busiestDay.date, totalHours: busiestDay.totalHours } : null,
      highestFuelDay: highestFuelDay ? { date: highestFuelDay.date, fuelCost: highestFuelDay.fuelCost } : null,
      jobsCompleteHours,
      jobsReturnRequiredHours,
    }
  }, [filtered])

  const jobBreakdown = useMemo(() => {
    const map = new Map<string, { completeHours: number; returnHours: number; count: number }>()
    for (const w of filtered) {
      const key = w.jobIdNumber || '—'
      const cur = map.get(key) ?? { completeHours: 0, returnHours: 0, count: 0 }
      cur.count += 1
      if (w.jobStatus === 'complete') cur.completeHours += Number.isFinite(w.jobHours) ? w.jobHours : 0
      if (w.jobStatus === 'return-required') cur.returnHours += Number.isFinite(w.jobHours) ? w.jobHours : 0
      map.set(key, cur)
    }

    const rows = [...map.entries()].map(([jobIdNumber, v]) => ({
      jobIdNumber,
      completeHours: v.completeHours,
      returnHours: v.returnHours,
      count: v.count,
      totalHours: v.completeHours + v.returnHours,
    }))

    rows.sort((a, b) => b.totalHours - a.totalHours)
    return rows.slice(0, 12)
  }, [filtered])

  const reportContext = useMemo(() => {
    return {
      filtered,
      insights,
      jobBreakdown,
      selectedEmployee,
      jobIdSearch,
      supplierSearch,
      minHours: minHoursNum,
    }
  }, [filtered, insights, jobBreakdown, selectedEmployee, jobIdSearch, supplierSearch, minHoursNum])

  const deterministicReportText = useMemo(() => buildAiResearchReport(reportContext), [reportContext])

  const [aiReportText, setAiReportText] = useState<string>(deterministicReportText)
  const [aiReportSource, setAiReportSource] = useState<'none' | 'gemini' | 'fallback'>('none')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setAiBusy(true)
      setAiError(null)

      try {
        const resp = await fetchGeminiAnalyzerReport({
          context: reportContext,
          deterministicReportText,
        })

        if (cancelled) return
        setAiReportText(resp.text)
        setAiReportSource(resp.source)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Gemini request failed.'
        setAiReportText(deterministicReportText)
        setAiReportSource('fallback')
        setAiError(msg)
      } finally {
        if (cancelled) return
        setAiBusy(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [reportContext, deterministicReportText])

  const reportTitle = useMemo(() => {
    const parts: string[] = []
    if (selectedEmployee !== 'all') parts.push(`Employee ${selectedEmployee}`)
    if (jobIdSearch.trim()) parts.push(`Job “${jobIdSearch.trim()}”`)
    if (supplierSearch.trim()) parts.push(`Supplier “${supplierSearch.trim()}”`)
    if (minHoursNum !== null) parts.push(`Min ${minHoursNum}h`)
    return parts.length ? `Research report (${parts.join(', ')})` : 'Research report (current filters)'
  }, [selectedEmployee, jobIdSearch, supplierSearch, minHoursNum])

  return (
    <div
      style={{
        fontFamily: 'system-ui',
        padding: 24,
        maxWidth: 1020,
        margin: '0 auto',
        background: theme.pageBg,
        minHeight: '100vh',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: theme.text }}>AI Analyzer</h1>
          <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850, fontSize: 12 }}>
            “Research + improvement report” over the local preview dataset (with filters).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {(['report', 'jobs', 'expenses'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFocus(f)}
              style={{
                padding: '10px 12px',
                border: `2px solid ${theme.text}`,
                background: focus === f ? theme.text : theme.surface,
                color: focus === f ? '#fff' : theme.text,
                cursor: 'pointer',
                fontWeight: 1000,
                borderRadius: theme.radiusSm,
                boxShadow: focus === f ? `3px 3px 0 ${theme.text}` : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              {f === 'report' ? 'Research report' : f === 'jobs' ? 'Jobs insights' : 'Expense highlights'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Employee filter</div>
          <div style={{ marginTop: 8 }}>
            <select
              aria-label="Employee filter"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 950,
                background: '#fff',
                color: theme.text,
              }}
            >
              <option value="all">All employees</option>
              {employeeCodes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Job id contains</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Job id contains"
              value={jobIdSearch}
              onChange={(e) => setJobIdSearch(e.target.value)}
              placeholder="e.g. 123"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 950,
                background: '#fff',
                color: theme.text,
              }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Supplier name contains</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Supplier name contains"
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              placeholder="e.g. Supreme"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 950,
                background: '#fff',
                color: theme.text,
              }}
            />
          </div>
        </div>

        <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
          <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Min total hours</div>
          <div style={{ marginTop: 8 }}>
            <input
              aria-label="Min total hours"
              value={minHours}
              onChange={(e) => setMinHours(e.target.value)}
              placeholder="e.g. 4"
              inputMode="decimal"
              style={{
                width: '100%',
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                fontWeight: 950,
                background: '#fff',
                color: theme.text,
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 1000, color: theme.text }}>Filtered dataset</div>
          <div style={{ color: theme.muted2, fontWeight: 950 }}>{filtered.length} workday(s)</div>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              border: `2px dashed ${theme.text}`,
              borderRadius: theme.radiusSm,
              fontWeight: 1000,
            }}
          >
            No workdays match these filters.
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
              <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Total hours</div>
              <div style={{ marginTop: 6, fontWeight: 1100, fontSize: 22 }}>{format2(insights.totalHours)}</div>
            </div>

            <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
              <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Fuel cost</div>
              <div style={{ marginTop: 6, fontWeight: 1100, fontSize: 22 }}>{format2(insights.fuelCost)}</div>
            </div>

            <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
              <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Supplier spend</div>
              <div style={{ marginTop: 6, fontWeight: 1100, fontSize: 22 }}>{format2(insights.supplierSpend)}</div>
            </div>

            {insights.topSupplier ? (
              <div style={{ padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
                <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>Top supplier</div>
                <div style={{ marginTop: 6, fontWeight: 1100, fontSize: 16 }}>{insights.topSupplier.supplierName}</div>
                <div style={{ marginTop: 4, fontWeight: 1100, fontSize: 20 }}>{format2(insights.topSupplier.amountSpent)}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {filtered.length > 0 && focus === 'report' ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 1100, color: theme.text }}>{reportTitle}</div>
              <div style={{ color: theme.muted2, fontWeight: 950, fontSize: 12 }}>
                {aiBusy ? 'Gemini generating…' : aiReportSource === 'gemini' ? 'Powered by Gemini' : 'Powered by local analyzer'}
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: '#0b1220',
                color: '#e5e7eb',
                padding: 14,
                borderRadius: theme.radiusMd,
                border: `1px solid ${theme.borderSoft}`,
                fontSize: 12,
                lineHeight: 1.5,
                maxHeight: 560,
                overflow: 'auto',
              }}
            >
              {aiReportText}
            {aiError ? (
              <div style={{ marginTop: 8, color: theme.error, fontWeight: 900, fontSize: 12 }}>
                Gemini fallback used. {aiError}
              </div>
            ) : null}
            </div>
          </div>
        ) : null}

        {filtered.length > 0 && focus === 'jobs' ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 1100, color: theme.text }}>Top jobs by total job hours</div>
            <div style={{ marginTop: 10, overflow: 'auto', border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 10, borderBottom: `2px solid ${theme.text}` }}>Job ID</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: `2px solid ${theme.text}` }}>Complete hours</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: `2px solid ${theme.text}` }}>Return hours</th>
                    <th style={{ textAlign: 'right', padding: 10, borderBottom: `2px solid ${theme.text}` }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jobBreakdown.map((r) => (
                    <tr key={r.jobIdNumber}>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', fontWeight: 1000 }}>{r.jobIdNumber}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 950 }}>{format2(r.completeHours)}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 950 }}>{format2(r.returnHours)}</td>
                      <td style={{ padding: 10, borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 1100 }}>{format2(r.totalHours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {filtered.length > 0 && focus === 'expenses' ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 1100, color: theme.text }}>Expense highlights</div>
            <ul style={{ margin: '10px 0 0 18px', color: theme.text, fontWeight: 900, lineHeight: 1.5 }}>
              <li>
                Top supplier: <b>{insights.topSupplier?.supplierName ?? '—'}</b> ({format2(insights.topSupplier?.amountSpent ?? 0)})
              </li>
              <li>
                Total fuel cost: <b>{format2(insights.fuelCost)}</b>
              </li>
              <li>
                Total supplier spend: <b>{format2(insights.supplierSpend)}</b>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
