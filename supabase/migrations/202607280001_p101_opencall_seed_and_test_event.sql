begin;

-- Open Call Gallery Preview: seed data flag + test event.
--
-- This migration enables admin-controlled seed submissions for gallery testing.
-- Seed records are fictional test data; they are never visible to real
-- representatives in production events.
--
-- Changes:
--   1. p101_opencall_applications: add is_seed (not null, default false).
--   2. p101_opencall_events: add is_test (not null, default false).
--   3. Rebuild p101_opencall_gallery_v:
--        - Non-test events: exclude is_seed = true rows entirely.
--        - Test events: show all submitted rows (which for a test event
--          would only ever be seed data anyway).
--   4. Insert the gallery test event (year=9998, is_test=true).

-- ---------------------------------------------------------------------------
-- 1. is_seed on applications.
--    Partial index covers admin seed queries efficiently without adding cost
--    to the production-path WHERE is_seed = false predicate.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists is_seed boolean not null default false;

create index if not exists p101_opencall_applications_is_seed_idx
  on public.p101_opencall_applications (event_id)
  where is_seed = true;

-- ---------------------------------------------------------------------------
-- 2. is_test on events.
--    All existing events are real; default false is correct backfill.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_events
  add column if not exists is_test boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Rebuild gallery view.
--    The join to p101_opencall_events is required to apply the is_test
--    condition. event_id is a FK with a supporting index, so the join cost
--    is negligible when the query also filters on event_id (which it always
--    does via the TalentSearch adapter).
--
--    Guardian columns remain absent. is_seed is intentionally absent from
--    the column list — TalentSearch must never see that flag.
-- ---------------------------------------------------------------------------

drop view if exists public.p101_opencall_gallery_v;

create view public.p101_opencall_gallery_v as
select
  a.id,
  a.event_id,
  a.actor_name,
  a.birth_month,
  a.birth_year,
  a.gender,
  a.ethnicity,
  a.city,
  a.state,
  a.country,
  a.local_hire_cities,
  a.union_status,
  a.coogan_status,
  a.work_permit,
  a.passport,
  a.has_current_rep,
  a.current_rep_name,
  a.rep_context,
  a.seeking,
  a.casting_platforms,
  a.casting_profile_urls,
  a.headshots,
  a.resume_url,
  a.slate_url,
  a.reel_url,
  a.other_video_url,
  a.supplemental_notes,
  a.submitted_at
from public.p101_opencall_applications a
join public.p101_opencall_events e on e.id = a.event_id
where a.status = 'submitted'
  and (a.is_seed = false or e.is_test = true);

revoke all on public.p101_opencall_gallery_v from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Gallery test event (year=9998).
--
--    status='reviewing' so the TalentSearch gallery accepts rep sessions for
--    it. submits_close is in the past so the RLS INSERT policy blocks any
--    real family from creating an application (status='open' is also required
--    by RLS, and this event is 'reviewing'). review_close is far future so
--    rep invites remain valid indefinitely during testing.
-- ---------------------------------------------------------------------------

insert into public.p101_opencall_events (
  year, name, status, is_test,
  submits_open, submits_close, review_close
)
select
  9998,
  'Open Call Gallery Preview',
  'reviewing',
  true,
  '2026-01-01T00:00:00Z',
  '2026-01-02T00:00:00Z',
  '2099-12-31T23:59:59Z'
where not exists (
  select 1 from public.p101_opencall_events where year = 9998
);

commit;
