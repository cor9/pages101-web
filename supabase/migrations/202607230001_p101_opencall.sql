begin;

-- Open Call on Pages101 — schema, RLS, and server-managed lifecycle.
--
-- Design notes (see opencall-spec-v2):
--   * An application is its own record. It never touches p101_actor_pages and
--     never counts against page/template limits.
--   * The submission deadline lives on the event row and only there. Every
--     client write path consults it through RLS; the server routes consult it
--     directly because the service role bypasses RLS.
--   * Lifecycle columns (user_id, event_id, status, submitted_at) are immutable
--     from the client. Enforced by BEFORE UPDATE trigger, NOT by a self-select
--     WITH CHECK. See p101_opencall_guard_application() for why.

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.p101_profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  full_name     text check (full_name is null or char_length(full_name) <= 120),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  phone         text check (phone is null or char_length(phone) <= 40),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists p101_profiles_updated_at on public.p101_profiles;
create trigger p101_profiles_updated_at
  before update on public.p101_profiles
  for each row execute function public.p101_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Events — the deadline lives here and only here
-- ---------------------------------------------------------------------------

create table if not exists public.p101_opencall_events (
  id            uuid primary key default gen_random_uuid(),
  year          integer not null unique,
  name          text not null,
  submits_open  timestamptz not null,
  submits_close timestamptz not null,
  review_close  timestamptz not null,
  status        text not null default 'draft'
                check (status in ('draft','open','reviewing','closed')),
  constraint p101_opencall_events_window_check
    check (submits_close > submits_open and review_close >= submits_close)
);

-- ---------------------------------------------------------------------------
-- 3. Applications
-- ---------------------------------------------------------------------------

create table if not exists public.p101_opencall_applications (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.p101_opencall_events(id),
  user_id             uuid not null references auth.users(id) on delete cascade,
  page_id             uuid references public.p101_actor_pages(id) on delete set null,

  -- actor info, inline; the families/actors architecture arrives later
  actor_name          text not null check (char_length(actor_name) between 1 and 120),
  birth_year          integer check (birth_year between 1990 and extract(year from now())::int),
  gender              text check (gender is null or char_length(gender) <= 40),
  city_state          text check (city_state is null or char_length(city_state) <= 120),
  markets             text[],
  local_hire_cities   text[],
  union_status        text check (union_status in ('non_union','sag_eligible','sag_member')),
  coogan_status       text check (coogan_status in ('yes','no','not_required')),
  work_permit         text check (work_permit in ('yes','no','not_required')),
  passport            boolean not null default false,
  has_current_rep     boolean not null default false,
  current_rep_name    text check (current_rep_name is null or char_length(current_rep_name) <= 160),
  seeking             text[] not null default '{}',

  -- guardian: per-application context, deliberately not on the profile.
  -- These columns are rep-gated. They must never leave the database through
  -- a route that has not verified a rep session. See p101_opencall_gallery_v.
  guardian_name       text not null check (char_length(guardian_name) between 1 and 120),
  guardian_email      text not null check (char_length(guardian_email) <= 254),
  guardian_phone      text check (guardian_phone is null or char_length(guardian_phone) <= 40),

  -- materials
  headshot_urls       text[] not null default '{}',
  resume_url          text,
  slate_url           text,
  reel_url            text,
  casting_profile_url text,
  supplemental_notes  text check (supplemental_notes is null or char_length(supplemental_notes) <= 4000),

  -- lifecycle (server-managed; see guard trigger)
  status              text not null default 'draft'
                      check (status in ('draft','submitted','withdrawn')),
  submitted_at        timestamptz,
  consents            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (event_id, user_id, actor_name)
);

create index if not exists p101_opencall_applications_event_status_idx
  on public.p101_opencall_applications (event_id, status);

create index if not exists p101_opencall_applications_user_idx
  on public.p101_opencall_applications (user_id);

create index if not exists p101_opencall_applications_page_idx
  on public.p101_opencall_applications (page_id);

drop trigger if exists p101_opencall_applications_updated_at on public.p101_opencall_applications;
create trigger p101_opencall_applications_updated_at
  before update on public.p101_opencall_applications
  for each row execute function public.p101_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Rep invites and access log — service role only, no client policies
-- ---------------------------------------------------------------------------

