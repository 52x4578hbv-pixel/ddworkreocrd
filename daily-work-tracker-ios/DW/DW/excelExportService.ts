import type { Response } from 'express';
import ExcelJS from 'exceljs';
import type { WorkdayRecordForReports } from './memoryStore';

type ReportRow = {
  id: string;
  employeeCode: string;
  displayName: string;
  workDate: string; // YYYY-MM-DD
  totalHours: number;
  mileageKm: number;
  fuelCost: number;
  supplierCost: number;
  startMileage: number | null;
  endMileage: number | null;
  jobDescription: string;
  notes: string;
};

const safeNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const getFuelCost = (record: WorkdayRecordForReports): number => {
  const fuels = Array.isArray(record.fuels) ? record.fuels : [];
  return fuels.reduce<number>(
    (acc, f) => acc + safeNum((f as { totalCost?: unknown } | undefined)?.totalCost),
    0
  );
};

const getSupplierCost = (record: WorkdayRecordForReports): number => {
  const suppliers = Array.isArray(record.suppliers) ? record.suppliers : [];
  return suppliers.reduce<number>(
    (acc, s) => acc + safeNum((s as { amountSpent?: unknown } | undefined)?.amountSpent),
    0
  );
};

const buildRowData = (record: WorkdayRecordForReports): ReportRow => {
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
    // These are not currently present in the sync payload shape, so we keep placeholders
    jobDescription: '',
    notes: record.endNotes ?? '',
  };
};

const headerRow = (columns: Array<{ key: string; label: string }>) => {
  return columns.map((c) => ({ header: c.label, key: c.key }));
};

export const generateWorkdayExcel = async (
  records: WorkdayRecordForReports[],
  res: Response,
  options: { startDate?: string; endDate?: string; employeeCode?: string }
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DD Work Record System';
  workbook.created = new Date();

  const normalized = records.map(buildRowData);

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
  ];

  // Raw sheet (pivot-friendly: simple table, no merged cells)
  const rawSheet = workbook.addWorksheet('RawData', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  rawSheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key as keyof ReportRow,
    width: Math.max(12, c.label.length + 2),
  }));

  rawSheet.addRows(normalized);

  // Summary sheet: per-employee totals for pivot-friendly starting point
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
    const key = r.employeeCode;
    const existing =
      totalsByEmployee.get(key) ??
      ({
        employeeCode: key,
        totalHours: 0,
        mileageKm: 0,
        fuelCost: 0,
        supplierCost: 0,
      } satisfies { employeeCode: string; totalHours: number; mileageKm: number; fuelCost: number; supplierCost: number });

    existing.totalHours += safeNum(r.totalHours);
    existing.mileageKm += safeNum(r.mileageKm);
    existing.fuelCost += safeNum(r.fuelCost);
    existing.supplierCost += safeNum(r.supplierCost);

    totalsByEmployee.set(key, existing);
  }

  const summaryRows = Array.from(totalsByEmployee.values()).sort((a, b) => b.totalHours - a.totalHours);
  summarySheet.addRows(summaryRows);

  // Pivot-friendly note: Keep a deterministic order and clean cell values.
  const footerNote = [
    options.startDate ? `Start: ${options.startDate}` : '',
    options.endDate ? `End: ${options.endDate}` : '',
    options.employeeCode ? `Employee: ${options.employeeCode}` : '',
  ].filter(Boolean).join(' | ');

  rawSheet.getCell(`A${rawSheet.rowCount + 2}`).value = `Export: ${footerNote || 'All records'}`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filenameParts = ['workday_reports'];
  if (options.startDate) filenameParts.push(options.startDate);
  if (options.endDate) filenameParts.push('to');
  if (options.endDate) filenameParts.push(options.endDate);
  if (options.employeeCode) filenameParts.push(options.employeeCode);

  res.setHeader('Content-Disposition', `attachment; filename=${filenameParts.join('_')}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
};
