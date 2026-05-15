-- Employee Management
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT UNIQUE NOT NULL, -- The "ID" entered in the app
    display_name TEXT NOT NULL,
    vehicle_assigned TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workday Summaries (Aggregated from Mobile Sync)
CREATE TABLE workday_records (
    id TEXT PRIMARY KEY, -- Sync ID from mobile
    employee_code TEXT REFERENCES employees(employee_code),
    work_date DATE NOT NULL,
    total_hours FLOAT DEFAULT 0,
    total_distance_km FLOAT DEFAULT 0,
    start_mileage FLOAT,
    end_mileage FLOAT,
    raw_data JSONB, -- Stores the full segment array for deep audit
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workday_date ON workday_records(work_date);