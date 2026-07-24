begin;

-- Field Mapping Addendum (July 2026): amend p101_opencall_applications to
-- match the 28-column 2025 form. Companion to 202607230001_p101_opencall.sql;
-- per the addendum, everything not listed here (RLS, rep gate, lifecycle,
-- server-only transitions, slate_url/resume_url/reel_url nullability,
-- markets) is unchanged.
--
-- Table had 0 rows at the time of this migration, so NOT NULL constraints
-- are added directly with no backfill step.

-- The old view depends on columns this migration drops (casting_profile_url,
-- headshot_urls, city_state); it must be dropped before those columns are,
-- then recreated against the amended set below.
drop view if exists public.p101_opencall_gallery_v;

-- ---------------------------------------------------------------------------
-- Judgment Call A: birthday -> birth month + year, both required.
-- Full DOB is never stored; age is derived client-side from month + year.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists birth_month integer;

alter table public.p101_opencall_applications
  alter column birth_year set not null,
  alter column birth_month set not null;

alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_birth_month_check;

alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_birth_month_check
    check (birth_month between 1 and 12);

-- ---------------------------------------------------------------------------
-- Judgment Call B: ethnicity, restored. Optional, multi-select + self-describe.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists ethnicity text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Casting platforms, restored (separate from the profile URLs).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists casting_platforms text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- casting_profile_url (single) -> casting_profile_urls (array, up to two).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists casting_profile_urls text[] not null default '{}';

alter table public.p101_opencall_applications
  drop column if exists casting_profile_url;

-- ---------------------------------------------------------------------------
-- Judgment Call C: headshot_urls (flat array) -> headshots (labeled jsonb).
-- Shape: [{"type":"commercial"|"theatrical"|"other","url":"..."}]
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists headshots jsonb not null default '[]'::jsonb;

alter table public.p101_opencall_applications
  drop column if exists headshot_urls;

-- ---------------------------------------------------------------------------
-- Other video link, restored.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists other_video_url text;

-- ---------------------------------------------------------------------------
-- Representation context: why submitting despite having a rep already.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists rep_context text
    check (rep_context is null or char_length(rep_context) <= 2000);

-- ---------------------------------------------------------------------------
-- city_state (single field) -> city / state / country (three fields).
-- Nullability carried over unchanged from city_state (nullable); country
-- gets a default since the dropdown will default to US.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text not null default 'US';

alter table public.p101_opencall_applications
  drop column if exists city_state;

-- ---------------------------------------------------------------------------
-- Rebuild the gallery view against the amended column set. Guardian columns
-- (guardian_name, guardian_email, guardian_phone) remain deliberately absent;
-- rep_context is included since it's representation-relevant, not guardian PII.
-- ---------------------------------------------------------------------------

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
  a.markets,
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
where a.status = 'submitted';

revoke all on public.p101_opencall_gallery_v from anon, authenticated;

commit;
