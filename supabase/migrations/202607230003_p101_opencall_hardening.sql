begin;

-- Pre-form hardening pass on p101_opencall_applications. Five decisions,
-- locked down before the form gets built, plus one new product requirement
-- (guardian contact is a tracked, per-application reveal, never a bulk field).
--
-- Table had 0 rows at the time of this migration; all constraint additions
-- below are direct, no backfill required.

drop view if exists public.p101_opencall_gallery_v;

-- ---------------------------------------------------------------------------
-- Decision 1: required-field validation happens at submission, not via
-- NOT NULL. NOT NULL blocks the "save after typing just the kid's name"
-- autosave UX the spec calls for -- a column that must eventually be filled
-- is not the same as a column that must be filled on every draft write.
--
-- These columns become nullable (drafts may omit them); a standing CHECK
-- (below, after the column changes) requires them only once status =
-- 'submitted'. That CHECK applies to every writer, including the service
-- role -- no future code path can produce an incomplete "submitted" row,
-- even by mistake.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  alter column actor_name drop not null,
  alter column guardian_name drop not null,
  alter column guardian_email drop not null,
  alter column birth_year drop not null,
  alter column birth_month drop not null;

-- ---------------------------------------------------------------------------
-- Decision 3: headshots gets a defined JSON shape and an approved type list.
-- Shape: [{"type": "commercial" | "theatrical" | "other", "url": "..."}]
-- A CHECK constraint cannot contain a subquery, but it can call a function
-- that does its own per-element validation -- confirmed against this
-- database before writing this migration (see conversation record). The
-- function only inspects its argument; it does not touch other tables.
-- ---------------------------------------------------------------------------

create or replace function public.p101_opencall_valid_headshots(h jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  elem jsonb;
begin
  if h is null or jsonb_typeof(h) <> 'array' then
    return false;
  end if;

  for elem in select value from jsonb_array_elements(h) loop
    if jsonb_typeof(elem) <> 'object' then
      return false;
    end if;
    if not (elem ? 'type' and elem ? 'url') then
      return false;
    end if;
    if not (elem->>'type' in ('commercial', 'theatrical', 'other')) then
      return false;
    end if;
    if coalesce(elem->>'url', '') = '' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_headshots_shape_check;

alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_headshots_shape_check
    check (public.p101_opencall_valid_headshots(headshots));

-- ---------------------------------------------------------------------------
-- Decision 4: casting platforms and profile URLs are independent, not
-- positionally paired. casting_platforms records which platforms the family
-- uses (for filtering); casting_profile_urls is an unordered list of up to
-- two links to whichever of those platforms they chose to share. There is
-- no casting_platforms[i] <-> casting_profile_urls[i] correspondence --
-- pairing them positionally would break the moment a family selects "Other"
-- with no matching link, or provides two Actors Access links and no
-- Casting Networks account. The two-link cap is a standing rule (drafts
-- included); "at least one" is a submission-time rule (see below).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_casting_platforms_check;

alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_casting_platforms_check
    check (casting_platforms <@ array['actors_access', 'casting_networks', 'other']);

alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_casting_urls_cap_check;

alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_casting_urls_cap_check
    check (cardinality(casting_profile_urls) <= 2);

-- ---------------------------------------------------------------------------
-- Decision 5: markets is formally deprecated, not casually deleted.
-- It appears nowhere in the 28-field addendum mapping, duplicates the
-- purpose of local_hire_cities, has zero rows using it, and zero references
-- in application code (grepped before this migration was written). Keeping
-- an unlabeled, unused column around risks a future developer wiring UI to
-- it by assumption. Dropped here, named, with this rationale on record --
-- git history is the undo button if that call is wrong.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  drop column if exists markets;

-- ---------------------------------------------------------------------------
-- Decision 1 (continued): consents shape + the submission-completeness gate.
--
-- consents jsonb shape: top-level keys map to an ISO-8601 timestamp string
-- (when granted) or are absent (not granted).
--   guardian_consent             -- required at submit
--   reviewer_visibility_consent  -- required at submit
--   contact_consent              -- required at submit
--   anonymized_results_consent   -- optional, never required
--
-- has_current_rep is boolean NOT NULL DEFAULT false, so it is always
-- "present" -- the addendum's Required column is trivially satisfied for it
-- and for passport (same pattern). That is an existing limitation carried
-- from the original schema (a false default is indistinguishable from an
-- unanswered field) and is out of scope for this pass.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_applications
  drop constraint if exists p101_opencall_applications_submit_complete_check;

alter table public.p101_opencall_applications
  add constraint p101_opencall_applications_submit_complete_check
    check (
      status <> 'submitted' or (
        coalesce(actor_name, '') <> ''
        and coalesce(guardian_name, '') <> ''
        and coalesce(guardian_email, '') <> ''
        and coalesce(guardian_phone, '') <> ''
        and birth_year is not null
        and birth_month is not null
        and gender is not null
        and city is not null
        and state is not null
        and country is not null
        and union_status is not null
        and coogan_status is not null
        and work_permit is not null
        and (has_current_rep = false or current_rep_name is not null)
        and cardinality(seeking) >= 1
        and cardinality(casting_profile_urls) >= 1
        and jsonb_array_length(headshots) >= 1
        and resume_url is not null
        and slate_url is not null
        and consents ? 'guardian_consent'
        and consents ? 'reviewer_visibility_consent'
        and consents ? 'contact_consent'
      )
    );

-- ---------------------------------------------------------------------------
-- Decision 2: lifecycle ownership and server-only fields, protected beyond
-- just status. The existing guard trigger already locked user_id, event_id,
-- status, submitted_at, created_at. Two gaps close here:
--   - id was never protected: a client could UPDATE ... SET id = <uuid>,
--     silently orphaning the row's identity (nothing else references
--     application id by FK yet, but access_log.application_id does now --
--     see below -- and future features will).
--   - page_id was never protected after insert, and never validated for
--     ownership at insert. A client could set page_id to any actor page's
--     id, including one it doesn't own, falsely implying that application
--     was pre-filled from that page.
-- ---------------------------------------------------------------------------

