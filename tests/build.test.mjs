import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from '../scripts/build.mjs';

test('deployment includes only public files, never SQL, env files, or bundled fallback catalog', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'morii-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of ['index.html', 'data.js', 'app.js', 'styles.css', 'content.js']) {
    await cp(new URL(`../${file}`, import.meta.url), path.join(root, file));
  }
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'assets', 'test.svg'), '<svg/>');
  await writeFile(path.join(root, '.env.local'), 'SUPABASE_SECRET_KEY=do-not-publish');
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: 'sb_secret_do_not_publish' };
  const output = await build({ sourceDir: root, env });
  assert.deepEqual((await readdir(output)).sort(), ['app.js', 'assets', 'config.js', 'data.js', 'index.html', 'styles.css']);
  assert.doesNotMatch(await readFile(path.join(output, 'index.html'), 'utf8'), /src="content.js"/);
  const config = await readFile(path.join(output, 'config.js'), 'utf8');
  assert.match(config, /sb_publishable_test/);
  assert.doesNotMatch(config, /secret|do-not-publish/);
  // A second build must remove stale files, including the demo fallback.
  await build({ sourceDir: root, demo: true });
  assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /src="content.js"/);
  await build({ sourceDir: root, env });
  assert.equal((await readdir(output)).includes('content.js'), false);
  await assert.rejects(() => build({ sourceDir: root, env: {} }), /Set SUPABASE_URL/);
  await assert.rejects(() => build({ sourceDir: root, env: { ...env, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_SECRET_KEY } }), /publishable/);
});
