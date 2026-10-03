begin;

-- Post-Open Call follow-up survey for submitting families.
--
-- Two separate concepts:
--
--   1. PARTICIPATION: p101_opencall_survey_invites. One row per submitted
--      application. Says "this family was invited / completed it". Used for
--      response rates, duplicate prevention and reminders. Never says what
--      they answered.
--
--   2. SURVEY DATA: p101_opencall_survey_responses.
--        - Named responses carry application_id + invite_id, so they can be
--          analysed against the submission (and edited later via the same link).
--        - Anonymous responses carry NEITHER. No application, invite, actor,
--          name, email, token, IP or user agent. After submission they cannot
--          be joined back to an invite. submitted_on is truncated to the week
--          so a timestamp can't be matched to invites.completed_at.
--
-- Rows are written only by the /api/opencall/survey route (service role).
-- RLS is on with no policies; anon/authenticated can do nothing directly.

create table if not exists public.p101_opencall_survey_invites (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.p101_opencall_events(id),
  application_id    uuid not null references public.p101_opencall_applications(id) on delete cascade,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  reminder_sent_at  timestamptz,
  completed_at      timestamptz,
  unique (application_id)
);

create index if not exists p101_opencall_survey_invites_event_idx
  on public.p101_opencall_survey_invites (event_id);

create table if not exists public.p101_opencall_survey_responses (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.p101_opencall_events(id),

  -- NULL for anonymous responses, by constraint below.
  application_id       uuid references public.p101_opencall_applications(id) on delete set null,
  invite_id            uuid references public.p101_opencall_survey_invites(id) on delete set null,

  is_anonymous         boolean not null,
  -- Day for named responses, start of week for anonymous ones.
  submitted_on         date not null,
  updated_at           timestamptz,
  -- Only set when an otherwise-anonymous respondent volunteered contact info,
  -- which makes the response named (and linked).
  followup_contact     text check (char_length(followup_contact) <= 254),

  prior_representation text not null
    check (prior_representation in ('none','agent_only','manager_only','both')),

  reps_contacted       text not null
    check (reps_contacted in ('yes','no','unsure')),
  rep_contact_count    text
    check (rep_contact_count in ('1','2','3','4','5_plus','unsure')),
  outcomes             text[] not null default '{}',
  meetings_count       smallint check (meetings_count between 0 and 4),   -- 4 = "4+"
  offers_count         smallint check (offers_count between 0 and 3),     -- 3 = "3+"
  signed_with          text check (char_length(signed_with) <= 200),

  -- Looking back: how ready was the SUBMISSION for representative review?
  prepared_submission  smallint not null check (prepared_submission between 1 and 5),
  -- Only when a rep made contact: how ready was the FAMILY for the next step?
  prepared_next_step   smallint check (prepared_next_step between 1 and 5),

  support_gaps         text[] not null default '{}',
  top_improvement      text,
  additional_comments  text,
  share_consent        text not null
    check (share_consent in ('first_names','anonymous','ask_first','no')),

  constraint survey_anonymous_is_unlinked
    check (not is_anonymous
           or (application_id is null and invite_id is null and followup_contact is null)),
  constraint survey_named_is_linked
    check (is_anonymous or (application_id is not null and invite_id is not null)),
  constraint survey_anonymous_consent
    check (not is_anonymous or share_consent in ('anonymous','no')),
  -- Rep-response questions are only asked when a rep made contact.
  constraint survey_rep_questions_only_if_contacted
    check (
      reps_contacted = 'yes'
      or (rep_contact_count is null and meetings_count is null and offers_count is null
          and signed_with is null and prepared_next_step is null and outcomes = '{}')
    )
);

-- One response per invite (this is what makes named responses editable in place).
create unique index if not exists p101_opencall_survey_one_per_invite
  on public.p101_opencall_survey_responses (invite_id) where invite_id is not null;

create index if not exists p101_opencall_survey_responses_event_idx
  on public.p101_opencall_survey_responses (event_id);

alter table public.p101_opencall_survey_invites   enable row level security;
alter table public.p101_opencall_survey_responses enable row level security;

revoke all on public.p101_opencall_survey_invites   from anon, authenticated;
revoke all on public.p101_opencall_survey_responses from anon, authenticated;

comment on table public.p101_opencall_survey_invites is
  'Participation tracking only. Never joined to anonymous survey responses.';
comment on table public.p101_opencall_survey_responses is
  'Survey data. Anonymous rows have no application/invite link by constraint.';

-- Participation view: response rate without touching any answers.
create or replace view public.p101_opencall_survey_participation
with (security_invoker = true) as
select
  event_id,
  count(*)                                         as invited,
  count(sent_at)                                   as sent,
  count(completed_at)                              as completed,
  round(100.0 * count(completed_at) / nullif(count(*), 0), 1) as completion_pct
from public.p101_opencall_survey_invites
group by event_id;

-- Results view: aggregates across ALL responses (named + anonymous).
create or replace view public.p101_opencall_survey_summary
with (security_invoker = true) as
select
  event_id,
  count(*)                                                         as responses,
  count(*) filter (where is_anonymous)                             as anonymous_responses,
  count(*) filter (where reps_contacted = 'yes')                   as contacted_yes,
  count(*) filter (where reps_contacted = 'no')                    as contacted_no,
  count(*) filter (where reps_contacted = 'unsure')                as contacted_unsure,
  count(*) filter (where 'offer'  = any(outcomes) or offers_count > 0) as got_offer,
  count(*) filter (where 'signed' = any(outcomes))                 as signed,
  round(avg(prepared_submission)::numeric, 2)                      as avg_submission_prepared,
  round(avg(prepared_next_step)::numeric, 2)                       as avg_next_step_prepared,
  coalesce(sum(meetings_count), 0)                                 as meetings_total_min,
  coalesce(sum(offers_count), 0)                                   as offers_total_min
from public.p101_opencall_survey_responses
group by event_id;

revoke all on public.p101_opencall_survey_participation from anon, authenticated;
revoke all on public.p101_opencall_survey_summary       from anon, authenticated;

commit;
