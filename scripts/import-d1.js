#!/usr/bin/env node
/**
 * D1 Import Script
 *
 * Imports JSON data (from migrate-neon-to-d1.js) into Cloudflare D1
 *
 * Usage:
 *   wrangler d1 execute promptforge-db --local --file=workers/d1/schema.sql
 *   node scripts/import-d1.js --input <json-file> [--remote]
 */

import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Parse command line args
const args = process.argv.slice(2);
const inputFile = args[args.indexOf('--input') + 1];
const isRemote = args.includes('--remote');

if (!inputFile) {
  console.error('Usage: node scripts/import-d1.js --input <json-file> [--remote]');
  process.exit(1);
}

const WRANGLER_FLAGS = isRemote ? ['--remote'] : ['--local'];

async function runSql(dbName, sql) {
  const cmd = `wrangler d1 execute ${dbName} ${WRANGLER_FLAGS.join(' ')} --file=-`;
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      input: sql,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return { stdout, stderr };
  } catch (error) {
    throw new Error(`${error.message}\n${error.stderr || ''}`);
  }
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function transformTimestamp(value) {
  if (!value) return null;
  // Postgres timestamp → Unix epoch (seconds)
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function transformUuid(value) {
  // UUIDs are compatible between Postgres and SQLite
  return value;
}

function transformJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

async function importTable(dbName, tableName, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  Skipping ${tableName} (no data)`);
    return;
  }

  console.log(`Importing ${rows.length} rows into ${tableName}...`);

  // Get columns from first row
  const columns = Object.keys(rows[0]);

  // Batch inserts (100 rows at a time)
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row => {
      return columns.map(col => {
        let value = row[col];

        // Transform based on column type
        if (col.endsWith('_at')) {
          value = transformTimestamp(value);
        } else if (col === 'id' || col.endsWith('_id')) {
          value = transformUuid(value);
        } else if (col === 'config' || col.endsWith('_config') || col === 'tags' || col === 'remix_diff' || col === 'public_config') {
          value = transformJson(value);
          if (value !== null && typeof value === 'object') {
            value = JSON.stringify(value);
          }
        }

        return escapeSql(value);
      });
    });

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values.map(v => `(${v.join(', ')})`).join(',')}`;

    try {
      await runSql(dbName, sql);
      console.log(`  Imported rows ${i + 1} - ${Math.min(i + batchSize, rows.length)}`);
    } catch (error) {
      console.error(`  Error inserting batch: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  console.log('Starting D1 import...\n');

  // Read export data
  const data = await readFile(inputFile, 'utf-8');
  const exportData = JSON.parse(data);

  console.log(`Loaded export from ${exportData.exportedAt}\n`);

  const dbName = 'promptforge-db';

  // Import tables in order (respecting foreign keys)
  const importOrder = [
    'users', // Must come first (referenced by others)
    'profiles',
    'drafts',
    'saved_prompts',
    'community_posts',
    'community_votes',
    'community_comments',
    'prompt_versions',
  ];

  // Special handling: profiles data becomes users
  if (exportData.tables.profiles && exportData.tables.profiles.length > 0) {
    console.log('Creating users from profiles...');

    const users = exportData.tables.profiles.map((p, i) => ({
      id: p.id,
      email: `user_${i}@migrated.local`, // Placeholder email
      password_hash: '', // Empty - users need to reset password
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      email_verified: 0,
      created_at: transformTimestamp(p.created_at),
      updated_at: transformTimestamp(p.updated_at),
    }));

    exportData.tables.users = users;
  }

  for (const tableName of importOrder) {
    try {
      await importTable(dbName, tableName, exportData.tables[tableName]);
    } catch (error) {
      console.error(`Failed to import ${tableName}:`, error.message);
      console.log('Continuing with next table...\n');
    }
  }

  console.log('\nImport complete!');
  console.log('\nPost-import steps:');
  console.log('1. Run password reset flow for migrated users');
  console.log('2. Verify row counts match source');
  console.log('3. Test authentication flows');
}

main().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
