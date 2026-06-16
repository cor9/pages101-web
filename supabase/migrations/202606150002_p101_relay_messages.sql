begin;

create table if not exists public.p101_relay_messages (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references public.p101_actor_pages(id) on delete cascade,
  sender_name  text not null,
  sender_email text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists p101_relay_messages_page_idx
  on public.p101_relay_messages (page_id, created_at desc);

alter table public.p101_relay_messages
  drop constraint if exists p101_relay_messages_sender_name_check,
  drop constraint if exists p101_relay_messages_sender_email_check,
  drop constraint if exists p101_relay_messages_body_check;

alter table public.p101_relay_messages
  add constraint p101_relay_messages_sender_name_check
    check (char_length(sender_name) between 1 and 120),
  add constraint p101_relay_messages_sender_email_check
    check (char_length(sender_email) <= 254),
  add constraint p101_relay_messages_body_check
    check (char_length(body) between 1 and 2000);

alter table public.p101_relay_messages enable row level security;

drop policy if exists "no anon relay inserts" on public.p101_relay_messages;
drop policy if exists "owner read relay messages" on public.p101_relay_messages;

create policy "owner read relay messages"
  on public.p101_relay_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.p101_actor_pages
      where p101_actor_pages.id = p101_relay_messages.page_id
        and p101_actor_pages.user_id = auth.uid()
    )
  );

commit;
