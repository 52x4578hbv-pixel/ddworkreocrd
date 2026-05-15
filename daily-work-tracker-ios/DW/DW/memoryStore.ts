import type { z } from 'zod';

export type WorkdayRecordForReports = {
  tenantId: string;
  id: string;
  employeeId: string;
  date: string; // ISO date string (YYYY-MM-DD works too)
  startMileage: number | null;
  endMileage: number | null;
  totalHours: number;
  totalDistanceKm: number;

  // Preserve full segment objects from the mobile app.
  // This is required for PDF/live-location generation (needs clientName/location fields).
  jobs: unknown[];
  fuels: unknown[];
  suppliers: unknown[];
  workshops: unknown[];
  travels: unknown[];
  privateSegments: unknown[];

  vehicleId?: string | null;
  endNotes?: string | null;

  dayStartLocation?: { lat: number; lng: number } | any;
  dayEndLocation?: { lat: number; lng: number } | any;
};

const makeKey = (tenantId: string, recordId: string) => `${tenantId}::${recordId}`;

const recordsByKey = new Map<string, WorkdayRecordForReports>();

export const memoryStore = {
  upsert: (record: WorkdayRecordForReports) => {
    recordsByKey.set(makeKey(record.tenantId, record.id), record);
  },
  getAll: (tenantId?: string): WorkdayRecordForReports[] => {
    if (!tenantId) return Array.from(recordsByKey.values());
    const prefix = `${tenantId}::`;
    return Array.from(recordsByKey.values()).filter((r) => r.tenantId === tenantId && r.id && makeKey(r.tenantId, r.id).startsWith(prefix));
  },
  reset: () => recordsByKey.clear(),
};
