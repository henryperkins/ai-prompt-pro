#!/usr/bin/env node
/**
 * Neon Postgres to Cloudflare D1 Migration Script
 *
 * Exports data from Neon Postgres and transforms for SQLite/D1 import
 *
 * Usage:
 *   node scripts/migrate-neon-to-d1.js --neon-url <postgres-url> --output <json-file>
 *
 * Then import to D1:
 *   wrangler d1 execute promptforge-db --local --file=workers/d1/schema.sql
 *   node scripts/import-d1.js --input <json-file>
 */

import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';

// Parse command line args
const args = process.argv.slice(2);
const neonUrl = args[args.indexOf('--neon-url') + 1];
const outputFile = args[args.indexOf('--output') + 1];

if (!neonUrl || !outputFile) {
  console.error('Usage: node scripts/migrate-neon-to-d1.js --neon-url <postgres-url> --output <json-file>');
  process.exit(1);
}

// Tables to export
const TABLES = [
  'profiles',
  'users', // Will be created from profiles + neon_auth
  'drafts',
  'saved_prompts',
  'community_posts',
  'community_votes',
  'community_comments',
  'prompt_versions',
];

async function runQuery(query) {
  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [
      neonUrl,
      '-t', // Tuples only
      '-A', // Unaligned
      '-c',
      query,
    ]);

    let stdout = '';
    let stderr = '';

    psql.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psql.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`psql exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function exportTable(tableName) {
  console.log(`Exporting ${tableName}...`);

  const query = `SELECT * FROM public.${tableName}`;
  const csvOutput = await runQuery(query);

  if (!csvOutput) {
    console.log(`  No data in ${tableName}`);
    return [];
  }

  // Parse CSV (simple - assumes no embedded commas/quotes)
  const lines = csvOutput.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  // Get column names from first row (psql -t -A doesn't output headers, need separate query)
  const columnsQuery = await runQuery(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = '${tableName}'
    AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  const columns = columnsQuery.split('\n').filter(c => c.trim());

  const rows = [];
  for (const line of lines) {
    const values = line.split('|'); // psql -A uses | delimiter
    const row = {};
    for (let i = 0; i < columns.length; i++) {
      row[columns[i]] = values[i] === '' ? null : values[i];
    }
    rows.push(row);
  }

  console.log(`  Exported ${rows.length} rows from ${tableName}`);
  return rows;
}

async function main() {
  console.log('Starting Neon Postgres export...\n');

  const exportData = {
    exportedAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of TABLES) {
    try {
      const rows = await exportTable(table);
      exportData.tables[table] = rows;
    } catch (error) {
      console.error(`Error exporting ${table}:`, error.message);
      exportData.tables[table] = [];
    }
  }

  // Write JSON output
  await writeFile(outputFile, JSON.stringify(exportData, null, 2));
  console.log(`\nExport complete. Data written to ${outputFile}`);

  // Print summary
  console.log('\nSummary:');
  for (const [table, rows] of Object.entries(exportData.tables)) {
    console.log(`  ${table}: ${rows.length} rows`);
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
