import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

type WorkdayRecordForXlsx = {
  tenantId: string;
  id: string;
  employeeId: string;
  date: string;
  startMileage: number | null;
  endMileage: number | null;
  totalHours: number;
  totalDistanceKm: number;
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

type Payload = {
  records: WorkdayRecordForXlsx[];
  options: { startDate?: string; endDate?: string; employeeCode?: string };
};

const safeNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const getFuelCost = (record: WorkdayRecordForXlsx): number => {
  const fuels = Array.isArray(record.fuels) ? record.fuels : [];
  return fuels.reduce<number>(
    (acc, f) => acc + safeNum((f as { totalCost?: unknown } | undefined)?.totalCost),
    0
  );
};

const getSupplierCost = (record: WorkdayRecordForXlsx): number => {
  const suppliers = Array.isArray(record.suppliers) ? record.suppliers : [];
  return suppliers.reduce<number>(
    (acc, s) => acc + safeNum((s as { amountSpent?: unknown } | undefined)?.amountSpent),
    0
  );
};

const buildRowData = (record: WorkdayRecordForXlsx) => {
  const fuelCost = getFuelCost(record);
  const supplierCost = getSupplierCost(record);

  return {
    id: record.id,
    employeeCode: record.employeeId,
    displayName: record.employeeId,
    workDate: record.date,
    totalHours: safeNum(record.totalHours),
    mileageKm: safeNum(record.totalDistanceKm),
    fuelCost,
    supplierCost,
    startMileage: record.startMileage ?? null,
    endMileage: record.endMileage ?? null,
    jobDescription: '',
    notes: record.endNotes ?? '',
  };
};

const main = async () => {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    process.stderr.write('Usage: xlsxWorker <payloadPath>\n');
    process.exitCode = 2;
    return;
  }

  const raw = require('fs').readFileSync(payloadPath, 'utf8') as string;
  const payload = JSON.parse(raw) as Payload;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DD Work Record System';
  workbook.created = new Date();

  const normalized = payload.records.map(buildRowData);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'employeeCode', label: 'Employee Code' },
    { key: 'displayName', label: 'Employee Name' },
    { key: 'workDate', label: 'Date (YYYY-MM-DD)' },
    { key: 'totalHours', label: 'Hours' },
    { key: 'mileageKm', label: 'Mileage (km)' },
    { key: 'fuelCost', label: 'Fuel Cost' },
    { key: 'supplierCost', label: 'Supplier Cost' },
    { key: 'startMileage', label: 'Start Mileage' },
    { key: 'endMileage', label: 'End Mileage' },
    { key: 'jobDescription', label: 'Job Description' },
    { key: 'notes', label: 'Notes' },
  ] as const;

  const rawSheet = workbook.addWorksheet('RawData', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  rawSheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: Math.max(12, c.label.length + 2),
  }));

  rawSheet.addRows(normalized);

  const summarySheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  summarySheet.columns = [
    { header: 'Employee Code', key: 'employeeCode', width: 20 },
    { header: 'Total Hours', key: 'totalHours', width: 14 },
    { header: 'Total Mileage (km)', key: 'mileageKm', width: 18 },
    { header: 'Total Fuel Cost', key: 'fuelCost', width: 16 },
    { header: 'Total Supplier Cost', key: 'supplierCost', width: 18 },
  ];

  const totalsByEmployee = new Map<
    string,
    { employeeCode: string; totalHours: number; mileageKm: number; fuelCost: number; supplierCost: number }
  >();

  for (const r of normalized) {
    const key = String(r.employeeCode ?? '');
    const existing =
      totalsByEmployee.get(key) ??
      ({
        employeeCode: key,
        totalHours: 0,
        mileageKm: 0,
        fuelCost: 0,
        supplierCost: 0,
      } satisfies {
        employeeCode: string;
        totalHours: number;
        mileageKm: number;
        fuelCost: number;
        supplierCost: number;
      });

    existing.totalHours += safeNum(r.totalHours);
    existing.mileageKm += safeNum(r.mileageKm);
    existing.fuelCost += safeNum(r.fuelCost);
    existing.supplierCost += safeNum(r.supplierCost);

    totalsByEmployee.set(key, existing);
  }

  const summaryRows = Array.from(totalsByEmployee.values()).sort((a, b) => b.totalHours - a.totalHours);
  summarySheet.addRows(summaryRows);

  const footerNote = [
    payload.options.startDate ? `Start: ${payload.options.startDate}` : '',
    payload.options.endDate ? `End: ${payload.options.endDate}` : '',
    payload.options.employeeCode ? `Employee: ${payload.options.employeeCode}` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  rawSheet.getCell(`A${rawSheet.rowCount + 2}`).value = `Export: ${footerNote || 'All records'}`;

  const filenameParts = ['workday_reports'];
  if (payload.options.startDate) filenameParts.push(payload.options.startDate);
  if (payload.options.endDate) filenameParts.push('to');
  if (payload.options.endDate) filenameParts.push(payload.options.endDate);
  if (payload.options.employeeCode) filenameParts.push(payload.options.employeeCode);
  const filename = `${filenameParts.join('_')}.xlsx`;

  const buffer = (await (workbook.xlsx as any).writeBuffer()) as Buffer;

  // Output contract: write the base64 to stdout for parent to return.
  // Also write a copy next to payload for debugging (non-fatal).
  try {
    writeFileSync(payloadPath + '.out.xlsx', buffer);
  } catch {
    // ignore
  }

  process.stdout.write(buffer.toString('base64'));
  // Provide filename for parent via stderr line (non-breaking).
  process.stderr.write(`\n${filename}\n`);
};

void main().catch((e) => {
  process.stderr.write(`Worker failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 1;
});
