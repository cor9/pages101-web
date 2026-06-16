begin;

create table if not exists public.p101_custom_domains (
  domain     text primary key,
  page_id    uuid not null references public.p101_actor_pages(id) on delete cascade,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists p101_custom_domains_page_idx
  on public.p101_custom_domains (page_id);

alter table public.p101_custom_domains
  drop constraint if exists p101_custom_domains_domain_check;

alter table public.p101_custom_domains
  add constraint p101_custom_domains_domain_check
    check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');

alter table public.p101_custom_domains enable row level security;

drop policy if exists "owner read own custom domains" on public.p101_custom_domains;
drop policy if exists "owner manage own custom domains" on public.p101_custom_domains;

create policy "owner read own custom domains"
  on public.p101_custom_domains
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.p101_actor_pages
      where p101_actor_pages.id = p101_custom_domains.page_id
        and p101_actor_pages.user_id = auth.uid()
    )
  );

create policy "owner manage own custom domains"
  on public.p101_custom_domains
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.p101_actor_pages
      where p101_actor_pages.id = p101_custom_domains.page_id
        and p101_actor_pages.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.p101_actor_pages
      where p101_actor_pages.id = p101_custom_domains.page_id
        and p101_actor_pages.user_id = auth.uid()
    )
  );

commit;
