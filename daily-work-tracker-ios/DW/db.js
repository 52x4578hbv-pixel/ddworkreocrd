"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
/**
 * Centralized PostgreSQL connection pool.
 * In production, ensure these values are populated via environment variables.
 */
// Fail fast: avoid silently using a wrong default password/user.
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        // In dev/early Azure bring-up we may want the server to start in DB-less mode.
        // DB-dependent routes may still fail at query time, but we avoid a hard crash on boot.
        console.warn(`[db] Missing required environment variable: ${name}. Starting with an empty value; DB routes may fail.`);
        return '';
    }
    return value;
}
exports.db = new pg_1.Pool({
    user: process.env.DB_USER ? process.env.DB_USER : 'postgres',
    host: process.env.DB_HOST ? process.env.DB_HOST : 'localhost',
    database: process.env.DB_NAME ? process.env.DB_NAME : 'work_tracker',
    password: requireEnv('DB_PASSWORD'),
    port: parseInt(process.env.DB_PORT ? process.env.DB_PORT : '5432'),
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
