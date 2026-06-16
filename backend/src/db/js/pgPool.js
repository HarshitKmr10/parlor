'use strict';

// Single shared pg.Pool for the pgStore adapter. Lazy-init on first use so
// modules that load the factory but never run a query (e.g. dry-run CLI
// tools) don't open a connection.
//
// Sized to match the prior Prisma config (maxConnections: 10). statement_timeout
// is set per-connection to bound runaway queries. pgbouncer transaction-mode
// (Supabase port 6543) requires no session-pinned state — we set the
// timeout via SET LOCAL inside each connection's initial query, which is
// allowed even in transaction-mode pgbouncer.

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; pgStore cannot connect');
  }

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.MEETING_JOINER_PG_MAX || '10', 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 20_000,
  });

  pool.on('error', (err) => {
    console.error('[meeting-joiner.pgPool] idle client error:', err.message);
  });

  pool.on('connect', (client) => {
    client.query("SET statement_timeout = '30s'").catch(() => {
      // Some pgbouncer modes reject SET; safe to ignore — query timeouts
      // are then governed by the bot's own watchdog instead.
    });
  });

  return pool;
}

async function closePool() {
  if (!pool) return;
  const p = pool;
  pool = null;
  await p.end();
}

module.exports = { getPool, closePool };
