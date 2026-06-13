begin;

-- Bring the checked-in migration state in line with the production schema that
-- was run manually in Supabase, while keeping app-compatible font_pair values.

create schema if not exists pages101;

create table if not exists pages101.reserved_slugs (
  slug text primary key
);

insert into pages101.reserved_slugs (slug) values
  ('admin'),('administrator'),('www'),('app'),('api'),('mail'),('email'),
  ('pages'),('page'),('login'),('logout'),('signup'),('signin'),('register'),
  ('dashboard'),('account'),('settings'),('billing'),('stripe'),('checkout'),
  ('help'),('support'),('contact'),('abuse'),('security'),('legal'),('privacy'),
  ('terms'),('assets'),('static'),('cdn'),('img'),('media'),('files'),
  ('test'),('demo'),('staging'),('dev'),('root'),('status'),('blog'),
  ('store'),('shop'),('news'),('about'),('home'),('index'),
  ('childactor101'),('ca101'),('prep101'),('resume101'),('pages101'),
  ('vault'),('official'),('verify'),('verified')
on conflict do nothing;

create index if not exists actor_pages_user_id_idx
  on pages101.actor_pages (user_id);

create index if not exists page_sections_page_idx
  on pages101.page_sections (page_id, sort_order);

create index if not exists custom_domains_page_idx
  on pages101.custom_domains (page_id);

create index if not exists relay_messages_page_idx
  on pages101.relay_messages (page_id, created_at desc);

update pages101.actor_pages
set font_pair = case font_pair
  when 'fraunces' then 'fraunces-inter'
  when 'cormorant' then 'cormorant-inter'
  when 'bricolage' then 'bricolage-inter'
  when 'outfit' then 'outfit-inter'
  else font_pair
end
where font_pair in ('fraunces','cormorant','bricolage','outfit');

alter table pages101.actor_pages
  drop constraint if exists actor_pages_accent_check,
  drop constraint if exists actor_pages_font_pair_check,
  drop constraint if exists actor_pages_display_name_check,
  drop constraint if exists actor_pages_status_line_check,
  drop constraint if exists actor_pages_union_status_check,
  drop constraint if exists actor_pages_age_range_check,
  drop constraint if exists actor_pages_market_check;

alter table pages101.actor_pages
  add constraint actor_pages_accent_check
    check (accent is null or accent ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint actor_pages_font_pair_check
    check (font_pair is null or font_pair in
      ('template','fraunces-inter','cormorant-inter','bricolage-inter','outfit-inter')),
  add constraint actor_pages_display_name_check
    check (char_length(display_name) between 1 and 80),
  add constraint actor_pages_status_line_check
    check (status_line is null or char_length(status_line) <= 160),
  add constraint actor_pages_union_status_check
    check (union_status is null or char_length(union_status) <= 40),
  add constraint actor_pages_age_range_check
    check (age_range is null or char_length(age_range) <= 20),
  add constraint actor_pages_market_check
    check (market is null or char_length(market) <= 60);

alter table pages101.page_sections
  drop constraint if exists page_sections_page_id_type_key;

alter table pages101.page_sections
  add constraint page_sections_page_id_type_key unique (page_id, type);

alter table pages101.custom_domains
  drop constraint if exists custom_domains_domain_check;

alter table pages101.custom_domains
  add constraint custom_domains_domain_check
    check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');

alter table pages101.relay_messages
  drop constraint if exists relay_messages_sender_name_check,
  drop constraint if exists relay_messages_sender_email_check,
  drop constraint if exists relay_messages_body_check;

alter table pages101.relay_messages
  add constraint relay_messages_sender_name_check
    check (char_length(sender_name) between 1 and 120),
  add constraint relay_messages_sender_email_check
    check (char_length(sender_email) <= 254),
  add constraint relay_messages_body_check
    check (char_length(body) between 1 and 2000);

create or replace function pages101.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists actor_pages_updated_at on pages101.actor_pages;
create trigger actor_pages_updated_at
  before update on pages101.actor_pages
  for each row execute function pages101.set_updated_at();

drop trigger if exists subscriptions_updated_at on pages101.subscriptions;
create trigger subscriptions_updated_at
  before update on pages101.subscriptions
  for each row execute function pages101.set_updated_at();

create or replace function pages101.check_slug_reserved()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from pages101.reserved_slugs r where r.slug = new.slug) then
    raise exception 'slug "%" is reserved', new.slug
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists actor_pages_slug_reserved on pages101.actor_pages;
create trigger actor_pages_slug_reserved
  before insert or update of slug on pages101.actor_pages
  for each row execute function pages101.check_slug_reserved();

