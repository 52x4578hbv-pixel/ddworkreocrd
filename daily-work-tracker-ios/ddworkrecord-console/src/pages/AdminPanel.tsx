import { useEffect, useState } from 'react'
import { assignEmployee } from '../lib/api'
import { theme } from '../lib/theme'

export default function AdminPanel() {
  const [employeeCode, setEmployeeCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [vehicleId, setVehicleId] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setError(null)
    setOk(null)
  }, [])

  const submit = async () => {
    setError(null)
    setOk(null)
    setLoading(true)

    try {
      if (!employeeCode.trim()) {
        setError('Employee code is required.')
        return
      }
      if (!displayName.trim()) {
        setError('Display name is required.')
        return
      }

      const res = await assignEmployee(
        employeeCode.trim(),
        displayName.trim(),
        vehicleId.trim() ? vehicleId.trim() : null,
      )

      setOk(res?.employee_code ? 'Employee saved.' : 'Employee saved (response received).')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save employee.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 900, margin: '0 auto', background: theme.pageBg, minHeight: '100vh' }}>
      <h1 style={{ margin: 0, color: theme.text }}>Admin Panel</h1>
      <p style={{ marginTop: 8, color: theme.muted }}>
        MVP admin tools (employee code assignment). Role enforcement is handled by the API.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: theme.errorBg, borderLeft: `4px solid ${theme.error}`, fontWeight: 900, color: theme.text, borderRadius: theme.radiusSm }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ marginTop: 16, padding: 12, background: theme.accentPillBg, borderLeft: `4px solid ${theme.success}`, fontWeight: 900, color: theme.text, borderRadius: theme.radiusSm }}>
          {ok}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 16, border: `2px solid ${theme.borderSoft}`, borderRadius: theme.radiusMd, background: theme.surface }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 6, color: theme.text }} title="Employee code">
              Employee code
            </label>
            <input
              title="Employee code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: theme.radiusSm, border: `2px solid ${theme.text}`, outline: 'none', background: theme.surface, color: theme.text, fontWeight: 900 }}
              placeholder="e.g. EMP-001"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 6, color: theme.text }} title="Display name">
              Display name
            </label>
            <input
              title="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: theme.radiusSm, border: `2px solid ${theme.text}`, outline: 'none', background: theme.surface, color: theme.text, fontWeight: 900 }}
              placeholder="e.g. Jane Worker"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 1050, marginBottom: 6, color: theme.text }} title="Vehicle id (optional)">
              Vehicle ID (optional)
            </label>
            <input
              title="Vehicle ID (optional)"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: theme.radiusSm, border: `2px solid ${theme.text}`, outline: 'none', background: theme.surface, color: theme.text, fontWeight: 900 }}
              placeholder="e.g. V-123"
            />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => void submit()}
            disabled={loading}
            style={{
              padding: '12px 16px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 1050,
              borderRadius: theme.radiusSm,
              boxShadow: `3px 3px 0 ${theme.text}`,
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Saving…' : 'Save employee'}
          </button>

          <div style={{ color: theme.muted2, fontWeight: 900, fontSize: 12 }}>
            Uses POST /api/v1/admin/employees
          </div>
        </div>
      </div>
    </div>
  )
}
