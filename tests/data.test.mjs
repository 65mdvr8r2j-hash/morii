import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../data.js', import.meta.url), 'utf8');
const config = { supabaseUrl: 'https://test.supabase.co', supabasePublishableKey: 'sb_publishable_test' };
function client(fetch) {
  const context = { window: {}, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch };
  vm.runInNewContext(script, context);
  return context.window.MoriiData;
}
const json = value => JSON.parse(JSON.stringify(value));

test('demo uses bundled catalog without network requests', async () => {
  const fallback = { cameras: [{ id: 'ixy-930' }] };
  assert.equal(await client(() => assert.fail('Unexpected request')).load({}, fallback), fallback);
});

test('rejects partial configuration, non-HTTPS URLs, and privileged keys', () => {
  const { validateConfig } = client();
  for (const invalid of [
    { supabaseUrl: config.supabaseUrl },
    { ...config, supabaseUrl: 'http://test.supabase.co' },
    { ...config, supabaseUrl: 'https://test.supabase.co/rest/v1' },
    { ...config, supabaseUrl: 'https://user:pass@test.supabase.co' },
    { ...config, supabasePublishableKey: 'sb_secret_example' },
    { ...config, supabasePublishableKey: 'eyJhbGciOiJIUzI1NiJ9.legacy.signature' }
  ]) assert.throws(() => validateConfig(invalid));
});

test('loads settings and nested photos using the public key, preserving an intentionally empty gallery', async () => {
  const requests = [];
  const api = client(async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, json: async () => url.includes('morii_settings') ? [{
      name: 'morii', contacts: { rentLine: 'https://lin.ee/test' }, queue: { linkType: 'view' }, album_url: 'https://example.com/album'
    }] : [{ id: 'ixy-930', name: 'New title', album_url: 'https://example.com/model', morii_photos: [
      { kind: 'samples', src: 'sample.webp' }, { kind: 'reviews', src: 'review.webp' }
    ] }, { id: 'ixy-920', morii_photos: [] }] };
  });
  const data = json(await api.load(config));
  assert.equal(data.albumUrl, 'https://example.com/album');
  assert.equal(data.contacts.rentLine, 'https://lin.ee/test');
  assert.equal(data.cameras[0].name, 'New title');
  assert.equal(data.cameras[0].albumUrl, 'https://example.com/model');
  assert.deepEqual(data.cameras[0].samples, [{ kind: 'samples', src: 'sample.webp' }]);
  assert.deepEqual(data.cameras[0].reviews, [{ kind: 'reviews', src: 'review.webp' }]);
  assert.deepEqual(data.cameras[1].samples, []);
  assert.equal(requests.length, 2);
  for (const { options } of requests) {
    assert.equal(options.headers.apikey, config.supabasePublishableKey);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.cache, 'no-store');
  }
  const cameras = requests.find(request => request.url.pathname.endsWith('morii_cameras'));
  assert.equal(cameras.url.searchParams.get('is_published'), 'eq.true');
  assert.equal(cameras.url.searchParams.get('morii_photos.order'), 'sort_order.asc,id.asc');
});

test('an empty database catalog stays empty instead of restoring removed cameras', async () => {
  const api = client(async url => ({ ok: true, json: async () => url.includes('morii_settings') ? [{ name: 'morii' }] : [] }));
  assert.deepEqual(json((await api.load(config, { cameras: ['old'] })).cameras), []);
});

test('network failures, denied requests, and missing settings never reveal bundled catalog entries', async () => {
  for (const fetch of [
    async () => { throw new Error('Offline'); },
    async () => ({ ok: false, status: 403 }),
    async () => ({ ok: true, json: async () => [] }),
    async () => ({ ok: true, json: async () => ({ error: 'bad response' }) })
  ]) await assert.rejects(() => client(fetch).load(config, { cameras: ['private old data'] }));
});

test('a hung request is aborted with a visible error path', async () => {
  const context = {
    window: {}, URL, URLSearchParams, AbortController,
    setTimeout: callback => setTimeout(callback, 5), clearTimeout,
    fetch: (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Timed out')), { once: true });
    })
  };
  vm.runInNewContext(script, context);
  await assert.rejects(() => context.window.MoriiData.load(config), /Timed out/);
});
