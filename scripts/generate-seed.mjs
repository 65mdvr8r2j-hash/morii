import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const context = { window: {} };
vm.runInNewContext(await readFile(new URL('content.js', root), 'utf8'), context);
const data = context.window.MORII;
// Escape SQL strings, including backslashes independently of session settings.
const sql = value => `E'${String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
const cameras = data.cameras.map((camera, index) => ({
  id: camera.id, name: camera.name, family: camera.family, image: camera.image,
  color: camera.color, note: camera.note, source: camera.source || '',
  album_url: camera.albumUrl || '', sort_order: index
}));
const photos = data.cameras.flatMap(camera => ['samples', 'reviews'].flatMap(kind =>
  (camera[kind] || []).map((photo, index) => ({
    id: `${camera.id}-${kind}-${index + 1}`, camera_id: camera.id, kind,
    src: photo.src, thumbnail: photo.thumbnail || '', alt: photo.alt || '',
    caption: photo.caption || '', credit: photo.credit || '', sort_order: index
  }))));
function insert(table, rows) {
  const columns = Object.keys(rows[0]);
  return `insert into public.${table} (${columns.join(', ')}) values\n${rows.map(row =>
    `(${columns.map(key => typeof row[key] === 'number' ? row[key] : sql(row[key])).join(', ')})`
  ).join(',\n')}\non conflict (id) do nothing;\n`;
}
const result = `-- Generated from content.js by npm run seed:generate.\n-- Safe to repeat: existing rows are preserved, never overwritten.\n-- After setup, edit Supabase tables; this is only the initial catalog import.\nbegin;\n\n` +
  `insert into public.morii_settings (id, name, preview, contacts, queue, album_url) values\n` +
  `(true, ${sql(data.name)}, ${Boolean(data.preview)}, ${sql(JSON.stringify(data.contacts))}::jsonb, ${sql(JSON.stringify(data.queue))}::jsonb, ${sql(data.albumUrl)})\non conflict (id) do nothing;\n\n` +
  insert('morii_cameras', cameras) + '\n' + insert('morii_photos', photos) + '\ncommit;\n';
await writeFile(new URL('supabase/seed.sql', root), result);
console.log(`Generated supabase/seed.sql: ${cameras.length} cameras, ${photos.length} photos.`);
