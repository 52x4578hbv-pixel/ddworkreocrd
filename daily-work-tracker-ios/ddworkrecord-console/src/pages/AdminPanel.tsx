import { useEffect, useState } from 'react'
import { assignEmployee } from '../lib/api'

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
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 900 }}>
      <h1 style={{ margin: 0 }}>Admin Panel</h1>
      <p style={{ marginTop: 8, color: '#475569' }}>
        MVP admin tools (employee code assignment). Role enforcement is handled by the API.
      </p>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#fee2e2', borderLeft: '4px solid #ef4444', fontWeight: 800 }}>
          {error}
        </div>
      )}
      {ok && (
        <div style={{ marginTop: 16, padding: 12, background: '#dcfce7', borderLeft: '4px solid #22c55e', fontWeight: 800 }}>
          {ok}
        </div>
      )}

      <div style={{ marginTop: 18, padding: 16, border: '2px solid #0f172a', borderRadius: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }} title="Employee code">
              Employee code
            </label>
            <input
              title="Employee code"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              style={{ width: '100%', padding: 10 }}
              placeholder="e.g. EMP-001"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }} title="Display name">
              Display name
            </label>
            <input
              title="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ width: '100%', padding: 10 }}
              placeholder="e.g. Jane Worker"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: 6 }} title="Vehicle id (optional)">
              Vehicle ID (optional)
            </label>
            <input
              title="Vehicle ID (optional)"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              style={{ width: '100%', padding: 10 }}
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
              border: '2px solid #0f172a',
              background: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 900,
            }}
          >
            {loading ? 'Saving…' : 'Save employee'}
          </button>

          <div style={{ color: '#64748b', fontWeight: 800, fontSize: 12 }}>
            Uses POST /api/v1/admin/employees
          </div>
        </div>
      </div>
    </div>
  )
}
