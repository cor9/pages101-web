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

create table if not exists public.p101_promo_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  label            text,
  description      text,
  plan             text not null default 'plus' check (plan in ('free', 'plus')),
  status           text not null default 'active' check (status in ('active', 'inactive')),
  duration_days    integer check (duration_days is null or duration_days > 0),
  max_redemptions  integer check (max_redemptions is null or max_redemptions > 0),
  redemptions_count integer not null default 0 check (redemptions_count >= 0),
  starts_at        timestamptz,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint p101_promo_codes_code_upper check (code = upper(trim(code)))
);

create table if not exists public.p101_promo_redemptions (
  id                   uuid primary key default gen_random_uuid(),
  promo_code_id        uuid not null references public.p101_promo_codes(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  code                 text not null,
  granted_plan         text not null check (granted_plan in ('free', 'plus')),
  granted_duration_days integer,
  redeemed_at          timestamptz not null default now(),
  unique (promo_code_id, user_id)
);

create index if not exists p101_promo_redemptions_user_id_idx
  on public.p101_promo_redemptions (user_id, redeemed_at desc);

drop trigger if exists p101_promo_codes_updated_at on public.p101_promo_codes;
create trigger p101_promo_codes_updated_at
  before update on public.p101_promo_codes
  for each row execute function public.p101_set_updated_at();

alter table public.p101_promo_codes enable row level security;
alter table public.p101_promo_redemptions enable row level security;

drop policy if exists "owners read own promo redemptions" on public.p101_promo_redemptions;

create policy "owners read own promo redemptions"
  on public.p101_promo_redemptions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.p101_redeem_promo_code(input_code text, redeeming_user_id uuid)
returns table (
  plan text,
  status text,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  code_row public.p101_promo_codes%rowtype;
  existing_subscription public.p101_subscriptions%rowtype;
  next_period_end timestamptz;
begin
  normalized_code := upper(trim(coalesce(input_code, '')));

  if normalized_code = '' then
    raise exception 'Please enter a code.' using errcode = 'P0001';
  end if;

  select *
  into code_row
  from public.p101_promo_codes
  where code = normalized_code
  for update;

  if not found or code_row.status <> 'active' then
    raise exception 'That code is invalid or inactive.' using errcode = 'P0001';
  end if;

  if code_row.starts_at is not null and now() < code_row.starts_at then
    raise exception 'That code is not active yet.' using errcode = 'P0001';
  end if;

  if code_row.expires_at is not null and now() > code_row.expires_at then
    raise exception 'That code has expired.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.p101_promo_redemptions
    where promo_code_id = code_row.id
      and user_id = redeeming_user_id
  ) then
    raise exception 'That code has already been redeemed on this account.' using errcode = 'P0001';
  end if;

  if code_row.max_redemptions is not null and code_row.redemptions_count >= code_row.max_redemptions then
    raise exception 'That code has reached its redemption limit.' using errcode = 'P0001';
  end if;

  select *
  into existing_subscription
  from public.p101_subscriptions
  where user_id = redeeming_user_id;

  if code_row.duration_days is null then
    next_period_end := existing_subscription.current_period_end;
  else
    next_period_end := greatest(coalesce(existing_subscription.current_period_end, now()), now())
      + make_interval(days => code_row.duration_days);
  end if;

  insert into public.p101_promo_redemptions (
    promo_code_id,
    user_id,
    code,
    granted_plan,
    granted_duration_days
  )
  values (
    code_row.id,
    redeeming_user_id,
    code_row.code,
    code_row.plan,
    code_row.duration_days
  );

  update public.p101_promo_codes
  set redemptions_count = redemptions_count + 1
  where id = code_row.id;

  insert into public.p101_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_end,
    updated_at
  )
  values (
    redeeming_user_id,
    existing_subscription.stripe_customer_id,
    existing_subscription.stripe_subscription_id,
    code_row.plan,
    'active',
    next_period_end,
    now()
  )
  on conflict (user_id) do update
  set
    stripe_customer_id = coalesce(p101_subscriptions.stripe_customer_id, excluded.stripe_customer_id),
    stripe_subscription_id = coalesce(p101_subscriptions.stripe_subscription_id, excluded.stripe_subscription_id),
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    updated_at = now();

  return query
  select
    p101_subscriptions.plan,
    p101_subscriptions.status,
    p101_subscriptions.current_period_end
  from public.p101_subscriptions
  where user_id = redeeming_user_id;
end;
$$;

revoke all on function public.p101_redeem_promo_code(text, uuid) from public;
grant execute on function public.p101_redeem_promo_code(text, uuid) to service_role;

commit;
