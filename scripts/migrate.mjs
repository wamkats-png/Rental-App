#!/usr/bin/env node
/**
 * RentFlow Uganda — Automated Database Migration Runner
 *
 * Uses the Supabase Management API to execute SQL migrations.
 * Tracks applied migrations in a _schema_migrations table so it's
 * safe to run multiple times — only pending migrations are executed.
 *
 * Usage:
 *   npm run migrate              — run all pending migrations
 *   npm run migrate -- --dry-run — list pending migrations without running
 *   npm run migrate -- --status  — show migration status
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const ENV_PATH = path.join(ROOT, '.env.local');

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadEnv() {
  const env = {};
  if (!fs.existsSync(ENV_PATH)) return env;
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.+?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function saveTokenToEnv(token) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  if (content.includes('SUPABASE_ACCESS_TOKEN=')) {
    content = content.replace(/^SUPABASE_ACCESS_TOKEN=.*/m, `SUPABASE_ACCESS_TOKEN="${token}"`);
  } else {
    content = content.trimEnd() + `\n\n# ── Supabase Management API ──────────────────────────────────────────────────\nSUPABASE_ACCESS_TOKEN="${token}"\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()); }));
}

// ── Supabase Management API ───────────────────────────────────────────────────

async function runSQL(projectRef, token, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${data.message || data.error || text}`);
  }
  return data;
}

async function ensureMigrationsTable(projectRef, token) {
  await runSQL(projectRef, token, `
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id serial PRIMARY KEY,
      filename text UNIQUE NOT NULL,
      applied_at timestamptz DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(projectRef, token) {
  const rows = await runSQL(projectRef, token, `
    SELECT filename FROM _schema_migrations ORDER BY id;
  `);
  return new Set((rows || []).map(r => r.filename));
}

async function markApplied(projectRef, token, filename) {
  await runSQL(projectRef, token, `
    INSERT INTO _schema_migrations (filename) VALUES ('${filename}')
    ON CONFLICT (filename) DO NOTHING;
  `);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isStatus = args.includes('--status');

  console.log('\n🚀 RentFlow Database Migration Runner\n');

  // ── 1. Load credentials ──────────────────────────────────────────────────
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  let token = env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

  if (!supabaseUrl) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL not found in .env.local');
    process.exit(1);
  }

  // Extract project ref from URL: https://XXXX.supabase.co
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  console.log(`📦 Project: ${projectRef}`);

  // ── 2. Get access token if missing ───────────────────────────────────────
  if (!token) {
    console.log('\n⚠️  SUPABASE_ACCESS_TOKEN not found.\n');
    console.log('To create one:');
    console.log('  1. Go to https://supabase.com/dashboard/account/tokens');
    console.log('  2. Click "Generate new token"');
    console.log('  3. Name it "rentflow-migrations" and copy the token\n');
    token = await prompt('Paste your Supabase access token: ');
    if (!token) { console.error('❌  No token provided.'); process.exit(1); }

    // Test it
    try {
      await runSQL(projectRef, token, 'SELECT 1');
      console.log('✅  Token valid!\n');
    } catch (e) {
      console.error(`❌  Token test failed: ${e.message}`);
      process.exit(1);
    }

    // Save for future runs
    saveTokenToEnv(token);
    console.log('💾  Token saved to .env.local for future runs.\n');
  }

  // ── 3. Read migration files ───────────────────────────────────────────────
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetical = chronological (001_, 002_, ...)

  if (files.length === 0) {
    console.log('No migration files found in supabase/migrations/');
    return;
  }

  // ── 4. Ensure tracking table exists ──────────────────────────────────────
  try {
    await ensureMigrationsTable(projectRef, token);
  } catch (e) {
    console.error(`❌  Failed to create migrations tracking table: ${e.message}`);
    process.exit(1);
  }

  // ── 5. Get applied migrations ─────────────────────────────────────────────
  let applied;
  try {
    applied = await getAppliedMigrations(projectRef, token);
  } catch (e) {
    console.error(`❌  Failed to fetch applied migrations: ${e.message}`);
    process.exit(1);
  }

  const pending = files.filter(f => !applied.has(f));

  // ── 6. Status mode ────────────────────────────────────────────────────────
  if (isStatus) {
    console.log('Migration Status:\n');
    for (const f of files) {
      const status = applied.has(f) ? '✅  applied' : '⏳  pending';
      console.log(`  ${status}  ${f}`);
    }
    console.log(`\n${applied.size} applied, ${pending.length} pending.\n`);
    return;
  }

  // ── 7. Nothing to do? ─────────────────────────────────────────────────────
  if (pending.length === 0) {
    console.log('✅  All migrations already applied. Database is up to date.\n');
    return;
  }

  console.log(`Found ${pending.length} pending migration${pending.length > 1 ? 's' : ''}:\n`);
  for (const f of pending) console.log(`  ⏳  ${f}`);

  if (isDryRun) {
    console.log('\n(Dry run — no changes made)\n');
    return;
  }

  console.log('');

  // ── 8. Run pending migrations ─────────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;

  for (const filename of pending) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');

    process.stdout.write(`  ▶  ${filename} ... `);
    try {
      await runSQL(projectRef, token, sql);
      await markApplied(projectRef, token, filename);
      console.log('✅');
      successCount++;
    } catch (e) {
      console.log(`❌\n     Error: ${e.message}\n`);
      failCount++;
      // Ask whether to continue or abort on failure
      const answer = await prompt('     Continue with remaining migrations? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        console.log('\n⚠️  Aborted. Fix the error above and re-run `npm run migrate`.\n');
        process.exit(1);
      }
    }
  }

  // ── 9. Summary ───────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  if (failCount === 0) {
    console.log(`✅  ${successCount} migration${successCount !== 1 ? 's' : ''} applied successfully.\n`);
  } else {
    console.log(`⚠️  ${successCount} succeeded, ${failCount} failed. Review errors above.\n`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error('\n❌  Unexpected error:', e.message);
  process.exit(1);
});
