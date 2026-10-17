import { cp, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export async function build({ sourceDir = projectRoot, env = process.env, demo = false } = {}) {
  const root = await realpath(sourceDir);
  const context = { window: {}, URL };
  vm.runInNewContext(await readFile(path.join(root, 'data.js'), 'utf8'), context);
  const config = demo ? {} : {
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY
  };
  const connection = context.window.MoriiData.validateConfig(config);
  if (!demo && !connection) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building. Use npm run build:demo for an offline catalog.');

  const output = path.resolve(root, 'dist');
  // Only ever clear this checkout's literal dist directory, never a linked path.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unsafe output directory.');
  const existing = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing?.isSymbolicLink()) throw new Error('dist must not be a symbolic link.');
  await rm(output, { recursive: true, force: true });
  await mkdir(output);
  for (const file of ['styles.css', 'app.js', 'data.js', 'assets']) {
    await cp(path.join(root, file), path.join(output, file), { recursive: true });
  }
  let html = await readFile(path.join(root, 'index.html'), 'utf8');
  if (demo) await cp(path.join(root, 'content.js'), path.join(output, 'content.js'));
  else html = html.replace(/\s*<script src="content\.js" defer><\/script>/, '');
  await writeFile(path.join(output, 'index.html'), html);
  await writeFile(path.join(output, 'config.js'), `window.MORII_CONFIG = ${JSON.stringify(config)};\n`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const output = await build({ demo: process.argv.includes('--demo') });
    console.log(`Built ${process.argv.includes('--demo') ? 'demo' : 'Supabase'} website: ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
