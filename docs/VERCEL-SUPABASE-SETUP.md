# Set up morii on Vercel with Supabase

## 1. Create the Supabase project

1. Sign in at [Supabase Dashboard](https://supabase.com/dashboard).
2. Choose **New project**, select an organization, and name the project, for example `morii`.
3. Set a database password and save it privately. The website does not use this password.
4. Select a region appropriate for your visitors, create the project, and wait for provisioning to finish.

Vercel will serve the website and existing image files. Supabase stores shop links, camera descriptions, and photo metadata. LINE and Canva remain the booking and availability tools. Supabase Dashboard is the owner interface for catalog editing; no customer login or website admin panel is required.

## 2. Create tables and import the catalog

1. In **SQL Editor**, start a new query and paste the full contents of `supabase/migrations/202610170001_catalog.sql`. Run it **once** in the new project. It creates three tables, indexes, grants, and Row Level Security (RLS) policies in one transaction.
2. Start another query, paste the full contents of `supabase/seed.sql`, and run it. It imports all 9 camera models, 239 photos, and the current shop links. Repeating the seed skips existing IDs and preserves owner edits.
3. Confirm the import:

```sql
select 'settings' as collection, count(*) from public.morii_settings
union all
select 'cameras', count(*) from public.morii_cameras
union all
select 'photos', count(*) from public.morii_photos;
```

Expected initial counts: **settings = 1, cameras = 9, photos = 239**.

4. Run `supabase/verify.sql` in SQL Editor. It creates test rows, checks reads and blocked writes as both the `anon` and `authenticated` roles, and rolls back. Successful completion confirms that published content is readable and draft models/photos are hidden. The final `ROLLBACK` removes all test records. If a check fails, run `ROLLBACK;` before investigating.
5. Open **Table Editor** and confirm RLS is enabled on all three `morii_` tables. Keep RLS enabled. Visitors have read access only; editing happens through the owner dashboard.

This SQL Editor workflow is for initial manual setup. If you later adopt Supabase CLI migrations, reconcile this already-applied migration with CLI history before using `db push`; do not blindly replay it.

## 3. Get the public connection values

1. Open the project's **Connect** dialog and copy its URL, for example `https://abcdefgh.supabase.co`.
2. Copy the **publishable key**, starting with `sb_publishable_`. Keys can also be managed under **Settings → API Keys**.
3. Use the project origin, rather than a Postgres connection string, dashboard URL, or `/rest/v1` URL.

The browser uses the publishable key to read Supabase's REST API. The key is public by design; grants and RLS enforce access. No secret key, service-role key, or DB password is needed. The build rejects privileged keys and requires the current publishable-key format. Supabase Auth redirect URLs are not needed because the site has no customer login.

Official references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Put the updated source in GitHub

1. Create a GitHub repository if you do not have one for this website.
2. Use GitHub Desktop or Git to commit and push this updated source folder. If it is already connected to the intended repository, commit and push the changes there.
3. Include `assets/`, `scripts/`, `supabase/`, `package.json`, `package-lock.json`, and `vercel.json`, as well as the HTML/CSS/JS files. Vercel needs the build scripts.
4. Keep `.env.local` out of Git. The supplied `.gitignore` also excludes `dist/`, `.vercel/`, and `node_modules/`.

## 5. Import into Vercel

1. Sign in at [Vercel](https://vercel.com/new) and import your GitHub repository. Grant access to that repository if requested.
2. Set **Root Directory** to the folder containing this project's `package.json`. Keep the default if the files are at the repository root.
3. Select **Other** as the framework preset.
4. Check the build settings. `vercel.json` already declares them; remove old dashboard overrides if they conflict.

   | Setting | Value |
   | --- | --- |
   | Framework | Other |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | Default / automatic from package lock |
   | Node.js | 22.x or newer |

5. Before the first deployment, add these **Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your HTTPS Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key |

6. Apply both to **Production** and **Preview**. Add **Development** too if you plan to pull them using Vercel CLI. You can use a separate Supabase test project for preview deployments.
7. Click **Deploy**, wait for completion, and open the HTTPS URL Vercel provides.

Official references: [build settings](https://vercel.com/docs/builds/configure-a-build), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json), [environment variables](https://vercel.com/docs/environment-variables).

## 6. Check the deployed website

1. Open the site on desktop and mobile; the catalog should show 9 models after loading.
2. Search for `930` and switch between IXY and IXUS filters.
3. Open camera details, view thumbnails, and open a full image. Check next/previous controls.
4. Open a copied camera URL such as `https://YOUR-SITE.vercel.app/#camera=ixy-930` in another tab. Its details should open after loading.
5. Test LINE links, booking text copying, and the Canva queue. Canva sharing permissions remain controlled in Canva.
6. Edit a camera's `note` in Supabase Table Editor, save, and refresh the website. It should change without a Vercel deployment.
7. Set its `is_published` to `false` and refresh. The camera and its photo metadata should disappear. Restore it to `true` afterward.

If Supabase is unavailable, a Thai error message and retry button appear. The shop contact links remain usable. Production never substitutes the old bundled catalog for failed or empty database results.

## 7. Manage shop links, cameras, and photos

### `morii_settings`

Keep the single row with `id = true`.

| Column | Meaning |
| --- | --- |
| `name` | Stored shop name; the visual logo/page title remain in HTML |
| `contacts` | JSON object with `rentLine`, `buyLine`, `tiktok`, `instagram`, `x`; use HTTPS URLs |
| `queue` | JSON object; keep `linkType: "view"` and an HTTPS `url` on `canva.com` or `canva.link` |
| `album_url` | Shop's full photo album HTTPS URL |
| `preview` | Existing draft-banner visibility; normally `false` |

Example contact object:

```json
{
  "rentLine": "https://lin.ee/YOUR-RENT-LINK",
  "buyLine": "https://lin.ee/YOUR-BUY-LINK",
  "tiktok": "https://www.tiktok.com/@YOUR-ACCOUNT",
  "instagram": "https://www.instagram.com/YOUR-ACCOUNT",
  "x": "https://x.com/YOUR-ACCOUNT"
}
```

If you change contact or queue links, update the matching fallback links in `index.html` and push the code too, so the loading/error and JavaScript-disabled states use the same destinations.

### `morii_cameras`

| Column | Meaning |
| --- | --- |
| `id` | Stable lowercase ID such as `ixy-930`; keep existing IDs for shared links |
| `name` | Display name |
| `family` | `IXY` or `IXUS`, matching the current filters |
| `image` | Existing `assets/...` path or public HTTPS camera image URL |
| `color` | Six-digit hex color such as `#ede6ee` |
| `note` | Card and detail description |
| `source` | Attribution URL retained as metadata |
| `album_url` | Optional model-specific album URL; empty uses the shop album |
| `sort_order` | Smaller numbers appear first; IDs break ties |
| `is_published` | `true` shows the model; `false` hides it |

Use **Insert row** to add a model. For a new camera family beyond IXY/IXUS, update both the schema constraint and website filter buttons.

### `morii_photos`

| Column | Meaning |
| --- | --- |
| `id` | Unique stable text ID, e.g. `ixy-930-review-20261017-01` |
| `camera_id` | Exact parent camera ID |
| `kind` | `samples` or `reviews`; reviews enable the customer-review tab |
| `src` | Existing asset path or public HTTPS image URL |
| `thumbnail` | Thumbnail path/URL; empty uses `src` |
| `alt` | Accessible image description |
| `caption` | Label below the thumbnail |
| `credit` | Optional lightbox credit |
| `sort_order` | Order within the gallery, starting at 0 |
| `is_published` | `false` hides the photo metadata |

No initial Storage bucket or image migration is needed: existing images are served from `assets/` on Vercel. Catalog updates appear on refresh; this is not a Realtime subscription. If a future gallery exceeds Supabase's configured API response limit, implement pagination before expanding beyond it. The included catalog fits the default limits.

### Optional: use Supabase Storage for new images

1. Open **Storage** in Supabase Dashboard.
2. Create a **public** bucket such as `morii-gallery` for public website images.
3. Upload the photo through the dashboard and copy its **public URL**.
4. Add a `morii_photos` row with this URL in `src`; optionally upload a smaller thumbnail for `thumbnail`.
5. Refresh the website to check it. No Vercel deployment is needed for these new database rows and Storage images.

There is no public upload permission or upload UI. Dashboard uploads are owner operations; do not add anonymous write/upload policies. Existing Vercel assets and public Storage files remain public if their URLs are known, even when a database record is unpublished. Publication flags hide catalog records, not already-public image files.

Reference: [public asset URLs](https://supabase.com/docs/guides/storage/serving/downloads).

## 8. Connect your domain (optional)

1. Open **Vercel → Project → Settings → Domains** and add the domain you own.
2. At the domain provider, add the DNS records Vercel displays for this project.
3. Wait for Vercel to confirm DNS and HTTPS, then test your domain.
4. Optionally add `<meta property="og:url" content="https://YOUR-DOMAIN">` to `index.html` and push the code.

Camera links use URL hashes, so no SPA rewrite rule is required. Supabase Auth domain settings are not needed for this read-only catalog.

## 9. Local preview

Install Node.js 22.x or newer. Open PowerShell in this source folder:

```powershell
npm ci
Copy-Item .env.example .env.local
```

Fill in `.env.local` with your two public Supabase values, then:

```powershell
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:8080`. Stop the server with Ctrl+C. Rebuild after local code or environment changes. No third-party runtime dependencies are required.

For the original catalog without connecting to Supabase:

```powershell
npm run build:demo
npm run preview
```

Production uses `npm run build`, requiring both environment variables. Only these two public values are written into `dist/config.js`. SQL, `.env.local`, tests, guides, and the bundled original catalog are excluded from production `dist/`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Build asks for Supabase variables | Add both exact names for the deployment environment, then redeploy |
| Build rejects the key | Use `sb_publishable_...`, not a secret/service-role/legacy JWT key or DB password |
| Vercel shows 404 | Check Root Directory, Build Command, and Output Directory; remove old dashboard overrides |
| Retry message / API 401 or 403 | Check matching project URL/key, project availability, tables, grants, and RLS policies |
| Missing-settings console error | Run `seed.sql`; the single settings row must exist |
| API 404 / table missing | Run the schema in the configured project; keep `public` available through the Data API |
| Empty catalog without an error | Check `is_published` and read policies |
| Changed env values have no effect | Redeploy Vercel; these values are embedded at build time |
| Editing `content.js` has no live effect | Production reads Supabase; edit the tables |
| Placeholder image | Check exact filename/case, URL, public bucket access, and file existence |
| Canva requires sign-in | Adjust sharing permissions in Canva |

Run `supabase/verify.sql` after policy changes. Do not disable RLS or use a privileged key to work around permission errors. The catalog tables contain public marketing content only. Customer details, payments, and private booking records need a separate authenticated design.
