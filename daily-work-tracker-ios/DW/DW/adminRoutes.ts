import express, { Request, Response } from 'express';
import { db } from '../db';
import { authenticateAdmin } from './auth';
import { generateDailyPDF } from './reportService';
import { memoryStore } from './memoryStore';

const router = express.Router();

// Helper function to extract the latest location from a raw_data object
const extractLatestLocation = (rawData: any): { lat: number; lng: number } | null => {
    if (!rawData) return null;

    // If the day has officially ended and a valid end location is present
    if (rawData.dayEndLocation && rawData.dayEndLocation.lat !== 0 && rawData.dayEndLocation.lng !== 0) {
        return rawData.dayEndLocation;
    }

    // If day is in progress or end location is invalid, find the latest segment's end location
    let latestTime: Date | null = null;
    let latestLocation: { lat: number; lng: number } | null = null;

    const segments = [
        ...(rawData.workshops || []),
        ...(rawData.travels || []),
        ...(rawData.suppliers || []),
        ...(rawData.fuels || []),
        ...(rawData.jobs || []),
        ...(rawData.privateSegments || [])
    ];

    for (const segment of segments) {
        let segmentEndTime: Date | null = null;
        let segmentEndLocation: { lat: number; lng: number } | null = null;

        // Determine segment end time and location based on type
        if (segment.endTime) { // Most segments have endTime
            segmentEndTime = new Date(segment.endTime);
            segmentEndLocation = segment.endLocation || segment.departureLocation;
        } else if (segment.departureTime) { // Supplier/Fuel use departureTime
            segmentEndTime = new Date(segment.departureTime);
            segmentEndLocation = segment.departureLocation;
        } else if (segment.startTime) { // If a segment is still active, its start time is the latest known point
            segmentEndTime = new Date(segment.startTime);
            segmentEndLocation = segment.startLocation || segment.arrivalLocation;
        }

        if (segmentEndTime && segmentEndLocation && segmentEndLocation.lat !== 0 && segmentEndLocation.lng !== 0) {
            if (!latestTime || segmentEndTime > latestTime) {
                latestTime = segmentEndTime;
                latestLocation = segmentEndLocation;
            }
        }
    }

    // If no segments provided a valid latest location, fall back to dayStartLocation
    if (latestLocation) {
        return latestLocation;
    } else if (rawData.dayStartLocation && rawData.dayStartLocation.lat !== 0 && rawData.dayStartLocation.lng !== 0) {
        return rawData.dayStartLocation;
    }
    return null;
};

// Assign or Create Employee Code (tenant-scoped via Firebase custom claims)
router.post('/employees', authenticateAdmin, async (req: Request, res: Response) => {
    const { employeeCode, displayName, vehicleId } = req.body;

    try {
        const tenantId = (req as any).authTenantId as string | null;
        if (!tenantId) {
            return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
        }

        if (!employeeCode || typeof employeeCode !== 'string') {
            return res.status(400).json({ error: 'employeeCode is required.' });
        }
        if (!displayName || typeof displayName !== 'string') {
            return res.status(400).json({ error: 'displayName is required.' });
        }

        // Tenant-isolated persistence (best-effort): tenants/{tenantId}/employees/{employeeCode}
        try {
            const mod = await import('./firebaseAdmin');
            const firestore = mod.getFirestore();

            await firestore
                .collection('tenants')
                .doc(tenantId)
                .collection('employees')
                .doc(employeeCode)
                .set(
                    {
                        employee_code: employeeCode,
                        display_name: displayName,
                        vehicle_assigned: vehicleId ?? null,
                        is_active: true,
                        updated_at: new Date().toISOString(),
                    },
                    { merge: true }
                );

            return res.json({
                employee_code: employeeCode,
                display_name: displayName,
                vehicle_assigned: vehicleId ?? null,
            });
        } catch (e) {
            console.error('Firestore employee upsert failed:', e);
            return res.status(500).json({ error: 'Failed to persist employee.' });
        }
    } catch (err) {
        console.error('assign employee failed:', err);
        return res.status(500).json({ error: 'Failed to assign employee code' });
    }
});

// Fetch Reports (tenant-safe)
// NOTE: Postgres schema in this repo does not yet include tenantId on workday_records,
// so to prevent cross-tenant data leakage, DB-backed reporting is blocked for now.
router.get('/reports', authenticateAdmin, async (req: Request, res: Response) => {
    return res.status(501).json({
        error: 'Tenant-isolated /api/v1/admin/reports is not implemented for DB mode yet (missing tenantId in Postgres schema).',
    });
});

// PDF Export Route: Tenant-safe not yet possible with current record shape.
// Prevent cross-tenant leaks by blocking until Firestore tenant docs include
// the fields expected by reportService.ts.
router.get('/reports/:id/pdf', authenticateAdmin, async (req: Request, res: Response) => {
    const rawId = req.params.id
    const id = Array.isArray(rawId) ? rawId[0] : rawId

    if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Missing workday id.' })
    }

    const tenantId = (req as any).authTenantId as string | null
    if (!tenantId) {
        return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })
    }

    const record = memoryStore.getAll(tenantId).find((r) => r.id === id)
    if (!record) {
        return res.status(404).json({ error: 'Workday record not found.' })
    }

    return generateDailyPDF(record, res)
});

