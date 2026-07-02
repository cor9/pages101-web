begin;

create or replace function public.p101_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.p101_subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan                   text not null default 'free' check (plan in ('free', 'plus')),
  status                 text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

drop trigger if exists p101_subscriptions_updated_at on public.p101_subscriptions;
create trigger p101_subscriptions_updated_at
  before update on public.p101_subscriptions
  for each row execute function public.p101_set_updated_at();

alter table public.p101_subscriptions enable row level security;

drop policy if exists "owner read own subscriptions" on public.p101_subscriptions;

create policy "owner read own subscriptions"
  on public.p101_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.p101_subscriptions to authenticated;

commit;
