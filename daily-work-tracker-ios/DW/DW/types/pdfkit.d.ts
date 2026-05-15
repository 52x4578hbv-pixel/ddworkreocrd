declare module 'pdfkit' {
  import type { Writable } from 'stream';

  interface PDFDocument {
    pipe(destination: Writable): void;
    end(): void;

    fontSize(size: number): PDFDocument;
    moveDown(multiplier?: number): PDFDocument;
    text(content: string, options?: Record<string, unknown>): PDFDocument;
  }

  const PDFDocumentCtor: new (...args: unknown[]) => PDFDocument;
  export default PDFDocumentCtor;
}
