begin;

-- Post-Open Call follow-up survey for submitting families.
--
-- Design notes
--   * Responses are NOT linked to p101_opencall_applications, guardians, or
--     auth users. There is deliberately no application_id / user_id / email /
--     IP / user-agent column, so an "anonymous" response is anonymous in the
--     database, not just in the UI.
--   * Non-anonymous responses carry only the actor name the parent typed in.
--   * Rows are written by the /api/opencall/survey route with the service role.
--     RLS is enabled with no policies, so anon/authenticated clients can do
--     nothing with this table directly.
--   * Counts are stored as integers where the form offers a top-coded bucket:
--     meetings_count 4 = "4+", offers_count 3 = "3+".

create table if not exists public.p101_opencall_survey_responses (
  id                   uuid primary key default gen_random_uuid(),
  event_id             uuid not null references public.p101_opencall_events(id),
  submitted_on         date not null default (now() at time zone 'America/Los_Angeles')::date,

  is_anonymous         boolean not null,
  actor_name           text,

  prior_representation text not null
    check (prior_representation in ('none','agent_only','manager_only','both')),

  reps_contacted       text not null
    check (reps_contacted in ('yes','no','unsure')),
  rep_contact_count    text
    check (rep_contact_count in ('1','2','3','4','5_plus','unsure')),
  outcomes             text[] not null default '{}',
  meetings_count       smallint check (meetings_count between 0 and 4),
  offers_count         smallint check (offers_count between 0 and 3),
  signed_with          text,

  prepared_submission  smallint not null check (prepared_submission between 1 and 5),
  prepared_next_step   smallint check (prepared_next_step between 1 and 5),
  next_step_not_applicable boolean not null default false,

  support_gaps         text[] not null default '{}',
  top_improvement      text not null,
  additional_comments  text,
  share_consent        text not null
    check (share_consent in ('first_names','anonymous','ask_first','no')),

  -- Anonymous responses must not carry a name or a first-names consent.
  constraint survey_anonymous_has_no_name
    check (not is_anonymous or (actor_name is null and share_consent <> 'first_names')),
  -- Identified responses must carry a name.
  constraint survey_identified_has_name
    check (is_anonymous or (actor_name is not null and length(actor_name) > 0)),
  -- Rep-response questions are skipped when no one made contact.
  constraint survey_no_contact_skips_rep_questions
    check (
      reps_contacted <> 'no'
      or (rep_contact_count is null and meetings_count is null
          and offers_count is null and signed_with is null
          and outcomes = '{}')
    )
);

create index if not exists p101_opencall_survey_event_idx
  on public.p101_opencall_survey_responses (event_id);

alter table public.p101_opencall_survey_responses enable row level security;

-- No policies on purpose: service role only.
revoke all on public.p101_opencall_survey_responses from anon, authenticated;

comment on table public.p101_opencall_survey_responses is
  'Post-Open Call parent follow-up survey. Intentionally unlinked from applications/guardians so anonymous responses are truly anonymous.';

-- Convenience view for reading results without exposing free text by accident.
create or replace view public.p101_opencall_survey_summary
with (security_invoker = true) as
select
  event_id,
  count(*)                                                        as responses,
  count(*) filter (where is_anonymous)                            as anonymous_responses,
  count(*) filter (where reps_contacted = 'yes')                  as contacted_yes,
  count(*) filter (where reps_contacted = 'no')                   as contacted_no,
  count(*) filter (where reps_contacted = 'unsure')               as contacted_unsure,
  count(*) filter (where 'offer'  = any(outcomes) or offers_count > 0) as got_offer,
  count(*) filter (where 'signed' = any(outcomes))                as signed,
  round(avg(prepared_submission)::numeric, 2)                     as avg_prepared_submission,
  round(avg(prepared_next_step)::numeric, 2)                      as avg_prepared_next_step,
  coalesce(sum(meetings_count), 0)                                as meetings_total_min,
  coalesce(sum(offers_count), 0)                                  as offers_total_min
from public.p101_opencall_survey_responses
group by event_id;

revoke all on public.p101_opencall_survey_summary from anon, authenticated;

commit;
