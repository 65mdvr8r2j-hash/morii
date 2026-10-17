# morii — Vercel + Supabase

The Thai camera website now supports **Vercel hosting** and a **Supabase database**. The design, LINE booking flow, Canva queue, search, filters, galleries, and camera share links are preserved.

Supabase stores shop links, camera descriptions, publication flags, and photo metadata. The initial import contains **9 cameras and 239 photos**. Vercel serves the existing image files; new images can also use public HTTPS URLs from Supabase Storage. Visitors can read published content. The owner edits content through Supabase Dashboard.

## Set up step by step

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run [the schema](supabase/migrations/202610170001_catalog.sql) once, then [the initial data import](supabase/seed.sql).
3. Open **Connect** to copy the project URL and **publishable key** (`sb_publishable_...`). Keys are also under **Settings → API Keys**. The website does not use a database password, secret key, or service-role key.
4. Push this updated source folder to GitHub, including `package.json`, `package-lock.json`, `vercel.json`, `scripts/`, and `supabase/`. Do not upload just the old HTML files.
5. In [Vercel](https://vercel.com/new), import the repository. Choose **Other** as the framework and the folder containing `package.json` as the root. `vercel.json` sets **Build Command: `npm run build`** and **Output Directory: `dist`**. Use Node.js 22.x or newer.
6. Before deploying, add these environment variables to **Production** and **Preview**:

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key |

7. Click **Deploy**. Open the resulting URL and test the catalog, camera details, galleries, LINE links, and Canva queue.
8. Edit catalog rows in **Supabase → Table Editor**, save, and refresh the website. Catalog changes do not require redeployment; code and environment variable changes do.

See [the full setup and troubleshooting guide](docs/VERCEL-SUPABASE-SETUP.md) for permission checks, photo uploads, custom domains, and local previews.

## Local development

Install Node.js 22.x or newer, then run in PowerShell:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Edit `.env.local` with the two public Supabase values, then:

```powershell
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:8080`. There are no third-party runtime dependencies.

To preview the original bundled catalog without Supabase:

```powershell
npm run build:demo
npm run preview
```

Opening the source `index.html` directly also uses the bundled catalog. Production builds require Supabase configuration and exclude `content.js`, SQL, guides, and environment files from the published directory. If the database is unavailable, visitors see a retry message and can still use the shop's contact links.

## Files

| File / folder | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Thai website layout, design, and interactions |
| `data.js` | Loads published settings, cameras, and galleries from Supabase REST API |
| `config.js` | Source-preview config; generated from public environment variables during builds |
| `content.js` | Original catalog for demo mode and generating the initial import |
| `assets/` | Camera pictures, sample images, thumbnails, and icons |
| `scripts/build.mjs` | Validates config and builds the public `dist/` directory |
| `vercel.json` | Build settings and response headers |
| `supabase/migrations/` | Schema, grants, and Row Level Security policies |
| `supabase/seed.sql` | Initial 9-camera / 239-photo import; repeat runs preserve existing rows |
| `supabase/verify.sql` | Transactional check of publication rules and blocked visitor writes |
| `docs/` | Setup guide and original image attribution |

After setup, edit Supabase tables for live catalog changes. `npm run seed:generate` regenerates the initial SQL from `content.js`; it does not update a live database or overwrite existing rows.

This change does not add customer accounts, a website admin panel, online booking records, or payments. Bookings remain through LINE and availability remains in Canva. Database tables hold public marketing content only.
