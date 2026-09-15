begin;

-- Representation rework: split the single has_current_rep/current_rep_name
-- boolean+name pair into a proper multi-representative model, and add a
-- distinct "representation sought" concept. Replaces the old work-category
-- `seeking` field entirely (it was mislabeled "Seeking Representation"
-- downstream in TalentSearch despite never capturing representation type —
-- see scripts/import-opencall-2025-gallery.mjs's real 2025 Airtable column
-- "Seeking What Talent Representation?" for the field this actually should
-- have been).
--
-- Pre-migration state (checked via read-only query before writing this):
--   - 158 is_seed=true submitted rows (rebuilt fresh by the seed script/data
--     update that accompanies this migration; not hand-migrated here).
--   - Exactly 1 is_seed=false submitted row (application
--     898d87bc-e388-4afe-87a2-3b0717069149, year=9999 test event, performer
--     "Child Ralston", created/submitted during this session's own testing).
--     has_current_rep=false, current_rep_name=null, rep_context=null,
--     seeking=["theatrical"] — nothing to carry into representatives/
--     representation_notes (both already empty/null); the seeking value is
--     dropped along with the column by design, with no destination field.

-- ---------------------------------------------------------------------------
-- 0. The view depends on columns this migration drops/renames below; it must
--    be dropped first and rebuilt at the end against the amended set.
-- ---------------------------------------------------------------------------

drop view if exists public.p101_opencall_gallery_v;

-- ---------------------------------------------------------------------------
-- 1. has_current_rep: boolean not null default false -> nullable, no default.
--    Tri-state: null (unanswered) / true / false. Existing rows keep their
--    explicit `false`, which remains a valid "No" answer.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  alter column has_current_rep drop not null,
  alter column has_current_rep drop default;

-- ---------------------------------------------------------------------------
-- 2. representatives: one row per current representative.
--    Shape: [{ "name": string, "type": <approved value>, "market": string|null }]
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists representatives jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 3. seeking_representation: representation types being sought. Same
--    9-value vocabulary as representatives[].type.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  add column if not exists seeking_representation text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 4. rep_context -> representation_notes (rename in place; same free-text
--    column, new purpose/label — "Representation Notes").
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  rename column rep_context to representation_notes;

-- ---------------------------------------------------------------------------
-- 5. current_rep_name: dropped, superseded by representatives[].name.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  drop column if exists current_rep_name;

-- ---------------------------------------------------------------------------
-- 6. seeking: the old work-category field, dropped outright (not renamed;
--    no "areas_of_interest" replacement — see commit/PR notes for why).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  drop column if exists seeking;

-- ---------------------------------------------------------------------------
-- 7. Rebuild the gallery view against the amended column set.
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
  a.local_hire_cities,
  a.union_status,
  a.coogan_status,
  a.work_permit,
  a.passport,
  a.has_current_rep,
  a.representatives,
  a.seeking_representation,
  a.representation_notes,
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

commit;
