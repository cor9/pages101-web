-- Open Call: private per-invite notes on applications.
--
-- A rep (or an office sharing one link) can keep free-text notes on each
-- submission — meeting times, impressions, follow-ups. Notes are scoped to
-- the invite that wrote them: never shown to families, other offices, or
-- through any public view. Service-role only, like favorites.

begin;

create table if not exists public.p101_opencall_rep_notes (
  id             uuid        primary key default gen_random_uuid(),
  invite_id      uuid        not null references public.p101_opencall_rep_invites(id) on delete restrict,
  event_id       uuid        not null references public.p101_opencall_events(id) on delete restrict,
  application_id uuid        not null references public.p101_opencall_applications(id) on delete cascade,
  body           text        not null check (char_length(body) between 1 and 4000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (invite_id, application_id)
);

create index if not exists p101_opencall_rep_notes_invite_idx
  on public.p101_opencall_rep_notes (invite_id, updated_at desc);

create index if not exists p101_opencall_rep_notes_application_idx
  on public.p101_opencall_rep_notes (application_id);

alter table public.p101_opencall_rep_notes enable row level security;
revoke all on public.p101_opencall_rep_notes from anon, authenticated;

drop trigger if exists p101_opencall_rep_notes_updated_at on public.p101_opencall_rep_notes;
create trigger p101_opencall_rep_notes_updated_at
  before update on public.p101_opencall_rep_notes
  for each row execute function public.p101_set_updated_at();

-- Access-log actions for note writes (application-scoped).
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
      'registration_resent',
      'save_note',
      'delete_note'
    ));

commit;
