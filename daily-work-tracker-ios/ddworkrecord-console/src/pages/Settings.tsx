import { useMemo, useState } from 'react'
import { theme } from '../lib/theme'

type Country = 'ZA' | 'US'

type EmployeeProfile = { code: string; firstName: string; lastName: string }
type AssistantProfile = { code: string; firstName: string; lastName: string }
type VehicleProfile = {
  code: string
  carType: string
  registrationNumber: string
  nickname?: string
}

const LS_BUSINESS_ADDRESS = 'ddworkrecord_business_address'
const LS_BUSINESS_COUNTRY = 'ddworkrecord_business_country'
const LS_BUSINESS_CODE = 'ddworkrecord_business_code'

const LS_EMPLOYEE_PROFILES_KEY = 'ddworkrecord_employee_profiles_json'
const LS_EMPLOYEE_CODES = 'ddworkrecord_employee_codes_csv'

const LS_ASSISTANT_PROFILES_KEY = 'ddworkrecord_assistant_profiles_json'
const LS_ASSISTANT_CODES = 'ddworkrecord_assistant_codes_csv'

const LS_VEHICLE_PROFILES_KEY = 'ddworkrecord_vehicle_profiles_json'
const LS_VEHICLE_CODES = 'ddworkrecord_vehicle_codes_csv'

