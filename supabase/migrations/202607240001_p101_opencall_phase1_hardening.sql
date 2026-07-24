begin;

-- Phase 1 foundation hardening for Open Call 11.
-- Closes the gaps between the previous session's migrations and the
-- Phase 1 execution prompt requirements. All affected tables had 0 rows
-- at the time of this migration; every structural change is backfill-free.

-- ---------------------------------------------------------------------------
-- 1. p101_opencall_events — add created_at/updated_at (consistent with
--    every other table in the schema; events were missing them).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_events
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists p101_opencall_events_updated_at on public.p101_opencall_events;
create trigger p101_opencall_events_updated_at
  before update on public.p101_opencall_events
  for each row execute function public.p101_set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. p101_opencall_applications — rename page_id → source_page_id.
--    "source_page_id" is provenance only: it records where initial actor data
--    was copied from. Edits to the source actor page never update the
--    application. The column name change prevents future confusion about
--    whether the application "belongs to" the page.
--
--    Execution order:
--      a. Drop dependent objects first (FK, index, RLS policy, trigger function
--         that references the old name).
--      b. Rename the column.
--      c. Recreate everything with the new name.
-- ---------------------------------------------------------------------------

-- Drop the INSERT policy that references page_id by name.
drop policy if exists "create application in window" on public.p101_opencall_applications;

-- Drop the index on page_id.
drop index if exists public.p101_opencall_applications_page_idx;

-- Drop the FK on page_id.
alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_page_id_fkey;

-- Rename.
alter table public.p101_opencall_applications
  rename column page_id to source_page_id;

-- Recreate FK with new name.
alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_source_page_id_fkey
    foreign key (source_page_id) references public.p101_actor_pages(id)
    on delete set null;

-- Recreate index with new name.
create index p101_opencall_applications_source_page_idx
  on public.p101_opencall_applications (source_page_id);

-- ---------------------------------------------------------------------------
-- 3. p101_opencall_applications — add lifecycle columns that the execution
--    prompt lists as protected server-managed fields.
--    withdrawn_at: set when a user withdraws an application (via server route).
--    reviewed_at:  set when an admin marks the application as reviewed.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists withdrawn_at timestamptz,
  add column if not exists reviewed_at  timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Rebuild guard trigger function to:
--      a. Replace page_id reference with source_page_id.
--      b. Add immutability protection for withdrawn_at and reviewed_at.
-- ---------------------------------------------------------------------------

create or replace function public.p101_opencall_guard_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only client roles are constrained. The service role (server routes) and
  -- direct database roles (migrations, admin) own the lifecycle transitions.
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id then
      raise exception 'id is immutable' using errcode = 'P0001';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable' using errcode = 'P0001';
    end if;
    if new.event_id is distinct from old.event_id then
      raise exception 'event_id is immutable' using errcode = 'P0001';
    end if;
    if new.source_page_id is distinct from old.source_page_id then
      raise exception 'source_page_id is immutable once set' using errcode = 'P0001';
    end if;
    if new.status is distinct from old.status then
      raise exception 'status is server-managed; use the submit or withdraw route'
        using errcode = 'P0001';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'submitted_at is server-managed' using errcode = 'P0001';
    end if;
    if new.withdrawn_at is distinct from old.withdrawn_at then
      raise exception 'withdrawn_at is server-managed' using errcode = 'P0001';
    end if;
    if new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'reviewed_at is server-managed' using errcode = 'P0001';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception 'created_at is immutable' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger binding is already correct (function replaces in place).
-- Idempotent recreate to be explicit.
drop trigger if exists p101_opencall_applications_guard on public.p101_opencall_applications;
create trigger p101_opencall_applications_guard
  before update on public.p101_opencall_applications
  for each row execute function public.p101_opencall_guard_application();

-- ---------------------------------------------------------------------------
-- 5. Rebuild INSERT policy using source_page_id.
-- ---------------------------------------------------------------------------

create policy "create application in window" on public.p101_opencall_applications
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'draft'
    and submitted_at is null
    and (
      source_page_id is null
      or exists (
        select 1 from public.p101_actor_pages p
        where p.id = source_page_id and p.user_id = auth.uid()
      )
    )
    and exists (
      select 1 from public.p101_opencall_events e
      where e.id = event_id
        and e.status = 'open'
        and now() >= e.submits_open
        and now() <  e.submits_close
    )
  );

-- ---------------------------------------------------------------------------
-- 6. p101_opencall_rep_invites — add redeemed_at for single-use token
--    tracking, and an index that supports expiry/revocation queries.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_rep_invites
  add column if not exists redeemed_at timestamptz;

create index if not exists p101_opencall_rep_invites_expiry_revoked_idx
  on public.p101_opencall_rep_invites (expires_at, revoked_at);

-- ---------------------------------------------------------------------------
-- 7. p101_opencall_access_log — add event_id for efficient event-scoped
--    queries without joining through rep_invites.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_access_log
  add column if not exists event_id uuid
    references public.p101_opencall_events(id) on delete restrict;

create index if not exists p101_opencall_access_log_event_idx
  on public.p101_opencall_access_log (event_id, created_at desc);

create index if not exists p101_opencall_access_log_application_idx
  on public.p101_opencall_access_log (application_id);

-- ---------------------------------------------------------------------------
-- 8. p101_opencall_access_log — extend action enum and required-application
--    constraint to cover invite lifecycle actions.
--    invite_redeemed: a rep redeems their invite token (no application yet).
--    access_denied:   an invalid or revoked/expired token was presented.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_action_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_action_check
    check (action in (
      'session_start',
      'invite_redeemed',
      'access_denied',
      'view_application',
      'reveal_guardian_contact'
    ));

-- application_id is required for application-scoped actions; invite lifecycle
-- actions (session_start, invite_redeemed, access_denied) don't have one.
alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_application_required_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_application_required_check
    check (
      action in ('session_start', 'invite_redeemed', 'access_denied')
      or application_id is not null
    );

-- ---------------------------------------------------------------------------
-- 9. Staging test event — open window for testing all lifecycle transitions.
--    Clearly labeled, idempotent, excludes production (production has no
--    event rows and must be seeded explicitly with owner-approved dates).
-- ---------------------------------------------------------------------------

insert into public.p101_opencall_events (
  year, name, status,
  submits_open, submits_close, review_close
)
select
  9999,
  '[TEST] Open Call Phase 1 Staging Fixture',
  'open',
  now() - interval '1 day',           -- already open
  now() + interval '30 days',         -- closes in 30 days
  now() + interval '60 days'          -- review closes in 60 days
where not exists (
  select 1 from public.p101_opencall_events where year = 9999
);

commit;
