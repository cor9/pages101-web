-- Phase 2 fixture safety: demote the year=9999 staging fixture to draft so it
-- is never returned by public event queries (which filter on open/reviewing/closed).
-- Tests that need an open event must set it explicitly and clean up afterward.
update public.p101_opencall_events
set status = 'draft'
where year = 9999;
