declare module 'exceljs' {
  // Minimal typings to satisfy TS for this project.
  // excelExportService only uses `new ExcelJS.Workbook()` and `workbook.xlsx.write(res)`.
  export default class ExcelJS {
    static Workbook: new () => {
      creator?: string;
      created?: Date;
      addWorksheet: (name: string, options?: unknown) => {
        columns: Array<{ header: string; key: string; width?: number }>;
        addRows: (rows: Array<Record<string, unknown>>) => void;
        getCell: (address: string) => { value: unknown };
        rowCount: number;
      };
      xlsx: { write: (stream: NodeJS.WritableStream) => Promise<void> };
    };
  }
}
