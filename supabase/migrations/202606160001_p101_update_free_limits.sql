begin;

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
      if jsonb_array_length(new.content->'headshots') > 3 then
        raise exception 'Free tier is limited to 3 headshots.' using errcode = 'P0001';
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

commit;
