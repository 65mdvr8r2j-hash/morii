-- Run in Supabase SQL Editor after schema + seed. All test records roll back.
begin;

insert into public.morii_cameras (id, name, family, is_published) values
('morii-rls-visible-test', 'RLS visible test', 'IXY', true),
('morii-rls-hidden-test', 'RLS hidden test', 'IXY', false);
insert into public.morii_photos (id, camera_id, kind, src, is_published) values
('morii-rls-visible-photo', 'morii-rls-visible-test', 'samples', 'test.webp', true),
('morii-rls-hidden-photo', 'morii-rls-visible-test', 'samples', 'test.webp', false),
('morii-rls-hidden-parent-photo', 'morii-rls-hidden-test', 'samples', 'test.webp', true);

set local role anon;
do $$
begin
  if (select count(*) from public.morii_settings) <> 1 then raise exception 'Shop settings not readable'; end if;
  if (select count(*) from public.morii_cameras where id = 'morii-rls-visible-test') <> 1 then raise exception 'Published camera not readable'; end if;
  if exists (select 1 from public.morii_cameras where id = 'morii-rls-hidden-test') then raise exception 'Draft camera exposed'; end if;
  if (select count(*) from public.morii_photos where id like 'morii-rls-%') <> 1 then raise exception 'Photo publication policy failed'; end if;
  if not exists (select 1 from public.morii_photos where id = 'morii-rls-visible-photo') then raise exception 'Published photo not readable'; end if;
  if has_table_privilege(current_user, 'public.morii_settings', 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege(current_user, 'public.morii_cameras', 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege(current_user, 'public.morii_photos', 'INSERT,UPDATE,DELETE,TRUNCATE')
  then raise exception 'Visitor write privileges must be revoked'; end if;
  begin
    update public.morii_cameras set name = 'Unauthorized update' where id = 'morii-rls-visible-test';
    raise exception 'Anonymous update was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
do $$
begin
  if (select count(*) from public.morii_settings) <> 1 then raise exception 'Shop settings not readable'; end if;
  if (select count(*) from public.morii_cameras where id = 'morii-rls-visible-test') <> 1 then raise exception 'Published camera not readable'; end if;
  if exists (select 1 from public.morii_cameras where id = 'morii-rls-hidden-test') then raise exception 'Draft camera exposed'; end if;
  if (select count(*) from public.morii_photos where id like 'morii-rls-%') <> 1 then raise exception 'Photo publication policy failed'; end if;
  if not exists (select 1 from public.morii_photos where id = 'morii-rls-visible-photo') then raise exception 'Published photo not readable'; end if;
  if has_table_privilege(current_user, 'public.morii_settings', 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege(current_user, 'public.morii_cameras', 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege(current_user, 'public.morii_photos', 'INSERT,UPDATE,DELETE,TRUNCATE')
  then raise exception 'Visitor write privileges must be revoked'; end if;
  begin
    update public.morii_cameras set name = 'Unauthorized update' where id = 'morii-rls-visible-test';
    raise exception 'Authenticated visitor update was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
