(() => {
  'use strict';

  function validateConfig(config = {}) {
    const url = String(config.supabaseUrl || '').trim();
    const key = String(config.supabasePublishableKey || '').trim();
    if (!url && !key) return null;
    if (!url || !key) throw new Error('Set both Supabase environment variables.');
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('Invalid Supabase URL.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('Supabase URL must be an HTTPS project origin.');
    }
    // Do not allow a privileged key to be bundled into the public website.
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error('Use a Supabase publishable key (sb_publishable_...), never a secret or service-role key.');
    }
    return { url: parsed.origin, key };
  }

  async function load(config, fallback) {
    const connection = validateConfig(config);
    if (!connection) {
      if (!fallback) throw new Error('Supabase is not configured.');
      return fallback;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    async function read(table, params) {
      const response = await fetch(`${connection.url}/rest/v1/${table}?${new URLSearchParams(params)}`, {
        headers: { apikey: connection.key, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Supabase catalog request failed (${response.status}).`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid Supabase catalog response.');
      return rows;
    }
    try {
      const [settings, cameras] = await Promise.all([
        read('morii_settings', { select: 'name,preview,contacts,queue,album_url', id: 'eq.true', limit: '1' }),
        read('morii_cameras', {
          select: 'id,name,family,image,color,note,source,album_url,morii_photos(id,kind,src,thumbnail,alt,caption,credit,sort_order)',
          is_published: 'eq.true',
          order: 'sort_order.asc,id.asc',
          'morii_photos.order': 'sort_order.asc,id.asc'
        })
      ]);
      if (settings.length !== 1) throw new Error('Shop settings are missing. Run the Supabase seed SQL.');
      const shop = settings[0];
      return {
        name: shop.name,
        preview: shop.preview,
        contacts: shop.contacts || {},
        queue: shop.queue || {},
        albumUrl: shop.album_url,
        cameras: cameras.map(camera => ({
          ...camera,
          albumUrl: camera.album_url,
          samples: (camera.morii_photos || []).filter(photo => photo.kind === 'samples'),
          reviews: (camera.morii_photos || []).filter(photo => photo.kind === 'reviews')
        }))
      };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  window.MoriiData = { load, validateConfig };
})();
