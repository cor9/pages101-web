begin;

create or replace function pages101.enforce_free_limits_actor_pages()
returns trigger
language plpgsql
as $$
declare
  user_plan text;
begin
  -- Get user plan (default to free)
  select coalesce(
    (select plan from pages101.subscriptions where user_id = new.user_id and status in ('active', 'trialing')),
    'free'
  ) into user_plan;

  if user_plan = 'free' then
    if new.template in ('splash', 'prestige') then
      raise exception 'Free tier cannot use premium templates.' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists actor_pages_enforce_free_limits on pages101.actor_pages;
create trigger actor_pages_enforce_free_limits
  before insert or update on pages101.actor_pages
  for each row execute function pages101.enforce_free_limits_actor_pages();


create or replace function pages101.enforce_free_limits_page_sections()
returns trigger
language plpgsql
as $$
declare
  user_plan text;
begin
  -- Get user plan using the page_id
  select coalesce(
    (select s.plan from pages101.subscriptions s
     join pages101.actor_pages p on p.user_id = s.user_id
     where p.id = new.page_id and s.status in ('active', 'trialing')),
    'free'
  ) into user_plan;

  if user_plan = 'free' then
    if new.type = 'headshots' then
      if jsonb_array_length(new.content->'headshots') > 6 then
        raise exception 'Free tier is limited to 6 headshots.' using errcode = 'P0001';
      end if;
    elsif new.type = 'clips' then
      if jsonb_array_length(new.content->'clips') > 2 then
        raise exception 'Free tier is limited to 2 clips.' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists page_sections_enforce_free_limits on pages101.page_sections;
create trigger page_sections_enforce_free_limits
  before insert or update on pages101.page_sections
  for each row execute function pages101.enforce_free_limits_page_sections();

commit;
