begin;

alter table if exists public.p101_actor_pages
  add column if not exists background text;

alter table if exists public.p101_actor_pages
  drop constraint if exists p101_actor_pages_background_check;

alter table if exists public.p101_actor_pages
  add constraint p101_actor_pages_background_check
    check (background is null or background ~ '^#[0-9A-Fa-f]{6}$');

alter table if exists pages101.actor_pages
  add column if not exists background text;

alter table if exists pages101.actor_pages
  drop constraint if exists actor_pages_background_check;

alter table if exists pages101.actor_pages
  add constraint actor_pages_background_check
    check (background is null or background ~ '^#[0-9A-Fa-f]{6}$');

select pg_notify('pgrst', 'reload schema');

commit;
