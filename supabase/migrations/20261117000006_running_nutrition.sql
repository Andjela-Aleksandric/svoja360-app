-- Running and nutrition: atomic save/copy of program trees (run as the caller, RLS applies).

create or replace function public.save_running_program(p jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid := (p ->> 'id')::uuid;
  w jsonb; wo jsonb; s jsonb;
  week_ids uuid[] := '{}'; wo_ids uuid[] := '{}'; seg_ids uuid[] := '{}';
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.running_programs set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
    start_date = nullif(p ->> 'start_date', '')::date,
    zones = coalesce(p -> 'zones', '[]'::jsonb)
  where id = pid;
  if not found then raise exception 'program_not_found' using errcode = 'P0002'; end if;

  for w in select * from jsonb_array_elements(coalesce(p -> 'weeks', '[]')) loop
    week_ids := week_ids || (w ->> 'id')::uuid;
    for wo in select * from jsonb_array_elements(coalesce(w -> 'workouts', '[]')) loop
      wo_ids := wo_ids || (wo ->> 'id')::uuid;
      for s in select * from jsonb_array_elements(coalesce(wo -> 'segments', '[]')) loop
        seg_ids := seg_ids || (s ->> 'id')::uuid;
      end loop;
    end loop;
  end loop;

  delete from public.running_segments where program_id = pid and not (id = any(seg_ids));
  delete from public.running_workouts where program_id = pid and not (id = any(wo_ids));
  delete from public.running_weeks where program_id = pid and not (id = any(week_ids));

  for w in select * from jsonb_array_elements(coalesce(p -> 'weeks', '[]')) loop
    insert into public.running_weeks (id, program_id, week_number, target_km, notes)
    values ((w ->> 'id')::uuid, pid, (w ->> 'week_number')::smallint, nullif(w ->> 'target_km', '')::numeric, nullif(w ->> 'notes', ''))
    on conflict (id) do update set week_number = excluded.week_number, target_km = excluded.target_km, notes = excluded.notes
      where public.running_weeks.program_id = pid;
    for wo in select * from jsonb_array_elements(coalesce(w -> 'workouts', '[]')) loop
      insert into public.running_workouts (id, program_id, week_id, day_of_week, scheduled_date, workout_type, title, notes, position)
      values ((wo ->> 'id')::uuid, pid, (w ->> 'id')::uuid, nullif(wo ->> 'day_of_week', '')::smallint, nullif(wo ->> 'scheduled_date', '')::date,
              wo ->> 'workout_type', coalesce(nullif(btrim(wo ->> 'title'), ''), 'Trčanje'), nullif(wo ->> 'notes', ''), coalesce((wo ->> 'position')::smallint, 0))
      on conflict (id) do update set week_id = excluded.week_id, day_of_week = excluded.day_of_week, scheduled_date = excluded.scheduled_date,
        workout_type = excluded.workout_type, title = excluded.title, notes = excluded.notes, position = excluded.position
        where public.running_workouts.program_id = pid;
      for s in select * from jsonb_array_elements(coalesce(wo -> 'segments', '[]')) loop
        insert into public.running_segments (id, program_id, workout_id, position, segment_type, repeat_count, duration_s, distance_m,
          pace_min_s_km, pace_max_s_km, hr_min, hr_max, power_min, power_max, recovery_s, instructions)
        values ((s ->> 'id')::uuid, pid, (wo ->> 'id')::uuid, coalesce((s ->> 'position')::smallint, 0), s ->> 'segment_type',
          coalesce((s ->> 'repeat_count')::smallint, 1), nullif(s ->> 'duration_s', '')::int, nullif(s ->> 'distance_m', '')::int,
          nullif(s ->> 'pace_min_s_km', '')::int, nullif(s ->> 'pace_max_s_km', '')::int, nullif(s ->> 'hr_min', '')::smallint, nullif(s ->> 'hr_max', '')::smallint,
          nullif(s ->> 'power_min', '')::smallint, nullif(s ->> 'power_max', '')::smallint, nullif(s ->> 'recovery_s', '')::int, nullif(s ->> 'instructions', ''))
        on conflict (id) do update set workout_id = excluded.workout_id, position = excluded.position, segment_type = excluded.segment_type,
          repeat_count = excluded.repeat_count, duration_s = excluded.duration_s, distance_m = excluded.distance_m, pace_min_s_km = excluded.pace_min_s_km,
          pace_max_s_km = excluded.pace_max_s_km, hr_min = excluded.hr_min, hr_max = excluded.hr_max, power_min = excluded.power_min,
          power_max = excluded.power_max, recovery_s = excluded.recovery_s, instructions = excluded.instructions
          where public.running_segments.program_id = pid;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.save_running_program(jsonb) from public, anon;
grant execute on function public.save_running_program(jsonb) to authenticated;

create or replace function public.copy_running_program(p_source uuid, p_client uuid, p_name text, p_start date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_id uuid := gen_random_uuid(); w record; wo record; new_w uuid; new_wo uuid;
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.running_programs (id, client_id, name, description, start_date, status, zones)
  select new_id, p_client, coalesce(nullif(btrim(p_name), ''), name), description, p_start, 'draft', zones from public.running_programs where id = p_source;
  if not found then raise exception 'program_not_found' using errcode = 'P0002'; end if;
  for w in select * from public.running_weeks where program_id = p_source order by week_number loop
    new_w := gen_random_uuid();
    insert into public.running_weeks (id, program_id, week_number, target_km, notes) values (new_w, new_id, w.week_number, w.target_km, w.notes);
    for wo in select * from public.running_workouts where week_id = w.id order by position loop
      new_wo := gen_random_uuid();
      insert into public.running_workouts (id, program_id, week_id, day_of_week, scheduled_date, workout_type, title, notes, position)
      values (new_wo, new_id, new_w, wo.day_of_week, null, wo.workout_type, wo.title, wo.notes, wo.position);
      insert into public.running_segments (program_id, workout_id, position, segment_type, repeat_count, duration_s, distance_m, pace_min_s_km, pace_max_s_km, hr_min, hr_max, power_min, power_max, recovery_s, instructions)
      select new_id, new_wo, position, segment_type, repeat_count, duration_s, distance_m, pace_min_s_km, pace_max_s_km, hr_min, hr_max, power_min, power_max, recovery_s, instructions
      from public.running_segments where workout_id = wo.id;
    end loop;
  end loop;
  return new_id;
end $$;
revoke all on function public.copy_running_program(uuid, uuid, text, date) from public, anon;
grant execute on function public.copy_running_program(uuid, uuid, text, date) to authenticated;

-- Nutrition plan: plan targets, days, meals, foods and alternatives in one transaction.
create or replace function public.save_nutrition_plan(p jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid := (p ->> 'id')::uuid;
  d jsonb; m jsonb; i jsonb;
  day_ids uuid[] := '{}'; meal_ids uuid[] := '{}'; item_ids uuid[] := '{}';
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.nutrition_plans set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    kcal_target = nullif(p ->> 'kcal_target', '')::int, protein_g = nullif(p ->> 'protein_g', '')::int,
    carbs_g = nullif(p ->> 'carbs_g', '')::int, fat_g = nullif(p ->> 'fat_g', '')::int,
    notes = nullif(btrim(coalesce(p ->> 'notes', '')), ''), start_date = nullif(p ->> 'start_date', '')::date
  where id = pid;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;

  for d in select * from jsonb_array_elements(coalesce(p -> 'days', '[]')) loop
    day_ids := day_ids || (d ->> 'id')::uuid;
    for m in select * from jsonb_array_elements(coalesce(d -> 'meals', '[]')) loop
      meal_ids := meal_ids || (m ->> 'id')::uuid;
      for i in select * from jsonb_array_elements(coalesce(m -> 'items', '[]')) loop
        item_ids := item_ids || (i ->> 'id')::uuid;
      end loop;
    end loop;
  end loop;

  delete from public.meal_items where plan_id = pid and not (id = any(item_ids));
  delete from public.meals where plan_id = pid and not (id = any(meal_ids));
  delete from public.nutrition_plan_days where plan_id = pid and not (id = any(day_ids));

  for d in select * from jsonb_array_elements(coalesce(p -> 'days', '[]')) loop
    insert into public.nutrition_plan_days (id, plan_id, position, name, notes)
    values ((d ->> 'id')::uuid, pid, coalesce((d ->> 'position')::smallint, 0), coalesce(nullif(btrim(d ->> 'name'), ''), 'Dan'), nullif(d ->> 'notes', ''))
    on conflict (id) do update set position = excluded.position, name = excluded.name, notes = excluded.notes where public.nutrition_plan_days.plan_id = pid;
    for m in select * from jsonb_array_elements(coalesce(d -> 'meals', '[]')) loop
      insert into public.meals (id, plan_id, plan_day_id, is_template, position, name, meal_time, instructions)
      values ((m ->> 'id')::uuid, pid, (d ->> 'id')::uuid, false, coalesce((m ->> 'position')::smallint, 0), coalesce(nullif(btrim(m ->> 'name'), ''), 'Obrok'),
              nullif(m ->> 'meal_time', '')::time, nullif(m ->> 'instructions', ''))
      on conflict (id) do update set plan_day_id = excluded.plan_day_id, position = excluded.position, name = excluded.name,
        meal_time = excluded.meal_time, instructions = excluded.instructions where public.meals.plan_id = pid;
      -- Main items first, then alternatives that point at them.
      for i in select * from jsonb_array_elements(coalesce(m -> 'items', '[]')) x order by (x ->> 'alternative_to') is not null loop
        insert into public.meal_items (id, meal_id, plan_id, food_id, quantity_g, alternative_to, position, notes)
        values ((i ->> 'id')::uuid, (m ->> 'id')::uuid, pid, (i ->> 'food_id')::uuid, (i ->> 'quantity_g')::numeric,
                nullif(i ->> 'alternative_to', '')::uuid, coalesce((i ->> 'position')::smallint, 0), nullif(i ->> 'notes', ''))
        on conflict (id) do update set meal_id = excluded.meal_id, food_id = excluded.food_id, quantity_g = excluded.quantity_g,
          alternative_to = excluded.alternative_to, position = excluded.position, notes = excluded.notes where public.meal_items.plan_id = pid;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.save_nutrition_plan(jsonb) from public, anon;
grant execute on function public.save_nutrition_plan(jsonb) to authenticated;

create or replace function public.copy_nutrition_plan(p_source uuid, p_client uuid, p_name text, p_start date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_id uuid := gen_random_uuid(); d record; m record; it record; new_d uuid; new_m uuid; map jsonb;
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.nutrition_plans (id, client_id, name, kcal_target, protein_g, carbs_g, fat_g, notes, status, start_date)
  select new_id, p_client, coalesce(nullif(btrim(p_name), ''), name), kcal_target, protein_g, carbs_g, fat_g, notes, 'draft', p_start
  from public.nutrition_plans where id = p_source;
  if not found then raise exception 'plan_not_found' using errcode = 'P0002'; end if;
  for d in select * from public.nutrition_plan_days where plan_id = p_source order by position loop
    new_d := gen_random_uuid();
    insert into public.nutrition_plan_days (id, plan_id, position, name, notes) values (new_d, new_id, d.position, d.name, d.notes);
    for m in select * from public.meals where plan_day_id = d.id order by position loop
      new_m := gen_random_uuid(); map := '{}'::jsonb;
      insert into public.meals (id, plan_id, plan_day_id, is_template, position, name, meal_time, instructions)
      values (new_m, new_id, new_d, false, m.position, m.name, m.meal_time, m.instructions);
      for it in select * from public.meal_items where meal_id = m.id order by (alternative_to is not null), position loop
        map := map || jsonb_build_object(it.id::text, gen_random_uuid());
        insert into public.meal_items (id, meal_id, plan_id, food_id, quantity_g, alternative_to, position, notes)
        values ((map ->> it.id::text)::uuid, new_m, new_id, it.food_id, it.quantity_g,
                case when it.alternative_to is null then null else (map ->> it.alternative_to::text)::uuid end, it.position, it.notes);
      end loop;
    end loop;
  end loop;
  return new_id;
end $$;
revoke all on function public.copy_nutrition_plan(uuid, uuid, text, date) from public, anon;
grant execute on function public.copy_nutrition_plan(uuid, uuid, text, date) to authenticated;
