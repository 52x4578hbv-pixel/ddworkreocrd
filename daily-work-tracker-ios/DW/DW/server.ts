import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

console.log('[server] boot: imported core deps');

const app = express();

// IMPORTANT:
// Do NOT statically import route modules at startup.
// Some routes pull in heavy dependencies (firebase/admin/report/excel/db) and
// can hang during module initialization, preventing the server from ever
// reaching app.listen().
//
// Instead, lazily require them per mount and cache the result.
type ExpressRoute = ReturnType<typeof express.Router>;

const lazyRoute = (factory: () => { default: ExpressRoute }) => {
  let cached: ExpressRoute | null = null;
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      if (!cached) cached = factory().default;
      return (cached as any)(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
};

const adminRoutesHandler = lazyRoute(() => require('./adminRoutes'));
const consoleRoutesHandler = lazyRoute(() => require('./consoleRoutes'));
const syncRoutesHandler = lazyRoute(() => require('./syncRoutes'));
const mediaRoutesHandler = lazyRoute(() => require('./mediaRoutes'));
const businessRoutesHandler = lazyRoute(() => require('./businessRoutes'));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large JSON workday records
app.use('/uploads', express.static('uploads')); // Serve uploaded photos

// IMPORTANT: keep this log string stable so we can grep it from Azure container logs.
app.get('/__health', (_req, res) => {
  const uploadPath = path.resolve('./uploads/workday-photos');
  let uploadsWritable = false;
  try {
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    fs.accessSync(uploadPath, fs.constants.W_OK);
    uploadsWritable = true;
  } catch (e) {
    uploadsWritable = false;
  }

  console.log('[DW_HEALTH] patchMarker=in_repo_server_ts_v1 features.businessRoutes=true');

  res.status(200).json({ 
    ok: true, 
    status: 'online',
    uploadsPath: uploadPath,
    uploadsWritable,
    // Direct-in-repo marker (bypasses CI patching)
    patchMarker: 'in_repo_server_ts_v1',
    features: { businessRoutes: true },
    version: 'in_repo_server_ts_v1__backend_smoke_20260515',
    env: { hasDbPassword: Boolean(process.env.DB_PASSWORD) } 
  });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Error] ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* Routes (lazy handlers) */
app.use('/api/v1/admin', adminRoutesHandler as any);
app.use('/api/v1/console', consoleRoutesHandler as any);
app.use('/api/v1/workday', syncRoutesHandler as any);
app.use('/api/v1/media', mediaRoutesHandler as any);

console.log('[DW_MOUNT] mounting /api/v1/business');

app.use('/api/v1/business', businessRoutesHandler as any);

// Start Server
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
    console.log(`Enterprise Work Tracker API running on port ${PORT}`);
});