alter table pages101.actor_pages    enable row level security;
alter table pages101.page_sections  enable row level security;
alter table pages101.subscriptions  enable row level security;
alter table pages101.custom_domains enable row level security;
alter table pages101.relay_messages enable row level security;
alter table pages101.reserved_slugs enable row level security;

drop policy if exists "owners manage actor pages" on pages101.actor_pages;
drop policy if exists "public reads published actor pages" on pages101.actor_pages;
drop policy if exists "owner full access" on pages101.actor_pages;
drop policy if exists "public read published" on pages101.actor_pages;

create policy "owner full access"
  on pages101.actor_pages
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public read published"
  on pages101.actor_pages
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "owners manage page sections" on pages101.page_sections;
drop policy if exists "public reads published page sections" on pages101.page_sections;
drop policy if exists "owner full access" on pages101.page_sections;
drop policy if exists "public read published" on pages101.page_sections;

create policy "owner full access"
  on pages101.page_sections
  for all
  to authenticated
  using (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.user_id = auth.uid()
  ));

create policy "public read published"
  on pages101.page_sections
  for select
  to anon, authenticated
  using (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.published = true
  ));

drop policy if exists "owners read subscriptions" on pages101.subscriptions;
drop policy if exists "owner read own" on pages101.subscriptions;

create policy "owner read own"
  on pages101.subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owners read custom domains" on pages101.custom_domains;
drop policy if exists "owners manage custom domains" on pages101.custom_domains;
drop policy if exists "owner read own" on pages101.custom_domains;
drop policy if exists "owner detach own" on pages101.custom_domains;

create policy "owner read own"
  on pages101.custom_domains
  for select
  to authenticated
  using (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.user_id = auth.uid()
  ));

create policy "owner detach own"
  on pages101.custom_domains
  for delete
  to authenticated
  using (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.user_id = auth.uid()
  ));

drop policy if exists "owner read own" on pages101.relay_messages;

create policy "owner read own"
  on pages101.relay_messages
  for select
  to authenticated
  using (exists (
    select 1 from pages101.actor_pages p
    where p.id = page_id and p.user_id = auth.uid()
  ));

drop policy if exists "public read" on pages101.reserved_slugs;

create policy "public read"
  on pages101.reserved_slugs
  for select
  to anon, authenticated
  using (true);

grant usage on schema pages101 to anon, authenticated;

grant select on pages101.actor_pages,
                pages101.page_sections,
                pages101.reserved_slugs
  to anon;

grant select on pages101.actor_pages,
                pages101.page_sections,
                pages101.subscriptions,
                pages101.custom_domains,
                pages101.relay_messages,
                pages101.reserved_slugs
  to authenticated;

grant insert, update, delete on pages101.actor_pages,
                                pages101.page_sections
  to authenticated;

grant delete on pages101.custom_domains to authenticated;

insert into storage.buckets (id, name, public)
values ('pages101-media', 'pages101-media', true)
on conflict (id) do nothing;

drop policy if exists "p101 media public read" on storage.objects;
drop policy if exists "p101 media owner insert" on storage.objects;
drop policy if exists "p101 media owner update" on storage.objects;
drop policy if exists "p101 media owner delete" on storage.objects;

create policy "p101 media public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'pages101-media');

create policy "p101 media owner insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pages101-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "p101 media owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pages101-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "p101 media owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pages101-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