// Excel Export Route (DB-less mode via memoryStore + ExcelJS)
// Generates two sheets: RawData + Summary (pivot-friendly: clean headers, no merged cells)
router.get('/reports/export/xlsx', authenticateAdmin, async (req, res) => {
    const { startDate, endDate, employeeCode } = req.query;

    try {
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required (YYYY-MM-DD)' });
        }

        const startIso = String(startDate);
        const endIso = String(endDate);

        const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
        const end = new Date(`${endIso}T00:00:00.000Z`).getTime() + 24 * 3600 * 1000; // inclusive end day

        const tenantId = (req as any).authTenantId as string | null;
        if (!tenantId) {
            return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
        }

        const all = memoryStore.getAll(tenantId);

        const filtered = all
            .filter((r) => {
                const t = new Date(`${r.date}T00:00:00.000Z`).getTime();
                return t >= start && t < end;
            })
            .filter((r) => {
                if (!employeeCode) return true;
                return r.employeeId === String(employeeCode);
            })
            .sort((a, b) => a.date.localeCompare(b.date));

        const options: { startDate: string; endDate: string; employeeCode?: string } = {
            startDate: startIso,
            endDate: endIso,
        };
        if (employeeCode) options.employeeCode = String(employeeCode);

        // Generate XLSX in an isolated worker so exceljs module-load can't hang the API request.
        const mod = await import('./xlsxExportWorkerService');
        const { buffer, filename } = await mod.generateWorkdayExcelViaWorker(filtered, options);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(buffer);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to export XLSX:', err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('timed out')) {
            return res.status(501).json({
                error: 'XLSX export unavailable (exceljs timed out). Use /api/v1/admin/reports/export/csv instead.',
            });
        }
        return res.status(500).json({ error: 'Failed to export XLSX reports' });
    }
});

// CSV Export Route: Exports filtered workday records as CSV (DB-less mode via memoryStore)
router.get('/reports/export/csv', authenticateAdmin, async (req: Request, res: Response) => {
    const { startDate, endDate, employeeCode } = req.query;

    try {
        const startIso = String(startDate);
        const endIso = String(endDate);

        const start = new Date(`${startIso}T00:00:00.000Z`).getTime();
        const end = new Date(`${endIso}T00:00:00.000Z`).getTime() + 24 * 3600 * 1000; // inclusive end day

        const tenantId = (req as any).authTenantId as string | null;
        if (!tenantId) {
            return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
        }

        const all = memoryStore.getAll(tenantId);

        const filtered = all
            .filter(r => {
                const t = new Date(`${r.date}T00:00:00.000Z`).getTime();
                return t >= start && t < end;
            })
            .filter(r => {
                if (!employeeCode) return true;
                return r.employeeId === String(employeeCode);
            })
            .sort((a, b) => a.date.localeCompare(b.date));

        const header = [
            'id',
            'employee_code',
            'display_name',
            'work_date',
            'total_hours',
            'total_distance_km',
            'start_mileage',
            'end_mileage',
            'vehicle_id',
            'day_start_lat',
            'day_start_lng',
            'day_end_lat',
            'day_end_lng',
            'synced_at',
            'end_notes'
        ];

        const escapeCsv = (value: unknown): string => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };

        const csvLines: string[] = [];
        csvLines.push(header.join(','));

        for (const row of filtered) {
            const rawDayStart = row.dayStartLocation ?? null;
            const rawDayEnd = row.dayEndLocation ?? null;

            const dayStartLat = rawDayStart?.lat ?? null;
            const dayStartLng = rawDayStart?.lng ?? null;
            const dayEndLat = rawDayEnd?.lat ?? null;
            const dayEndLng = rawDayEnd?.lng ?? null;

            csvLines.push([
                row.id,
                row.employeeId,
                row.employeeId, // no display_name in DB-less mode; fallback to employeeId
                row.date,
                row.totalHours,
                row.totalDistanceKm,
                row.startMileage,
                row.endMileage,
                row.vehicleId ?? null,
                dayStartLat,
                dayStartLng,
                dayEndLat,
                dayEndLng,
                '', // synced_at not available in DB-less mode
                row.endNotes ?? ''
            ].map(escapeCsv).join(','));
        }

        const filename = `workday_reports_${startIso}_to_${endIso}${employeeCode ? `_${employeeCode}` : ''}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(csvLines.join('\n'));
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to export CSV:', err);
        res.status(500).json({ error: 'Failed to export CSV reports' });
    }
});

// Live locations (DB mode only, but cannot be tenant-safe yet)
router.get('/live-locations', authenticateAdmin, async (_req: Request, res: Response) => {
    return res.status(501).json({
        error: 'Tenant-isolated live locations not implemented yet (missing tenantId in Postgres schema and missing required record shape for Firestore).',
    });
});

export default router;
