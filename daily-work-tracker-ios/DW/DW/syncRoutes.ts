import express, { Request, Response } from 'express';
import { z } from 'zod';
import { memoryStore, type WorkdayRecordForReports } from './memoryStore';
import { authenticateRole } from './auth';

const router = express.Router();

const WorkdaySchema = z.object({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    date: z.string(), // ISO Date (YYYY-MM-DD)

    startMileage: z.number().nullable(),
    endMileage: z.number().nullable(),
    totalHours: z.number().nonnegative(),
    totalDistanceKm: z.number().nonnegative(),

    // Preserve full segment objects for PDF/live locations/reports.
    // The server should not down-map fields; it should store the app's full payload.
    jobs: z.array(z.any()),
    fuels: z.array(z.any()),
    suppliers: z.array(z.any()),
    workshops: z.array(z.any()),
    travels: z.array(z.any()),
    privateSegments: z.array(z.any()),

    vehicleId: z.string().optional().nullable(),
    endNotes: z.string().optional().nullable(),
    dayStartLocation: z.any().optional(),
    dayEndLocation: z.any().optional(),
});

/**
 * POST /api/v1/workday/sync
 * Receives a DailyWorkRecord from the mobile app.
 * Handles deduplication via ON CONFLICT on the record ID.
 *
 * NOTE: This server currently persists to memoryStore and Firestore.
 * The SQL upsert string is left out intentionally until DB wiring is complete.
 */
router.post('/sync', authenticateRole(['admin', 'manager', 'worker']), async (req: Request, res: Response) => {
    const record = req.body;

    try {
        const validatedData = WorkdaySchema.parse(record);

        const tenantId = (req as any).authTenantId as string | null;
        if (!tenantId) {
            return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
        }

        // Security: if the auth context includes an employeeCode (worker secret / firebase custom claims),
        // enforce that the incoming record.employeeId matches the authenticated employee.
        const authEmployeeCode = (req as any).authEmployeeCode as string | null;
        if (authEmployeeCode && authEmployeeCode !== validatedData.employeeId) {
            return res.status(403).json({ error: 'Forbidden: employeeId does not match authenticated worker.' });
        }

        const recordForReports: WorkdayRecordForReports = {
            tenantId,
            id: validatedData.id,
            employeeId: validatedData.employeeId,
            date: validatedData.date,
            startMileage: validatedData.startMileage,
            endMileage: validatedData.endMileage,
            totalHours: validatedData.totalHours,
            totalDistanceKm: validatedData.totalDistanceKm,

            // Keep full payload (do not down-map)
            jobs: validatedData.jobs,
            fuels: validatedData.fuels,
            suppliers: validatedData.suppliers,
            workshops: validatedData.workshops,
            travels: validatedData.travels,
            privateSegments: validatedData.privateSegments,

            vehicleId: validatedData.vehicleId ?? null,
            endNotes: validatedData.endNotes ?? null,
            dayStartLocation: validatedData.dayStartLocation,
            dayEndLocation: validatedData.dayEndLocation,
        };

        // In-memory for DB-less mode (tenant-scoped)
        memoryStore.upsert(recordForReports);

        // Firestore write (tenant-scoped) - best-effort
        try {
            const mod = await import('./firebaseAdmin');
            const firestore = mod.getFirestore();

            await firestore
                .collection('tenants')
                .doc(tenantId)
                .collection('workdays')
                .doc(validatedData.id)
                .set({
                    ...recordForReports,
                    workDate: validatedData.date,
                    syncedAt: new Date().toISOString(),
                });
        } catch (e) {
            console.error('Firestore write failed:', e);
        }

        res.status(200).json({ success: true });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            const details = 'issues' in error ? error.issues : error;
            return res.status(400).json({ error: 'Invalid data format', details });
        }

        console.error('Database Sync Error:', error);
        res.status(500).json({ error: 'Internal server error during sync' });
    }
});

export default router;
