begin;

-- Phase 3 amendment: representative favorites, introduction requests,
-- and extended access-log action list.
--
-- All three affected tables had 0 non-fixture rows at the time this
-- migration was written. Every structural change is backfill-free.

-- ---------------------------------------------------------------------------
-- 1. p101_opencall_rep_favorites
--    One row per (invite × application). Service-role only.
-- ---------------------------------------------------------------------------

create table if not exists public.p101_opencall_rep_favorites (
  id             uuid        primary key default gen_random_uuid(),
  invite_id      uuid        not null references public.p101_opencall_rep_invites(id) on delete restrict,
  event_id       uuid        not null references public.p101_opencall_events(id) on delete restrict,
  application_id uuid        not null references public.p101_opencall_applications(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (invite_id, application_id)
);

create index if not exists p101_opencall_rep_favorites_invite_idx
  on public.p101_opencall_rep_favorites (invite_id, created_at desc);

create index if not exists p101_opencall_rep_favorites_application_idx
  on public.p101_opencall_rep_favorites (application_id);

revoke all on public.p101_opencall_rep_favorites from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. p101_opencall_intro_requests
--    One durable row per (invite × application) tracks delivery state.
--    Guardian contact is NOT stored here; it is resolved at send time
--    from the application row using the service role.
-- ---------------------------------------------------------------------------

create table if not exists public.p101_opencall_intro_requests (
  id                     uuid        primary key default gen_random_uuid(),
  event_id               uuid        not null references public.p101_opencall_events(id) on delete restrict,
  invite_id              uuid        not null references public.p101_opencall_rep_invites(id) on delete restrict,
  application_id         uuid        not null references public.p101_opencall_applications(id) on delete restrict,
  status                 text        not null default 'pending'
                         check (status in ('pending', 'sent', 'partial_failure', 'failed')),
  requested_at           timestamptz not null default now(),
  guardian_email_sent_at timestamptz,
  rep_email_sent_at      timestamptz,
  failed_at              timestamptz,
  failure_code           text        check (failure_code is null or char_length(failure_code) <= 120),
  unique (invite_id, application_id)
);

create index if not exists p101_opencall_intro_requests_invite_idx
  on public.p101_opencall_intro_requests (invite_id);

create index if not exists p101_opencall_intro_requests_application_idx
  on public.p101_opencall_intro_requests (application_id);

create index if not exists p101_opencall_intro_requests_event_idx
  on public.p101_opencall_intro_requests (event_id, requested_at desc);

revoke all on public.p101_opencall_intro_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Extend p101_opencall_access_log action allowlist.
--    Adds: favorite_application, unfavorite_application, invite_revoked,
--           request_introduction.
--    Retains: session_start, invite_redeemed, access_denied,
--             view_application, reveal_guardian_contact (schema compat).
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
      'reveal_guardian_contact',
      'favorite_application',
      'unfavorite_application',
      'invite_revoked',
      'request_introduction'
    ));

-- ---------------------------------------------------------------------------
-- 4. Extend the required-application constraint for the new non-application
--    action: invite_revoked (no application context, like session_start).
-- ---------------------------------------------------------------------------

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_application_required_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_application_required_check
    check (
      action in ('session_start', 'invite_redeemed', 'access_denied', 'invite_revoked')
      or application_id is not null
    );

commit;
