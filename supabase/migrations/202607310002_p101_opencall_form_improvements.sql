begin;

-- Family form improvements: adds two new optional fields to the Open Call
-- application. Everything else in this change (headshot/slate/reel/other-
-- video/casting-profile copy and relabeling, gender restructuring, ethnicity
-- relabel) is UI/instructional only and needs no schema change.

-- Preferred Pronouns (optional) — free text of the selected option value
-- (he_him / she_her / they_them / other / prefer_not_to_say), not required.
alter table public.p101_opencall_applications
  add column if not exists pronouns text
    check (pronouns is null or char_length(pronouns) <= 40);

-- Additional Links (optional) — repeatable label+url rows, e.g.
-- [{"label":"IMDb","url":"https://..."}]. Not required for submission.
alter table public.p101_opencall_applications
  add column if not exists additional_links jsonb not null default '[]'::jsonb;

commit;
