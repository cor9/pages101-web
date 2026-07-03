begin;

alter table if exists public.p101_actor_pages
  add column if not exists relay_recipient_email text;

alter table if exists public.p101_actor_pages
  drop constraint if exists p101_actor_pages_relay_recipient_email_check;

alter table if exists public.p101_actor_pages
  add constraint p101_actor_pages_relay_recipient_email_check
    check (relay_recipient_email is null or char_length(relay_recipient_email) <= 254);

commit;
