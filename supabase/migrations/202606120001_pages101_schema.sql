create schema if not exists pages101;

create table if not exists pages101.actor_pages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique
                check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and char_length(slug) between 3 and 40),
  template      text not null default 'classic'
                check (template in ('classic','splash','prestige')),
  accent        text check (accent is null or accent ~ '^#[0-9A-Fa-f]{6}$'),
  font_pair     text check (font_pair is null or font_pair in ('template','fraunces-inter','cormorant-inter','bricolage-inter','outfit-inter')),
  display_name  text not null,
  status_line   text,
  union_status  text,
  age_range     text,
  market        text,
  has_rep       boolean not null default true,
  reps          jsonb  not null default '[]'::jsonb,
  links         jsonb  not null default '[]'::jsonb,
  slate_url     text,
  published     boolean not null default false,
  noindex       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists pages101.page_sections (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references pages101.actor_pages(id) on delete cascade,
  type       text not null check (type in ('headshots','resume','clips','feed','press')),
  enabled    boolean not null default true,
  sort_order int not null default 0,
  content    jsonb not null default '{}'::jsonb
);

create index if not exists page_sections_page_order_idx on pages101.page_sections (page_id, sort_order);

create table if not exists pages101.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free','plus')),
  status                 text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

create table if not exists pages101.custom_domains (
  domain     text primary key,
  page_id    uuid not null references pages101.actor_pages(id) on delete cascade,
  verified   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists pages101.relay_messages (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references pages101.actor_pages(id) on delete cascade,
  sender_name  text not null,
  sender_email text not null,
  body         text not null check (char_length(body) <= 2000),
  created_at   timestamptz not null default now()
);

alter table pages101.actor_pages enable row level security;
alter table pages101.page_sections enable row level security;
alter table pages101.subscriptions enable row level security;
alter table pages101.custom_domains enable row level security;
alter table pages101.relay_messages enable row level security;

create policy "owners manage actor pages"
  on pages101.actor_pages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "public reads published actor pages"
  on pages101.actor_pages
  for select
  using (published = true);

create policy "owners manage page sections"
  on pages101.page_sections
  for all
  using (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = page_sections.page_id
        and actor_pages.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = page_sections.page_id
        and actor_pages.user_id = auth.uid()
    )
  );

create policy "public reads published page sections"
  on pages101.page_sections
  for select
  using (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = page_sections.page_id
        and actor_pages.published = true
    )
  );

create policy "owners read subscriptions"
  on pages101.subscriptions
  for select
  using (auth.uid() = user_id);

create policy "owners read custom domains"
  on pages101.custom_domains
  for select
  using (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = custom_domains.page_id
        and actor_pages.user_id = auth.uid()
    )
  );

create policy "owners manage custom domains"
  on pages101.custom_domains
  for all
  using (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = custom_domains.page_id
        and actor_pages.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from pages101.actor_pages
      where actor_pages.id = custom_domains.page_id
        and actor_pages.user_id = auth.uid()
    )
  );

-- Relay messages are inserted only through server routes using the service role.
-- No anon or authenticated client policy is created for relay_messages writes.
