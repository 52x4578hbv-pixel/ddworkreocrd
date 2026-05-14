import { theme } from '../lib/theme'

export default function Settings() {
  return (
    <div
      style={{
        fontFamily: 'system-ui',
        padding: 24,
        maxWidth: 980,
        margin: '0 auto',
        background: theme.pageBg,
        minHeight: '100vh',
      }}
    >
      <h1 style={{ margin: 0, color: theme.text }}>Settings</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 800, fontSize: 14 }}>System Configuration</p>

      <div
        style={{
          marginTop: 24,
          border: `2px solid ${theme.borderSoft}`,
          borderRadius: theme.radiusMd,
          background: theme.surface,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: `2px solid ${theme.borderSoft}`,
            background: theme.accentBg,
            fontWeight: 1000,
            color: theme.text,
          }}
        >
          Console Preferences
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontWeight: 1000, color: theme.text }}>Admin Notification Email</div>
              <div style={{ color: theme.muted2, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                Primary address for automated reports.
              </div>
              <input
                type="email"
                placeholder="admin@dd-tracker.com"
                style={{
                  width: '100%',
                  maxWidth: 400,
                  padding: 10,
                  border: `2px solid ${theme.text}`,
                  borderRadius: theme.radiusSm,
                  fontWeight: 900,
                  outline: 'none',
                  background: theme.surface,
                  color: theme.text,
                }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 1000, color: theme.text }}>Data Archival Policy</div>
              <div style={{ color: theme.muted2, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                Retention period for high-resolution GPS trace data.
              </div>
              <select
                aria-label="Retention period"
                title="Retention period"
                style={{
                  width: '100%',
                  maxWidth: 400,
                  padding: 10,
                  border: `2px solid ${theme.text}`,
                  borderRadius: theme.radiusSm,
                  fontWeight: 900,
                  background: theme.surface,
                  color: theme.text,
                  outline: 'none',
                }}
              >
                <option>90 Days (Default)</option>
                <option>1 Year</option>
                <option>Indefinite</option>
              </select>
            </div>

            <div
              style={{
                padding: 16,
                background: theme.accentBg,
                borderRadius: theme.radiusSm,
                border: `2px dashed ${theme.borderSoft}`,
              }}
            >
              <div style={{ fontWeight: 1000, fontSize: 13, color: theme.text }}>Offline Sync Service</div>
              <div style={{ color: theme.muted2, fontSize: 12, fontWeight: 800 }}>
                Service worker is active. Console is ready for offline usage.
              </div>
            </div>

            <button
              type="button"
              style={{
                alignSelf: 'flex-start',
                padding: '12px 24px',
                background: theme.text,
                color: '#fff',
                border: 'none',
                borderRadius: theme.radiusSm,
                fontWeight: 1100,
                cursor: 'pointer',
                boxShadow: `3px 3px 0 ${theme.text}`,
                whiteSpace: 'nowrap',
              }}
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
