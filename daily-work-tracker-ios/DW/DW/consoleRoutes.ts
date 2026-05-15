import express, { Request, Response } from 'express';
import { authenticateAdmin } from './auth';
import { memoryStore } from './memoryStore';

const router = express.Router();

const asNumber = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const asNullableNumber = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

router.get('/stats/:period', authenticateAdmin, async (req: Request, res: Response) => {
  const rawPeriod = req.params.period;
  const period = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod;

  try {
    if (!period || !['day', 'week', 'month'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period. Use day|week|month' });
    }

    const tenantId = (req as any).authTenantId as string | null;
    if (!tenantId) {
      return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
    }

    let all: ReturnType<typeof memoryStore.getAll> = memoryStore.getAll(tenantId);

    // Try Firestore (collection: tenants/{tenantId}/workdays). If it fails, keep using memoryStore.
    try {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('Firebase not configured (FIREBASE_SERVICE_ACCOUNT missing), skipping Firestore.');
      }
      const mod = await import('./firebaseAdmin');
      const firestore = mod.getFirestore();
      const snapshot = await firestore.collection('tenants').doc(tenantId).collection('workdays').get();

      all = snapshot.docs.map((doc) => {
        const d = doc.data() as Record<string, unknown>;
        return {
          tenantId,
          id: doc.id,
          employeeId: String(d.employeeId ?? d.employee_id ?? ''),
          date: String(d.workDate ?? d.date ?? ''),
          startMileage: (d.startMileage as number | null) ?? null,
          endMileage: (d.endMileage as number | null) ?? null,
          totalHours: Number(d.totalHours ?? d.total_hours ?? 0),
          totalDistanceKm: Number(d.totalDistanceKm ?? d.total_distance_km ?? 0),
          jobs: (Array.isArray(d.jobs) ? d.jobs : []) as any[],
          fuels: (Array.isArray(d.fuels) ? d.fuels : []) as any[],
          suppliers: (Array.isArray(d.suppliers) ? d.suppliers : []) as any[],
          workshops: (Array.isArray(d.workshops) ? d.workshops : []) as unknown[],
          travels: (Array.isArray(d.travels) ? d.travels : []) as unknown[],
          privateSegments: (Array.isArray(d.privateSegments) ? d.privateSegments : []) as unknown[],
          vehicleId: (d.vehicleId as string | null) ?? null,
          endNotes: (d.endNotes as string | null) ?? null,
          dayStartLocation: (d.dayStartLocation ?? d.day_start_location) as any,
          dayEndLocation: (d.dayEndLocation ?? d.day_end_location) as any,
        };
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firestore read failed, using memoryStore:', e);
    }

    const now = new Date();
    const parseDate = (v: string) => {
      // expects YYYY-MM-DD
      return new Date(`${v}T00:00:00.000Z`);
    };

    const start = (() => {
      if (period === 'day') {
        const d = new Date(now);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }

      if (period === 'week') {
        const d = new Date(now);
        const day = d.getUTCDay(); // 0..6 (Sun=0)
        const diff = (day + 6) % 7; // Monday-based distance back
        d.setUTCDate(d.getUTCDate() - diff);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }

      // month
      const d = new Date(now);
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    })();

    const end = (() => {
      if (period === 'day') return new Date(start.getTime() + 24 * 3600 * 1000);
      if (period === 'week') return new Date(start.getTime() + 7 * 24 * 3600 * 1000);
      return new Date(new Date(start).setUTCMonth(start.getUTCMonth() + 1));
    })();

    const rows = all
      .filter(r => {
        const d = parseDate(r.date);
        return d >= start && d < end;
      })
        .map((r) => ({
          employee_code: r.employeeId,
          display_name: r.employeeId,
          work_date: r.date,
          total_hours: r.totalHours,
          total_distance_km: r.totalDistanceKm,
          raw_data: {
            fuels: (Array.isArray(r.fuels) ? r.fuels : []).map((f) => ({
              totalCost: asNumber((f as { totalCost?: unknown } | undefined)?.totalCost),
            })),
            suppliers: (Array.isArray(r.suppliers) ? r.suppliers : []).map((s) => ({
              amountSpent: asNumber((s as { amountSpent?: unknown } | undefined)?.amountSpent),
            })),
          },
        }));

    const startDayIso = start.toISOString().slice(0, 10);

    // Aggregate totals
    const totalsByEmployee: Record<
      string,
      { employeeCode: string; displayName: string; totalHours: number; totalDistanceKm: number; totalFuelCost: number; totalSupplierSpend: number }
    > = {};

    let grandTotalHours = 0;
    let grandTotalDistanceKm = 0;
    let grandFuelCost = 0;
    let grandSupplierSpend = 0;

    for (const row of rows) {
      const employeeCode = String(row.employee_code ?? '');
      if (!totalsByEmployee[employeeCode]) {
        totalsByEmployee[employeeCode] = {
          employeeCode,
          displayName: String(row.display_name ?? ''),
          totalHours: 0,
          totalDistanceKm: 0,
          totalFuelCost: 0,
          totalSupplierSpend: 0,
        };
      }

      const totalHours = asNumber(row.total_hours);
      const totalDistanceKm = asNumber(row.total_distance_km);

      totalsByEmployee[employeeCode].totalHours += totalHours;
      totalsByEmployee[employeeCode].totalDistanceKm += totalDistanceKm;

      grandTotalHours += totalHours;
      grandTotalDistanceKm += totalDistanceKm;

      const raw = row.raw_data ?? {};

      // Costs: from fuels[].totalCost and suppliers[].amountSpent (if present)
      const fuelCostSum = (raw.fuels ?? []).reduce((acc: number, f: any) => acc + asNumber(f?.totalCost), 0);
      const supplierSpendSum = (raw.suppliers ?? []).reduce((acc: number, s: any) => acc + asNumber(s?.amountSpent), 0);

      totalsByEmployee[employeeCode].totalFuelCost += fuelCostSum;
      totalsByEmployee[employeeCode].totalSupplierSpend += supplierSpendSum;

      grandFuelCost += fuelCostSum;
      grandSupplierSpend += supplierSpendSum;
    }

    const employees = Object.values(totalsByEmployee).sort((a, b) => b.totalHours - a.totalHours);

    return res.json({
      period,
      range: period === 'day' ? { day: startDayIso } : {},
      grandTotals: {
        totalHours: grandTotalHours,
        totalDistanceKm: grandTotalDistanceKm,
        fuelCost: grandFuelCost,
        supplierSpend: grandSupplierSpend,
      },
      employees,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch console stats:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to fetch console stats', message });
  }
});

router.get('/workdays/:id', authenticateAdmin, async (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing workday id.' });
  }

  try {
    const tenantId = (req as any).authTenantId as string | null;
    if (!tenantId) {
      return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' });
    }

    // Prefer Firestore if available (same document shape used in /stats)
    try {
      const mod = await import('./firebaseAdmin');
      const firestore = mod.getFirestore();
      const doc = await firestore.collection('tenants').doc(tenantId).collection('workdays').doc(id).get();

      if (doc.exists) {
        const d = doc.data() as Record<string, unknown>;
        return res.json({
          tenantId,
          id: doc.id,
          employeeId: String(d.employeeId ?? d.employee_id ?? ''),
          date: String(d.workDate ?? d.date ?? ''),
          startMileage: (d.startMileage as number | null) ?? null,
          endMileage: (d.endMileage as number | null) ?? null,
          totalHours: Number(d.totalHours ?? d.total_hours ?? 0),
          totalDistanceKm: Number(d.totalDistanceKm ?? d.total_distance_km ?? 0),
          jobs: (Array.isArray(d.jobs) ? d.jobs : []) as any[],
          fuels: (Array.isArray(d.fuels) ? d.fuels : []) as any[],
          suppliers: (Array.isArray(d.suppliers) ? d.suppliers : []) as any[],
          workshops: (Array.isArray(d.workshops) ? d.workshops : []) as unknown[],
          travels: (Array.isArray(d.travels) ? d.travels : []) as unknown[],
          privateSegments: (Array.isArray(d.privateSegments) ? d.privateSegments : []) as unknown[],
          vehicleId: (d.vehicleId as string | null) ?? null,
          endNotes: (d.endNotes as string | null) ?? null,
          dayStartLocation: (d.dayStartLocation ?? d.day_start_location) as any,
          dayEndLocation: (d.dayEndLocation ?? d.day_end_location) as any,
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firestore read failed for workday detail, falling back to memoryStore:', e);
    }

    const record = memoryStore.getAll(tenantId).find((r) => r.id === id);
    if (!record) {
      return res.status(404).json({ error: 'Workday record not found.' });
    }

    return res.json(record);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch workday detail:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to fetch workday detail', message });
  }
});

router.get('/workdays', authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const tenantId = (_req as any).authTenantId as string | null
    if (!tenantId) {
      return res.status(403).json({ error: 'Forbidden: Missing tenantId claim.' })
    }

    let all: ReturnType<typeof memoryStore.getAll> = memoryStore.getAll(tenantId)

    // Prefer Firestore (collection: tenants/{tenantId}/workdays) if available; fallback to memoryStore.
    try {
      const mod = await import('./firebaseAdmin')
      const firestore = mod.getFirestore()
      const snapshot = await firestore.collection('tenants').doc(tenantId).collection('workdays').get()
      all = snapshot.docs.map((doc) => {
        const d = doc.data() as Record<string, unknown>
        return {
          tenantId,
          id: doc.id,
          employeeId: String(d.employeeId ?? d.employee_id ?? ''),
          date: String(d.workDate ?? d.date ?? ''),
          startMileage: (d.startMileage as number | null) ?? null,
          endMileage: (d.endMileage as number | null) ?? null,
          totalHours: Number(d.totalHours ?? d.total_hours ?? 0),
          totalDistanceKm: Number(d.totalDistanceKm ?? d.total_distance_km ?? 0),
          jobs: (Array.isArray(d.jobs) ? d.jobs : []) as any[],
          fuels: (Array.isArray(d.fuels) ? d.fuels : []) as any[],
          suppliers: (Array.isArray(d.suppliers) ? d.suppliers : []) as any[],
          workshops: (Array.isArray(d.workshops) ? d.workshops : []) as unknown[],
          travels: (Array.isArray(d.travels) ? d.travels : []) as unknown[],
          privateSegments: (Array.isArray(d.privateSegments) ? d.privateSegments : []) as unknown[],
          vehicleId: (d.vehicleId as string | null) ?? null,
          endNotes: (d.endNotes as string | null) ?? null,
          dayStartLocation: (d.dayStartLocation ?? d.day_start_location) as any,
          dayEndLocation: (d.dayEndLocation ?? d.day_end_location) as any,
        }
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Firestore read failed for workdays list, using memoryStore:', e)
    }

    const rows = all
      .filter((r) => r?.id)
      .map((r) => ({
        id: r.id,
        date: r.date,
        employeeId: r.employeeId,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))

    return res.json({ count: rows.length, workdays: rows })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch workdays list:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'Failed to fetch workdays list', message })
  }
})

export default router;
