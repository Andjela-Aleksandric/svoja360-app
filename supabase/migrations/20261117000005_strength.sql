-- Strength module: atomic save of a program tree and logging of a workout.
-- Both run as the caller (SECURITY INVOKER), so row level security still decides
-- who may write what.

-- Replaces the structure of one training program with the given tree.
-- Rows keep their ids, so logged workouts stay linked to their planned day and sets.
create or replace function public.save_training_program(p jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  pid uuid := (p ->> 'id')::uuid;
  w jsonb; d jsonb; e jsonb; s jsonb;
  week_ids uuid[] := '{}'; day_ids uuid[] := '{}'; ex_ids uuid[] := '{}'; set_ids uuid[] := '{}';
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;

  update public.training_programs set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    description = nullif(btrim(coalesce(p ->> 'description', '')), ''),
    start_date = nullif(p ->> 'start_date', '')::date
  where id = pid;
  if not found then raise exception 'program_not_found' using errcode = 'P0002'; end if;

  for w in select * from jsonb_array_elements(coalesce(p -> 'weeks', '[]')) loop
    week_ids := week_ids || (w ->> 'id')::uuid;
    for d in select * from jsonb_array_elements(coalesce(w -> 'days', '[]')) loop
      day_ids := day_ids || (d ->> 'id')::uuid;
      for e in select * from jsonb_array_elements(coalesce(d -> 'exercises', '[]')) loop
        ex_ids := ex_ids || (e ->> 'id')::uuid;
        for s in select * from jsonb_array_elements(coalesce(e -> 'sets', '[]')) loop
          set_ids := set_ids || (s ->> 'id')::uuid;
        end loop;
      end loop;
    end loop;
  end loop;

  delete from public.prescription_sets where program_id = pid and not (id = any(set_ids));
  delete from public.exercise_prescriptions where program_id = pid and not (id = any(ex_ids));
  delete from public.training_days where program_id = pid and not (id = any(day_ids));
  delete from public.training_weeks where program_id = pid and not (id = any(week_ids));

  for w in select * from jsonb_array_elements(coalesce(p -> 'weeks', '[]')) loop
    insert into public.training_weeks (id, program_id, week_number, is_deload, notes)
    values ((w ->> 'id')::uuid, pid, (w ->> 'week_number')::smallint, coalesce((w ->> 'is_deload')::boolean, false), nullif(w ->> 'notes', ''))
    on conflict (id) do update set week_number = excluded.week_number, is_deload = excluded.is_deload, notes = excluded.notes
      where public.training_weeks.program_id = pid;

    for d in select * from jsonb_array_elements(coalesce(w -> 'days', '[]')) loop
      insert into public.training_days (id, program_id, week_id, day_of_week, position, name, notes)
      values ((d ->> 'id')::uuid, pid, (w ->> 'id')::uuid, nullif(d ->> 'day_of_week', '')::smallint, coalesce((d ->> 'position')::smallint, 0),
              coalesce(nullif(btrim(d ->> 'name'), ''), 'Trening'), nullif(d ->> 'notes', ''))
      on conflict (id) do update set week_id = excluded.week_id, day_of_week = excluded.day_of_week, position = excluded.position,
        name = excluded.name, notes = excluded.notes
        where public.training_days.program_id = pid;

      for e in select * from jsonb_array_elements(coalesce(d -> 'exercises', '[]')) loop
        insert into public.exercise_prescriptions (id, program_id, day_id, exercise_id, position, superset_group, rest_seconds, tempo, notes)
        values ((e ->> 'id')::uuid, pid, (d ->> 'id')::uuid, (e ->> 'exercise_id')::uuid, coalesce((e ->> 'position')::smallint, 0),
                nullif(e ->> 'superset_group', ''), nullif(e ->> 'rest_seconds', '')::int, nullif(upper(e ->> 'tempo'), ''), nullif(e ->> 'notes', ''))
        on conflict (id) do update set day_id = excluded.day_id, exercise_id = excluded.exercise_id, position = excluded.position,
          superset_group = excluded.superset_group, rest_seconds = excluded.rest_seconds, tempo = excluded.tempo, notes = excluded.notes
          where public.exercise_prescriptions.program_id = pid;

        for s in select * from jsonb_array_elements(coalesce(e -> 'sets', '[]')) loop
          insert into public.prescription_sets (id, program_id, prescription_id, position, set_type, reps_min, reps_max, weight_kg, rir, rpe)
          values ((s ->> 'id')::uuid, pid, (e ->> 'id')::uuid, coalesce((s ->> 'position')::smallint, 0), coalesce(s ->> 'set_type', 'working'),
                  nullif(s ->> 'reps_min', '')::smallint, nullif(s ->> 'reps_max', '')::smallint, nullif(s ->> 'weight_kg', '')::numeric,
                  nullif(s ->> 'rir', '')::numeric, nullif(s ->> 'rpe', '')::numeric)
          on conflict (id) do update set prescription_id = excluded.prescription_id, position = excluded.position, set_type = excluded.set_type,
            reps_min = excluded.reps_min, reps_max = excluded.reps_max, weight_kg = excluded.weight_kg, rir = excluded.rir, rpe = excluded.rpe
            where public.prescription_sets.program_id = pid;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.save_training_program(jsonb) from public, anon;
grant execute on function public.save_training_program(jsonb) to authenticated;

-- Copies a program (structure only) to a client or as a template. Returns the new id.
create or replace function public.copy_training_program(p_source uuid, p_client uuid, p_name text, p_start date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_id uuid := gen_random_uuid();
  w record; d record; e record;
  new_w uuid; new_d uuid; new_e uuid;
begin
  if not public.is_coach() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.training_programs (id, client_id, name, description, start_date, status)
  select new_id, p_client, coalesce(nullif(btrim(p_name), ''), name), description, p_start, 'draft'
  from public.training_programs where id = p_source;
  if not found then raise exception 'program_not_found' using errcode = 'P0002'; end if;
  for w in select * from public.training_weeks where program_id = p_source order by week_number loop
    new_w := gen_random_uuid();
    insert into public.training_weeks (id, program_id, week_number, is_deload, notes) values (new_w, new_id, w.week_number, w.is_deload, w.notes);
    for d in select * from public.training_days where week_id = w.id order by position loop
      new_d := gen_random_uuid();
      insert into public.training_days (id, program_id, week_id, day_of_week, position, name, notes) values (new_d, new_id, new_w, d.day_of_week, d.position, d.name, d.notes);
      for e in select * from public.exercise_prescriptions where day_id = d.id order by position loop
        new_e := gen_random_uuid();
        insert into public.exercise_prescriptions (id, program_id, day_id, exercise_id, position, superset_group, rest_seconds, tempo, notes)
        values (new_e, new_id, new_d, e.exercise_id, e.position, e.superset_group, e.rest_seconds, e.tempo, e.notes);
        insert into public.prescription_sets (program_id, prescription_id, position, set_type, reps_min, reps_max, weight_kg, rir, rpe)
        select new_id, new_e, position, set_type, reps_min, reps_max, weight_kg, rir, rpe from public.prescription_sets where prescription_id = e.id;
      end loop;
    end loop;
  end loop;
  return new_id;
end $$;
revoke all on function public.copy_training_program(uuid, uuid, text, date) from public, anon;
grant execute on function public.copy_training_program(uuid, uuid, text, date) to authenticated;

-- Saves a whole workout (session + sets) in one go. Idempotent: the client sends
-- its own session id, so a retry after a lost connection does not duplicate anything.
create or replace function public.log_workout(p jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  sid uuid := (p ->> 'id')::uuid;
  cid uuid := public.current_client_id();
  dev timestamptz := coalesce(nullif(p ->> 'device_updated_at', '')::timestamptz, now());
  existing timestamptz;
  s jsonb;
begin
  if cid is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select device_updated_at into existing from public.workout_sessions where id = sid;
  if found and existing is not null and existing > dev then
    return sid; -- a newer version from another device is already saved
  end if;

  insert into public.workout_sessions (id, client_id, program_id, training_day_id, name, performed_on, started_at, finished_at, status, notes, device_updated_at)
  values (sid, cid, nullif(p ->> 'program_id', '')::uuid, nullif(p ->> 'training_day_id', '')::uuid,
          coalesce(nullif(btrim(p ->> 'name'), ''), 'Trening'), coalesce(nullif(p ->> 'performed_on', '')::date, current_date),
          nullif(p ->> 'started_at', '')::timestamptz, nullif(p ->> 'finished_at', '')::timestamptz,
          coalesce(p ->> 'status', 'completed'), nullif(p ->> 'notes', ''), dev)
  on conflict (id) do update set name = excluded.name, performed_on = excluded.performed_on, started_at = excluded.started_at,
    finished_at = excluded.finished_at, status = excluded.status, notes = excluded.notes, device_updated_at = excluded.device_updated_at
    where public.workout_sessions.client_id = cid;

  delete from public.workout_sets where session_id = sid;
  for s in select * from jsonb_array_elements(coalesce(p -> 'sets', '[]')) loop
    insert into public.workout_sets (session_id, exercise_id, prescription_set_id, exercise_position, position, set_type, reps, weight_kg, rir, is_completed, is_skipped, notes, completed_at)
    values (sid, (s ->> 'exercise_id')::uuid, nullif(s ->> 'prescription_set_id', '')::uuid, coalesce((s ->> 'exercise_position')::smallint, 0),
            coalesce((s ->> 'position')::smallint, 0), coalesce(s ->> 'set_type', 'working'), nullif(s ->> 'reps', '')::smallint,
            nullif(s ->> 'weight_kg', '')::numeric, nullif(s ->> 'rir', '')::numeric, coalesce((s ->> 'is_completed')::boolean, false),
            coalesce((s ->> 'is_skipped')::boolean, false), nullif(s ->> 'notes', ''), nullif(s ->> 'completed_at', '')::timestamptz);
  end loop;
  return sid;
end $$;
revoke all on function public.log_workout(jsonb) from public, anon;
grant execute on function public.log_workout(jsonb) to authenticated;
