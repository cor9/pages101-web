-- Open Call: reusable rep self-registration links.
--
-- A registration link is posted to a rep group / professional community. A rep
-- who opens it fills in name, work email, agency and role; the server then
-- creates a PERSONAL invite in p101_opencall_rep_invites (registered_via =
-- this link) and emails them their own access link. Registration links never
-- grant gallery access themselves and can be disabled without touching the
-- invites already issued through them.

begin;

create table if not exists public.p101_opencall_registration_links (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.p101_opencall_events(id),
  source_name text not null check (char_length(source_name) between 1 and 160),
  token_hash  text not null unique,   -- raw token lives only in the shared URL
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,   -- also the expiry given to invites it issues
  disabled_at timestamptz,
  created_by  text
);

create index if not exists p101_opencall_registration_links_event_idx
  on public.p101_opencall_registration_links (event_id, created_at desc);

alter table public.p101_opencall_registration_links enable row level security;
revoke all on public.p101_opencall_registration_links from anon, authenticated;

alter table public.p101_opencall_rep_invites
  add column if not exists registered_via uuid
    references public.p101_opencall_registration_links(id),
  add column if not exists rep_role text
    check (rep_role is null or char_length(rep_role) <= 120);

create index if not exists p101_opencall_rep_invites_registered_via_idx
  on public.p101_opencall_rep_invites (registered_via)
  where registered_via is not null;

-- Case-insensitive lookup used to dedupe registrations per event.
create index if not exists p101_opencall_rep_invites_event_email_idx
  on public.p101_opencall_rep_invites (event_id, lower(rep_email));

-- New access-log actions (no application context, like session_start).
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
      'request_introduction',
      'rep_registered',
      'registration_resent'
    ));

alter table public.p101_opencall_access_log
  drop constraint if exists p101_opencall_access_log_application_required_check;

alter table public.p101_opencall_access_log
  add constraint p101_opencall_access_log_application_required_check
    check (
      action in ('session_start', 'invite_redeemed', 'access_denied', 'invite_revoked',
                 'rep_registered', 'registration_resent')
      or application_id is not null
    );

commit;