create or replace function public.p101_opencall_guard_application()
returns trigger
language plpgsql
set search_path = public
as $$
begin
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
    if new.page_id is distinct from old.page_id then
      raise exception 'page_id is immutable once set' using errcode = 'P0001';
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

-- page_id ownership at creation: a client may only link a page it owns.
drop policy if exists "create application in window" on public.p101_opencall_applications;

create policy "create application in window" on public.p101_opencall_applications
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'draft'
    and submitted_at is null
    and (
      page_id is null
      or exists (
        select 1 from public.p101_actor_pages p
        where p.id = page_id and p.user_id = auth.uid()
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
-- Adjacent integrity fix found while closing the page_id gap: access_log
-- referenced application_id with no foreign key at all.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_application_id_fkey;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_application_id_fkey
    foreign key (application_id) references public.p101_opencall_applications(id)
    on delete set null;

-- ---------------------------------------------------------------------------
-- New product requirement: guardian contact is never in the broad gallery
-- dataset. It already wasn't (the view below never selected guardian_*).
-- What's new: a guardian-contact reveal becomes its own logged action,
-- distinct from viewing an application's public detail. The server route
-- that serves guardian_name/guardian_email/guardian_phone for one
-- application must write a 'reveal_guardian_contact' access_log row before
-- returning them. application_id is now required for every action except
-- session_start, so every reveal is individually attributable to an
-- invite and an application -- the audit trail a real discovery platform
-- needs, not a gated spreadsheet.
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_action_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_action_check
    check (action in ('session_start', 'view_application', 'reveal_guardian_contact'));

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_application_required_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_application_required_check
    check (action = 'session_start' or application_id is not null);

-- ---------------------------------------------------------------------------
-- Rebuild the gallery view: markets column is gone, everything else
-- unchanged. Guardian columns remain deliberately absent -- this view is
-- the "broad gallery dataset" the new product requirement refers to.
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
