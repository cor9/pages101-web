begin;

alter table public.p101_actor_pages
  add column if not exists background text;

alter table public.p101_actor_pages
  drop constraint if exists p101_actor_pages_background_check;

alter table public.p101_actor_pages
  add constraint p101_actor_pages_background_check
    check (background is null or background ~ '^#[0-9A-Fa-f]{6}$');

commit;