function safeRead(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function safeWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function scopedKey(baseKey: string): string {
  const code = safeRead(LS_BUSINESS_CODE).trim()
  if (!code) return baseKey
  return `ddworkrecord_business_${code}_${baseKey}`
}

function normalizeCountry(raw: string): Country {
  const s = raw.trim().toUpperCase()
  if (s === 'US') return 'US'
  return 'ZA'
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0')
}

function employeeCode(i: number): string {
  return `EMP-${pad3(i)}`
}

function assistantCode(i: number): string {
  return `AS-${pad3(i)}`
}

function vehicleCode(i: number): string {
  return `VEH-${pad3(i)}`
}

function safeReadEmployeeProfiles(): EmployeeProfile[] {
  try {
    const raw = localStorage.getItem(scopedKey(LS_EMPLOYEE_PROFILES_KEY))
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

    profiles.sort((a, b) => {
      const ai = Number((a.code.match(/^EMP-(\d{3})$/) ?? [])[1] ?? 0)
      const bi = Number((b.code.match(/^EMP-(\d{3})$/) ?? [])[1] ?? 0)
      return ai - bi
    })

    return profiles
  } catch {
    return []
  }
}

function safeReadAssistantProfiles(): AssistantProfile[] {
  try {
    const raw = localStorage.getItem(LS_ASSISTANT_PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const profiles: AssistantProfile[] = []
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

    profiles.sort((a, b) => {
      const ai = Number((a.code.match(/^AS-(\d{3})$/) ?? [])[1] ?? 0)
      const bi = Number((b.code.match(/^AS-(\d{3})$/) ?? [])[1] ?? 0)
      return ai - bi
    })

    return profiles
  } catch {
    return []
  }
}

function safeReadVehicleProfiles(): VehicleProfile[] {
  try {
    const raw = localStorage.getItem(LS_VEHICLE_PROFILES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    const profiles: VehicleProfile[] = []
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue
      const v = item as Record<string, unknown>

      const codeRaw = v.code
      const carTypeRaw = v.carType
      const regRaw = v.registrationNumber
      const nicknameRaw = v.nickname

      if (typeof codeRaw !== 'string' || typeof carTypeRaw !== 'string' || typeof regRaw !== 'string') continue

      const code = codeRaw.trim().toUpperCase()
      const carType = carTypeRaw.trim()
      const registrationNumber = regRaw.trim()
      const nickname = typeof nicknameRaw === 'string' ? nicknameRaw.trim() : undefined

      if (!code || !carType || !registrationNumber) continue

      profiles.push({
        code,
        carType,
        registrationNumber,
        nickname: nickname && nickname.length > 0 ? nickname : undefined,
      })
    }

    profiles.sort((a, b) => {
      const ai = Number((a.code.match(/^VEH-(\d{3})$/) ?? [])[1] ?? 0)
      const bi = Number((b.code.match(/^VEH-(\d{3})$/) ?? [])[1] ?? 0)
      return ai - bi
    })

    return profiles
  } catch {
    return []
  }
}

export default function Settings() {
  const [businessCountry, setBusinessCountry] = useState<Country>(() => normalizeCountry(safeRead(LS_BUSINESS_COUNTRY) || 'ZA'))
  const [businessAddress, setBusinessAddress] = useState<string>(() => safeRead(LS_BUSINESS_ADDRESS))
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const businessCode = useMemo(() => safeRead(LS_BUSINESS_CODE).trim(), [])

  const [employeeProfiles, setEmployeeProfiles] = useState<EmployeeProfile[]>(() => safeReadEmployeeProfiles())
  const employeeCodesCsv = useMemo(() => employeeProfiles.map((p) => p.code).join(','), [employeeProfiles])

  const [employeeFirstName, setEmployeeFirstName] = useState<string>('')
  const [employeeLastName, setEmployeeLastName] = useState<string>('')

  const [assistantProfiles, setAssistantProfiles] = useState<AssistantProfile[]>(() => safeReadAssistantProfiles())
  const assistantCodesCsv = useMemo(() => assistantProfiles.map((p) => p.code).join(','), [assistantProfiles])

  const [assistantFirstName, setAssistantFirstName] = useState<string>('')
  const [assistantLastName, setAssistantLastName] = useState<string>('')

  const [vehicleProfiles, setVehicleProfiles] = useState<VehicleProfile[]>(() => safeReadVehicleProfiles())
  const vehicleCodesCsv = useMemo(() => vehicleProfiles.map((p) => p.code).join(','), [vehicleProfiles])

  const [vehicleCarType, setVehicleCarType] = useState<string>('')
  const [vehicleRegistration, setVehicleRegistration] = useState<string>('')
  const [vehicleNickname, setVehicleNickname] = useState<string>('')

  const previewSummary = useMemo(() => {
    return {
      employeeCount: employeeProfiles.length,
      assistantCount: assistantProfiles.length,
      vehicleCount: vehicleProfiles.length,
    }
  }, [employeeProfiles.length, assistantProfiles.length, vehicleProfiles.length])

  const addEmployee = () => {
    const fn = employeeFirstName.trim()
    const ln = employeeLastName.trim()
    if (!fn || !ln) return

    const nextIndex = employeeProfiles.length + 1
    const code = employeeCode(nextIndex)

    const nextProfile: EmployeeProfile = { code, firstName: fn, lastName: ln }
    const nextProfiles = [...employeeProfiles, nextProfile]
    setEmployeeProfiles(nextProfiles)

    safeWrite(LS_EMPLOYEE_PROFILES_KEY, JSON.stringify(nextProfiles))
    safeWrite(LS_EMPLOYEE_CODES, nextProfiles.map((p) => p.code).join(','))

    setEmployeeFirstName('')
    setEmployeeLastName('')
    setSavedAt(Date.now())
  }

  const addAssistant = () => {
    const fn = assistantFirstName.trim()
    const ln = assistantLastName.trim()
    if (!fn || !ln) return

    const nextIndex = assistantProfiles.length + 1
    const code = assistantCode(nextIndex)

    const nextProfile: AssistantProfile = { code, firstName: fn, lastName: ln }
    const nextProfiles = [...assistantProfiles, nextProfile]
    setAssistantProfiles(nextProfiles)

    safeWrite(LS_ASSISTANT_PROFILES_KEY, JSON.stringify(nextProfiles))
    safeWrite(LS_ASSISTANT_CODES, nextProfiles.map((p) => p.code).join(','))

    setAssistantFirstName('')
    setAssistantLastName('')
    setSavedAt(Date.now())
  }

  const addVehicle = () => {
    const ct = vehicleCarType.trim()
    const reg = vehicleRegistration.trim()
    if (!ct || !reg) return

    const nextIndex = vehicleProfiles.length + 1
    const code = vehicleCode(nextIndex)

    const nickname = vehicleNickname.trim() || undefined
    const nextProfile: VehicleProfile = { code, carType: ct, registrationNumber: reg, nickname }

    const nextProfiles = [...vehicleProfiles, nextProfile]
    setVehicleProfiles(nextProfiles)

    safeWrite(LS_VEHICLE_PROFILES_KEY, JSON.stringify(nextProfiles))
    safeWrite(LS_VEHICLE_CODES, nextProfiles.map((p) => p.code).join(','))

    setVehicleCarType('')
    setVehicleRegistration('')
    setVehicleNickname('')
    setSavedAt(Date.now())
  }

  const persistAll = () => {
    safeWrite(LS_BUSINESS_COUNTRY, businessCountry)
    safeWrite(LS_BUSINESS_ADDRESS, businessAddress)

    safeWrite(LS_EMPLOYEE_PROFILES_KEY, JSON.stringify(employeeProfiles))
    safeWrite(LS_EMPLOYEE_CODES, employeeCodesCsv)

    safeWrite(LS_ASSISTANT_PROFILES_KEY, JSON.stringify(assistantProfiles))
    safeWrite(LS_ASSISTANT_CODES, assistantCodesCsv)

    safeWrite(LS_VEHICLE_PROFILES_KEY, JSON.stringify(vehicleProfiles))
    safeWrite(LS_VEHICLE_CODES, vehicleCodesCsv)

    setSavedAt(Date.now())
  }

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
      <h1 style={{ margin: 0, color: theme.text }}>Console Settings</h1>
      <p style={{ marginTop: 8, color: theme.muted, fontWeight: 850, fontSize: 14 }}>
        Business country for public-holiday hours + local employee/assistant/vehicle setup.
      </p>

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
          {businessCode || '—'}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Business country</label>
              <select
                aria-label="Business country"
                title="Business country"
                value={businessCountry}
                onChange={(e) => setBusinessCountry(normalizeCountry(e.target.value))}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: theme.radiusSm,
                  border: `2px solid ${theme.text}`,
                  fontWeight: 950,
                  background: theme.surface,
                  color: theme.text,
                  outline: 'none',
                  height: 42,
                }}
              >
                <option value="ZA">South Africa</option>
                <option value="US">USA</option>
              </select>

              <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>Used by public-holiday hours classification.</div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 1100, marginBottom: 8, color: theme.text }}>Business address (optional)</label>
              <input
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                title="Business address (optional)"
                placeholder="e.g. 123 Main St, City"
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: theme.radiusSm,
                  border: `2px solid ${theme.text}`,
                  fontWeight: 950,
                  outline: 'none',
                  background: theme.surface,
                  color: theme.text,
                }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 1100, color: theme.text, marginBottom: 8 }}>Employees (name → generated EMP codes)</div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>First name</label>
                      <input
                        value={employeeFirstName}
                        onChange={(e) => setEmployeeFirstName(e.target.value)}
                        title="First name"
                        placeholder="e.g. Thandi"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Surname</label>
                      <input
                        value={employeeLastName}
                        onChange={(e) => setEmployeeLastName(e.target.value)}
                        title="Surname"
                        placeholder="e.g. Mokoena"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={addEmployee}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${theme.text}`,
                        background: theme.text,
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 1100,
                        borderRadius: theme.radiusSm,
                        boxShadow: `3px 3px 0 ${theme.text}`,
                        whiteSpace: 'nowrap',
                        height: 42,
                      }}
                    >
                      Add Employee ({employeeProfiles.length + 1 ? `EMP-${pad3(employeeProfiles.length + 1)}` : 'EMP'})
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>EMP codes (CSV)</label>
                    <input
                      value={employeeCodesCsv}
                      readOnly
                      title="Employee codes (CSV)"
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: theme.radiusSm,
                        border: `2px solid ${theme.text}`,
                        fontWeight: 950,
                        outline: 'none',
                        background: '#fff',
                        color: theme.text,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
                    Total parsed employees: {previewSummary.employeeCount}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 1100, color: theme.text, marginBottom: 8 }}>Assistants (name → generated AS codes)</div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>First name</label>
                      <input
                        value={assistantFirstName}
                        onChange={(e) => setAssistantFirstName(e.target.value)}
                        title="Assistant first name"
                        placeholder="e.g. Sipho"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Surname</label>
                      <input
                        value={assistantLastName}
                        onChange={(e) => setAssistantLastName(e.target.value)}
                        title="Assistant surname"
                        placeholder="e.g. Dlamini"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={addAssistant}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${theme.text}`,
                        background: theme.text,
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 1100,
                        borderRadius: theme.radiusSm,
                        boxShadow: `3px 3px 0 ${theme.text}`,
                        whiteSpace: 'nowrap',
                        height: 42,
                      }}
                    >
                      Add Assistant ({assistantProfiles.length + 1 ? `AS-${pad3(assistantProfiles.length + 1)}` : 'AS'})
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Assistant codes (CSV)</label>
                    <input
                      value={assistantCodesCsv}
                      readOnly
                      title="Assistant codes (CSV)"
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: theme.radiusSm,
                        border: `2px solid ${theme.text}`,
                        fontWeight: 950,
                        outline: 'none',
                        background: '#fff',
                        color: theme.text,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
                    Total assistants: {previewSummary.assistantCount}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 1100, color: theme.text, marginBottom: 8 }}>Vehicles (car type + registration → generated VEH codes)</div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Car type</label>
                      <input
                        value={vehicleCarType}
                        onChange={(e) => setVehicleCarType(e.target.value)}
                        title="Car type"
                        placeholder="e.g. Sedan / Truck"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Registration number</label>
                      <input
                        value={vehicleRegistration}
                        onChange={(e) => setVehicleRegistration(e.target.value)}
                        title="Registration number"
                        placeholder="e.g. KLL 1234"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <div style={{ flex: '1 1 220px' }}>
                      <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>
                        Nickname <span style={{ color: theme.muted2, fontWeight: 900 }}>(optional)</span>
                      </label>
                      <input
                        value={vehicleNickname}
                        onChange={(e) => setVehicleNickname(e.target.value)}
                        title="Nickname (optional)"
                        placeholder="e.g. Company car"
                        style={{
                          width: '100%',
                          padding: 12,
                          borderRadius: theme.radiusSm,
                          border: `2px solid ${theme.text}`,
                          fontWeight: 950,
                          outline: 'none',
                          background: theme.surface,
                          color: theme.text,
                          height: 42,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={addVehicle}
                      style={{
                        padding: '12px 16px',
                        border: `2px solid ${theme.text}`,
                        background: theme.text,
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 1100,
                        borderRadius: theme.radiusSm,
                        boxShadow: `3px 3px 0 ${theme.text}`,
                        whiteSpace: 'nowrap',
                        height: 42,
                      }}
                    >
                      Add Vehicle ({vehicleProfiles.length + 1 ? `VEH-${pad3(vehicleProfiles.length + 1)}` : 'VEH'})
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={{ display: 'block', fontWeight: 1000, marginBottom: 6, color: theme.text }}>Vehicle codes (CSV)</label>
                    <input
                      value={vehicleCodesCsv}
                      readOnly
                      title="Vehicle codes (CSV)"
                      placeholder=""
                      style={{
                        width: '100%',
                        padding: 12,
                        borderRadius: theme.radiusSm,
                        border: `2px solid ${theme.text}`,
                        fontWeight: 950,
                        outline: 'none',
                        background: '#fff',
                        color: theme.text,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 6, color: theme.muted2, fontWeight: 850, fontSize: 12 }}>
                    Parsed vehicles: {previewSummary.vehicleCount}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={persistAll}
                  style={{
                    padding: '12px 16px',
                    border: `2px solid ${theme.text}`,
                    background: theme.text,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 1100,
                    borderRadius: theme.radiusSm,
                    boxShadow: `3px 3px 0 ${theme.text}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Save Settings (local)
                </button>

                {savedAt ? (
                  <div style={{ color: theme.muted2, fontWeight: 1000 }}>
                    Saved ✓ ({new Date(savedAt).toLocaleTimeString()})
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 12, color: theme.muted2, fontWeight: 850, fontSize: 12.5 }}>
                These values are used by the console template and local preview. Backend wiring for tenant-scoped storage can be added later.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
