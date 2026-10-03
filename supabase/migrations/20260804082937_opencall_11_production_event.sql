-- Open Call 11 production lifecycle. Test fixtures must never be selected by
-- the public event endpoint; this is the real, family-facing event.
insert into public.p101_opencall_events (
  year,
  name,
  status,
  is_test,
  submits_open,
  submits_close,
  review_close
)
values (
  2026,
  'Open Call 11',
  'open',
  false,
  '2026-08-04 00:00:00-07'::timestamptz,
  '2026-09-07 23:59:59-07'::timestamptz,
  '2026-09-21 23:59:59-07'::timestamptz
)
on conflict (year) do update
set
  name = excluded.name,
  status = excluded.status,
  is_test = excluded.is_test,
  submits_open = excluded.submits_open,
  submits_close = excluded.submits_close,
  review_close = excluded.review_close;

-- The Phase 1 staging fixture predates the is_test column. Keep it available
-- for internal testing without allowing it to become the public event.
update public.p101_opencall_events
set is_test = true
where year = 9999
  and name = '[TEST] Open Call Phase 1 Staging Fixture';