create table if not exists public.p101_opencall_rep_invites (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.p101_opencall_events(id),
  rep_name   text not null,
  rep_email  text not null,
  rep_agency text,
  token_hash text not null unique,   -- store the hash; the raw token is emailed once
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists p101_opencall_rep_invites_event_idx
  on public.p101_opencall_rep_invites (event_id);

create table if not exists public.p101_opencall_access_log (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid not null references public.p101_opencall_rep_invites(id),
  action         text not null check (action in ('session_start','view_application')),
  application_id uuid,
  created_at     timestamptz not null default now()
);

create index if not exists p101_opencall_access_log_invite_idx
  on public.p101_opencall_access_log (invite_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Lifecycle guard
-- ---------------------------------------------------------------------------

-- Why a trigger and not a self-select WITH CHECK:
-- the spec's candidate expression
--   status = (select status from p101_opencall_applications a2 where a2.id = id)
-- is not safe. In that subquery `id` resolves to the INNER scope (a2.id), so the
-- predicate degrades to `a2.id = a2.id` -- always true -- and the subquery
-- returns every row the caller can see. With a single application it happens to
-- work; the moment one account holds two applications (a family submitting for
-- two children, which the spec requires) every UPDATE fails with SQLSTATE 21000,
-- "more than one row returned by a subquery used as an expression", locking the
-- family out of editing entirely. Verified on this database, Postgres 17.
--
-- The trigger below enforces the same invariants without the scoping hazard.
create or replace function public.p101_opencall_guard_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only client roles are constrained. The service role (server routes) and
  -- direct database roles (migrations, admin) own the lifecycle transitions.
  if current_user in ('authenticated', 'anon') then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable' using errcode = 'P0001';
    end if;
    if new.event_id is distinct from old.event_id then
      raise exception 'event_id is immutable' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      raise exception 'status is server-managed; use the submit or withdraw route'
        using errcode = 'P0001';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'submitted_at is server-managed' using errcode = 'P0001';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at is immutable' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists p101_opencall_applications_guard on public.p101_opencall_applications;
create trigger p101_opencall_applications_guard
  before update on public.p101_opencall_applications
  for each row execute function public.p101_opencall_guard_application();

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.p101_profiles                enable row level security;
alter table public.p101_opencall_events         enable row level security;
alter table public.p101_opencall_applications   enable row level security;
alter table public.p101_opencall_rep_invites    enable row level security;
alter table public.p101_opencall_access_log     enable row level security;

-- Profiles: owner reads and writes own row.
drop policy if exists "own profile select" on public.p101_profiles;
drop policy if exists "own profile insert" on public.p101_profiles;
drop policy if exists "own profile update" on public.p101_profiles;

create policy "own profile select" on public.p101_profiles
  for select to authenticated using (auth.uid() = user_id);

create policy "own profile insert" on public.p101_profiles
  for insert to authenticated with check (auth.uid() = user_id);

create policy "own profile update" on public.p101_profiles
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Events: signed-in users may read events that have gone live. No client writes.
drop policy if exists "read visible events" on public.p101_opencall_events;

create policy "read visible events" on public.p101_opencall_events
  for select to authenticated
  using (status in ('open','reviewing','closed'));

-- Applications: owner reads own rows in any status.
drop policy if exists "own applications select" on public.p101_opencall_applications;
drop policy if exists "create application in window" on public.p101_opencall_applications;
drop policy if exists "edit application in window" on public.p101_opencall_applications;

create policy "own applications select" on public.p101_opencall_applications
  for select to authenticated
  using (auth.uid() = user_id);

-- Owner may create a draft only while the event window is open.
create policy "create application in window" on public.p101_opencall_applications
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'draft'
    and submitted_at is null
    and exists (
      select 1 from public.p101_opencall_events e
      where e.id = event_id
        and e.status = 'open'
        and now() >= e.submits_open
        and now() <  e.submits_close
    )
  );

-- Owner may edit content only while the window is open. Immutability of the
-- lifecycle columns is enforced by p101_opencall_guard_application().
create policy "edit application in window" on public.p101_opencall_applications
  for update to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.p101_opencall_events e
      where e.id = p101_opencall_applications.event_id
        and now() < e.submits_close
    )
  )
  with check (auth.uid() = user_id);

-- No delete policy: applications are withdrawn, never deleted, from the client.
-- No policies at all on rep invites or the access log: service role only.

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------

grant select, insert, update on public.p101_profiles              to authenticated;
grant select                 on public.p101_opencall_events       to authenticated;
grant select, insert, update on public.p101_opencall_applications to authenticated;

revoke all on public.p101_opencall_rep_invites from anon, authenticated;
revoke all on public.p101_opencall_access_log  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Gallery view — explicitly enumerated, no guardian PII
-- ---------------------------------------------------------------------------

-- Guardian name, email and phone are deliberately absent. The rep detail route
-- selects those columns directly, with the service role, only after it has
-- verified a rep session. Nothing that can reach a browser outside the gated
-- gallery may select them.
create or replace view public.p101_opencall_gallery_v as
select
  a.id,
  a.event_id,
  a.actor_name,
  a.birth_year,
  a.gender,
  a.city_state,
  a.markets,
  a.local_hire_cities,
  a.union_status,
  a.coogan_status,
  a.work_permit,
  a.passport,
  a.has_current_rep,
  a.current_rep_name,
  a.seeking,
  a.headshot_urls,
  a.resume_url,
  a.slate_url,
  a.reel_url,
  a.casting_profile_url,
  a.supplemental_notes,
  a.submitted_at
from public.p101_opencall_applications a
where a.status = 'submitted';

revoke all on public.p101_opencall_gallery_v from anon, authenticated;

commit;
