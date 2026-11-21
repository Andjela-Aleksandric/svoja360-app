-- Weekly running target can be set in minutes as well as kilometres.
alter table public.running_weeks
  add column if not exists target_minutes int check (target_minutes is null or target_minutes between 0 and 3000);

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
    insert into public.running_weeks (id, program_id, week_number, target_km, target_minutes, notes)
    values ((w ->> 'id')::uuid, pid, (w ->> 'week_number')::smallint, nullif(w ->> 'target_km', '')::numeric, nullif(w ->> 'target_minutes', '')::int, nullif(w ->> 'notes', ''))
    on conflict (id) do update set week_number = excluded.week_number, target_km = excluded.target_km, target_minutes = excluded.target_minutes, notes = excluded.notes
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
    insert into public.running_weeks (id, program_id, week_number, target_km, target_minutes, notes) values (new_w, new_id, w.week_number, w.target_km, w.target_minutes, w.notes);
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

notify pgrst, 'reload schema';
