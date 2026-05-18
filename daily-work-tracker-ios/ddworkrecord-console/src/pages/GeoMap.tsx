import { useEffect, useMemo, useState } from 'react'
import { fetchLiveLocations, getAdminToken } from '../lib/api'
import { fetchBusinessLiveLocations, getBusinessCode } from '../lib/businessApi'
import { theme } from '../lib/theme'

type LiveLocation = Awaited<ReturnType<typeof fetchLiveLocations>> extends (infer U)[] ? U : never

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

type Point = {
  employeeCode: string
  lat: number
  lng: number
}

function projectEquirectangular(lat: number, lng: number, width: number, height: number) {
  // lng: [-180,180] => x: [0,width]
  const x = ((lng + 180) / 360) * width
  // lat: [90,-90] => y: [0,height]
  const y = ((90 - lat) / 180) * height
  return { x, y }
}

export default function GeoMap() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorActionHash, setErrorActionHash] = useState<string | null>(null)
  const [locations, setLocations] = useState<LiveLocation[] | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const adminToken = getAdminToken()
      const businessCode = getBusinessCode()

      // Prefer admin mode when available.
      if (adminToken) {
        setBusy(true)
        setError(null)
        setErrorActionHash(null)
        try {
          const res = await fetchLiveLocations()
          if (!cancelled) setLocations(res)
        } catch (e) {
          if (cancelled) return
          const message = e instanceof Error ? e.message : 'Failed to fetch live locations.'
          setError(message)
          setErrorActionHash('#login')
          setLocations(null)
        } finally {
          if (!cancelled) setBusy(false)
        }
        return
      }

      // Business mode when business code exists.
      if (businessCode) {
        setBusy(true)
        setError(null)
        setErrorActionHash(null)
        try {
          const res = await fetchBusinessLiveLocations()
          if (!cancelled) setLocations(res)
        } catch (e) {
          if (cancelled) return
          const message = e instanceof Error ? e.message : 'Failed to fetch live locations.'
          setError(message)
          setErrorActionHash('#business-login')
          setLocations(null)
        } finally {
          if (!cancelled) setBusy(false)
        }
        return
      }

      // Neither token exists.
      setLocations(null)
      setError('Not logged in. Please open #business-login and enter your business code.')
      setErrorActionHash('#business-login')
      setBusy(false)
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const points = useMemo(() => {
    if (!locations) return [] as Point[]
    const out: Point[] = []
    for (const row of locations) {
      const employeeCode = String((row as any).employeeCode ?? '').trim()
      const loc = (row as any).location as { lat: unknown; lng: unknown } | null | undefined
      if (!employeeCode) continue
      if (!loc) continue
      const lat = Number((loc as any).lat)
      const lng = Number((loc as any).lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      if (lat === 0 && lng === 0) continue
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      out.push({ employeeCode, lat, lng })
    }
    return out
  }, [locations])

  const mapW = 900
  const mapH = 450
  const viewBox = `0 0 ${mapW} ${mapH}`

  const selectedPoint = useMemo(() => {
    if (!selectedCode) return null
    return points.find((p) => p.employeeCode === selectedCode) ?? null
  }, [points, selectedCode])

  const markers = useMemo(() => {
    return points.map((p) => {
      const { x, y } = projectEquirectangular(p.lat, p.lng, mapW, mapH)
      return { ...p, x, y }
    })
  }, [points])

  const visibleMarkers = markers.filter((m) => {
    // Example: allow all; kept for future filtering.
    return true
  })

  const title = locations && points.length ? `Geo Map (latest locations: ${points.length})` : 'Geo Map'

  return (
    <div style={{ fontFamily: 'system-ui', padding: 18, maxWidth: 1200, margin: '0 auto', color: theme.text }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 1200 }}>{title}</h1>
        <div style={{ color: theme.muted, fontWeight: 900, fontSize: 13 }}>
          Plot is a simple equirectangular projection (no external map libs).
        </div>
      </div>

      <div style={{ marginTop: 14, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface }}>
        <div style={{ padding: 12, borderBottom: `2px solid ${theme.borderSoft}`, fontWeight: 1100 }}>
          Latest employee coordinates
        </div>

        {error ? (
          <div style={{ padding: 12 }}>
            <div
              style={{
                padding: 12,
                background: theme.errorBg,
                borderLeft: `4px solid ${theme.error}`,
                borderRadius: theme.radiusSm,
                fontWeight: 950,
                color: theme.text,
              }}
            >
              {error}
            </div>

            {errorActionHash ? (
              <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    window.location.hash = errorActionHash
                  }}
                  style={{
                    padding: '10px 14px',
                    border: `2px solid ${theme.text}`,
                    background: theme.text,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 1100,
                    borderRadius: theme.radiusSm,
                    whiteSpace: 'nowrap',
                    boxShadow: `3px 3px 0 ${theme.text}`,
                  }}
                >
                  {errorActionHash === '#business-login' ? 'Go to Business Login' : 'Go to Login'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
            <div
              style={{
                border: `2px solid ${theme.borderSoft}`,
                borderRadius: theme.radiusMd,
                background: '#fff',
                overflow: 'hidden',
                minHeight: 430,
              }}
            >
              {busy || !locations ? (
                <div style={{ padding: 18, fontWeight: 1100 }}>
                  {busy ? 'Loading…' : 'No data yet.'}
                </div>
              ) : (
                <svg width="100%" viewBox={viewBox} role="img" aria-label="Employee locations geo map">
                  {/* background */}
                  <rect x="0" y="0" width={mapW} height={mapH} fill="#fff" />

                  {/* grid */}
                  {Array.from({ length: 19 }).map((_, i) => {
                    const lat = 90 - i * 10 // 90..-80
                    const { y } = projectEquirectangular(lat, 0, mapW, mapH)
                    return (
                      <g key={`lat-${lat}`}>
                        <line x1="0" y1={y} x2={mapW} y2={y} stroke={theme.borderSoft} strokeWidth="1" />
                        <text x="8" y={clamp(y - 4, 12, mapH - 12)} fontSize="12" fill={theme.muted2} fontWeight="900">
                          {lat}
                        </text>
                      </g>
                    )
                  })}
                  {Array.from({ length: 37 }).map((_, i) => {
                    const lng = -180 + i * 10 // -180..180
                    const { x } = projectEquirectangular(0, lng, mapW, mapH)
                    return (
                      <g key={`lng-${lng}`}>
                        <line x1={x} y1="0" x2={x} y2={mapH} stroke={theme.borderSoft} strokeWidth="1" />
                      </g>
                    )
                  })}

                  {/* selection / marker highlight */}
                  {visibleMarkers.map((m) => {
                    const isSelected = selectedCode === m.employeeCode
                    const r = isSelected ? 9 : 6
                    return (
                      <g key={m.employeeCode}>
                        <circle cx={m.x} cy={m.y} r={r} fill={isSelected ? theme.accent : theme.text} opacity={0.95} />
                        <circle cx={m.x} cy={m.y} r={r + 3} fill="none" stroke="#000" strokeWidth={2} />
                        {isSelected ? (
                          <>
                            <text x={clamp(m.x + 10, 0, mapW - 10)} y={clamp(m.y - 10, 14, mapH - 14)} fontSize="13" fill="#000" fontWeight={1100}>
                              {m.employeeCode}
                            </text>
                          </>
                        ) : null}
                      </g>
                    )
                  })}

                  {/* axes labels */}
                  <text x={mapW - 90} y={mapH - 12} fontSize="12" fill={theme.muted2} fontWeight="900">
                    lng →
                  </text>
                  <text x={8} y={mapH - 12} fontSize="12" fill={theme.muted2} fontWeight="900">
                    lat →
                  </text>
                </svg>
              )}
            </div>

            <div style={{ border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.pageBg, overflow: 'hidden' }}>
              <div style={{ padding: 12, borderBottom: `2px solid ${theme.borderSoft}`, fontWeight: 1100 }}>
                Employees
              </div>

              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                {points.length ? (
                  points
                    .slice()
                    .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))
                    .map((p) => {
                      const isSelected = selectedCode === p.employeeCode
                      return (
                        <button
                          key={p.employeeCode}
                          type="button"
                          onClick={() => setSelectedCode((prev) => (prev === p.employeeCode ? null : p.employeeCode))}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: 10,
                            borderRadius: theme.radiusSm,
                            border: `2px solid ${isSelected ? theme.text : theme.borderSoft}`,
                            background: isSelected ? theme.surface : '#fff',
                            cursor: 'pointer',
                            fontWeight: 1000,
                            boxShadow: isSelected ? `3px 3px 0 ${theme.text}` : 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 1100 }}>
                            {p.employeeCode} {isSelected ? '✓' : ''}
                          </div>
                          <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 900, fontSize: 12.5 }}>
                            lat: {p.lat.toFixed(5)} • lng: {p.lng.toFixed(5)}
                          </div>
                        </button>
                      )
                    })
                ) : (
                  <div style={{ color: theme.muted2, fontWeight: 950, fontSize: 13 }}>
                    No coordinates available yet.
                  </div>
                )}

                {selectedPoint ? (
                  <div
                    style={{
                      padding: 12,
                      marginTop: 6,
                      border: `2px solid ${theme.accent}`,
                      borderRadius: theme.radiusMd,
                      background: theme.surface,
                    }}
                  >
                    <div style={{ fontWeight: 1200 }}>Selected: {selectedPoint.employeeCode}</div>
                    <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 900, fontSize: 13 }}>
                      lat: {selectedPoint.lat.toFixed(6)} <br />
                      lng: {selectedPoint.lng.toFixed(6)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, color: theme.muted2, fontWeight: 850, fontSize: 12.5 }}>
            Source: latest known segment end / day end location from stored workdays.
          </div>
        </div>
      </div>
    </div>
  )
}
