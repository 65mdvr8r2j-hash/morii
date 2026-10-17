-- Run once in a new Supabase project's SQL Editor. No customer data belongs in these tables.
begin;

create table public.morii_settings (
  id boolean primary key default true check (id = true),
  name text not null default 'morii',
  preview boolean not null default false,
  contacts jsonb not null default '{}'::jsonb check (jsonb_typeof(contacts) = 'object'),
  queue jsonb not null default '{}'::jsonb check (jsonb_typeof(queue) = 'object'),
  album_url text not null default ''
);

create table public.morii_cameras (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  family text not null check (family in ('IXY', 'IXUS')),
  image text not null default 'assets/camera-placeholder.svg',
  color text not null default '#ede6ee' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  note text not null default '',
  source text not null default '',
  album_url text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true
);

create table public.morii_photos (
  id text primary key,
  camera_id text not null references public.morii_cameras(id) on delete cascade,
  kind text not null check (kind in ('samples', 'reviews')),
  src text not null,
  thumbnail text not null default '',
  alt text not null default '',
  caption text not null default '',
  credit text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true
);
create index morii_photos_camera_sort_idx on public.morii_photos(camera_id, sort_order, id);

alter table public.morii_settings enable row level security;
alter table public.morii_cameras enable row level security;
alter table public.morii_photos enable row level security;

-- Visitors (including signed-in users) can only read published catalog data.
-- Editing is done by the owner in Supabase Dashboard; no public write policies.
revoke all on public.morii_settings, public.morii_cameras, public.morii_photos from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.morii_settings, public.morii_cameras, public.morii_photos to anon, authenticated;

create policy "Public shop settings" on public.morii_settings for select to anon, authenticated using (true);
create policy "Published cameras" on public.morii_cameras for select to anon, authenticated using (is_published);
create policy "Published photos of published cameras" on public.morii_photos for select to anon, authenticated
  using (is_published and exists (
    select 1 from public.morii_cameras c where c.id = camera_id and c.is_published
  ));

commit;
