begin;

-- Add requester identity fields to p101_opencall_intro_requests.
-- These capture who actually submitted the introduction request,
-- which may differ from the named invite recipient when a link is
-- shared internally within an office.
--
-- requester_name and requester_email are collected via a form that
-- is prefilled from the invite but must be confirmed by the viewer.
-- Table has 0 rows at migration time (no backfill required).

alter table public.p101_opencall_intro_requests
  add column requester_name    text not null,
  add column requester_email   text not null,
  add column requester_role    text,
  add column requester_message text;

comment on column public.p101_opencall_intro_requests.requester_name is
  'Name of the person submitting the request; collected in the form, pre-filled from invite but editable';

comment on column public.p101_opencall_intro_requests.requester_email is
  'Contact email of the requester; used as Reply-To on the guardian notification';

comment on column public.p101_opencall_intro_requests.requester_role is
  'Optional role or title (e.g. Manager, Assistant)';

comment on column public.p101_opencall_intro_requests.requester_message is
  'Optional personal note visible to the family';

commit;
