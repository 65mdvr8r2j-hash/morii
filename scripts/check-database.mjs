// Optional local PostgreSQL validation. Supply an installed PGlite module path:
// node scripts/check-database.mjs C:/path/to/@electric-sql/pglite/dist/index.js
// PGlite is a test tool only, not a website dependency.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

if (!process.argv[2]) throw new Error('Supply the absolute path to the PGlite module to run database validation.');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
try {
  // Supabase provides these roles. Recreate them only in this isolated test DB.
  await db.exec('create role anon; create role authenticated;');
  await db.exec(await readFile(new URL('../supabase/migrations/202610170001_catalog.sql', import.meta.url), 'utf8'));
  const seed = await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  await db.exec(seed);
  await db.exec("update public.morii_cameras set note = 'Owner edit' where id = 'ixy-930'");
  await db.exec(seed);
  assert.equal((await db.query("select note from public.morii_cameras where id = 'ixy-930'")).rows[0].note, 'Owner edit');
  assert.equal(Number((await db.query('select count(*) from public.morii_cameras')).rows[0].count), 9);
  assert.equal(Number((await db.query('select count(*) from public.morii_photos')).rows[0].count), 239);
  await db.exec(await readFile(new URL('../supabase/verify.sql', import.meta.url), 'utf8'));
  assert.equal(Number((await db.query('select count(*) from public.morii_cameras')).rows[0].count), 9);
  assert.equal(Number((await db.query('select count(*) from public.morii_photos')).rows[0].count), 239);
  console.log('Database validation passed: schema, 9 cameras, 239 photos, repeat-safe seed, both visitor roles, draft filtering, blocked writes, and verification rollback.');
} finally {
  await db.close();
}
