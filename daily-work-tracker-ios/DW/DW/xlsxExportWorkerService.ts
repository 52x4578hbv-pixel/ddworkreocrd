import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import os from 'os';
import path from 'path';
import type { WorkdayRecordForReports } from './memoryStore';

type ExportOptions = { startDate?: string; endDate?: string; employeeCode?: string };

type WorkerPayload = {
  records: WorkdayRecordForReports[];
  options: ExportOptions;
};

type WorkerResult = {
  buffer: Buffer;
  filename: string;
};

const XLSX_WORKER_TIMEOUT_MS = 3000;

const getWorkerFilenameFromStderr = (stderr: string): string | null => {
  // Worker prints filename on stderr as a final line.
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const last = lines[lines.length - 1];
  if (!last) return null;

  if (last.endsWith('.xlsx')) return last;
  return null;
};

export const generateWorkdayExcelViaWorker = async (
  records: WorkdayRecordForReports[],
  options: ExportOptions
): Promise<WorkerResult> => {
  const payload: WorkerPayload = { records, options };

  const tmpPayloadPath = path.join(
    os.tmpdir(),
    `dd_xlsx_payload_${Date.now()}_${Math.random().toString(16).slice(2)}.json`
  );

  writeFileSync(tmpPayloadPath, JSON.stringify(payload), 'utf8');

  const workerJsPath = path.join(__dirname, 'xlsxWorker.js');

  return await new Promise<WorkerResult>((resolve, reject) => {
    const child = spawn(process.execPath, [workerJsPath, tmpPayloadPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      const ms = Date.now() - startedAt;
      reject(new Error(`XLSX worker timed out after ${ms}ms`));
    }, XLSX_WORKER_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      try {
        // Cleanup temp payload
        unlinkSync(tmpPayloadPath);
      } catch {
        // ignore
      }

      if (code !== 0) {
        reject(new Error(`XLSX worker exited with code ${code}. stderr=${stderr.slice(-500)}`));
        return;
      }

      try {
        const base64 = stdout.trim();
        if (!base64) {
          reject(new Error(`XLSX worker produced empty stdout. stderr=${stderr.slice(-500)}`));
          return;
        }

        const filename = getWorkerFilenameFromStderr(stderr) ?? 'workday_reports.xlsx';
        const buffer = Buffer.from(base64, 'base64');
        resolve({ buffer, filename });
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Failed to decode XLSX worker output'));
      }
    });
  });
};
