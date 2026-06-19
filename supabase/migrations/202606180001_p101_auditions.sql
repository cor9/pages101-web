begin;

create table if not exists public.p101_auditions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  page_id              uuid not null references public.p101_actor_pages(id) on delete cascade,
  project              text not null,
  role                 text,
  casting_contact      text,
  project_type         text check (
    project_type in (
      'film',
      'tv',
      'commercial',
      'theater',
      'voiceover',
      'industrial',
      'student_film',
      'new_media',
      'print',
      'other'
    )
  ),
  role_size            text check (
    role_size in (
      'series_regular',
      'recurring',
      'guest_star',
      'co_star',
      'lead',
      'supporting',
      'principal',
      'featured',
      'background',
      'ensemble',
      'other'
    )
  ),
  audition_date        date,
  format               text check (
    format in (
      'self_tape',
      'in_person',
      'virtual'
    )
  ),
  audition_stage       text check (
    audition_stage in (
      'initial',
      'callback',
      'producer_session',
      'chemistry_read',
      'work_session',
      'final_callback',
      'network_test'
    )
  ),
  outcome              text check (
    outcome in (
      'pending',
      'callback',
      'avail_check',
      'booked',
      'released',
      'no_word'
    )
  ),
  received_from        text check (
    received_from in (
      'self_submit',
      'agency',
      'management',
      'cd_direct',
      'other'
    )
  ),
  received_from_detail text,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists p101_auditions_user_id_idx
  on public.p101_auditions (user_id);

create index if not exists p101_auditions_page_id_idx
  on public.p101_auditions (page_id);

create index if not exists p101_auditions_audition_date_idx
  on public.p101_auditions (audition_date desc);

create or replace function public.p101_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists p101_auditions_updated_at on public.p101_auditions;
create trigger p101_auditions_updated_at
  before update on public.p101_auditions
  for each row execute function public.p101_set_updated_at();

create or replace function public.p101_enforce_free_audition_limit()
returns trigger
language plpgsql
as $$
declare
  user_plan text;
  audition_count bigint;
begin
  select coalesce(
    (
      select p101_subscriptions.plan
      from public.p101_subscriptions
      where p101_subscriptions.user_id = new.user_id
        and p101_subscriptions.status in ('active', 'trialing')
    ),
    'free'
  )
  into user_plan;

  if user_plan = 'free' then
    select count(*)
    into audition_count
    from public.p101_auditions
    where p101_auditions.user_id = new.user_id;

    if audition_count >= 5 then
      raise exception 'Free tier is limited to 5 auditions. Upgrade to Plus for unlimited audition tracking.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists p101_auditions_enforce_free_limit on public.p101_auditions;
create trigger p101_auditions_enforce_free_limit
  before insert on public.p101_auditions
  for each row execute function public.p101_enforce_free_audition_limit();

alter table public.p101_auditions enable row level security;

drop policy if exists "owner read own auditions" on public.p101_auditions;
drop policy if exists "owner manage own auditions" on public.p101_auditions;

create policy "owner read own auditions"
  on public.p101_auditions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "owner manage own auditions"
  on public.p101_auditions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.p101_actor_pages
      where p101_actor_pages.id = p101_auditions.page_id
        and p101_actor_pages.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.p101_auditions to authenticated;

commit;
