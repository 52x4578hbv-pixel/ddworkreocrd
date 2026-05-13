export default function Settings() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: 24, maxWidth: 980 }}>
      <h1 style={{ margin: 0 }}>Settings</h1>
      <p style={{ marginTop: 8, color: '#475569', fontWeight: 800, fontSize: 14 }}>System Configuration</p>

      <div style={{ marginTop: 24, border: '2px solid #0f172a', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '2px solid #0f172a', background: '#f8fafc', fontWeight: 1000 }}>
          Console Preferences
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontWeight: 900 }}>Admin Notification Email</div>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Primary address for automated reports.</div>
              <input type="email" placeholder="admin@dd-tracker.com" style={{ width: '100%', maxWidth: 400, padding: 10, border: '2px solid #0f172a', borderRadius: 8, fontWeight: 800 }} />
            </div>

            <div>
              <div style={{ fontWeight: 900 }}>Data Archival Policy</div>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Retention period for high-resolution GPS trace data.</div>
              <select style={{ width: '100%', maxWidth: 400, padding: 10, border: '2px solid #0f172a', borderRadius: 8, fontWeight: 900 }}>
                <option>90 Days (Default)</option>
                <option>1 Year</option>
                <option>Indefinite</option>
              </select>
            </div>

            <div style={{ padding: 16, background: '#f1f5f9', borderRadius: 8, border: '2px dashed #cbd5e1' }}>
              <div style={{ fontWeight: 900, fontSize: 13 }}>Offline Sync Service</div>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>Service worker is active. Console is ready for offline usage.</div>
            </div>

            <button type="button" style={{ alignSelf: 'flex-start', padding: '12px 24px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 1000, cursor: 'pointer' }}>
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
