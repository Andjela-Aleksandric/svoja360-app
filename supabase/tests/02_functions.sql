-- Tests for the RPC functions (program save/copy, workout logging, helpers).
-- Runs after 01_rls.sql, which leaves its fixtures in place.
\set ON_ERROR_STOP 1

-- Client A may not use coach functions.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
do $$ begin
  begin
    perform public.save_training_program('{"id":"a0000000-0000-0000-0000-00000000000a","name":"x","weeks":[]}'::jsonb);
    raise exception 'client must not save programs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.copy_training_program('a0000000-0000-0000-0000-00000000000a', null, 'x', null);
    raise exception 'client must not copy programs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_nutrition_plan('{"id":"a0000000-0000-0000-0000-00000000000a","name":"x","days":[]}'::jsonb);
    raise exception 'client must not save nutrition plans';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.log_coach_event('clients', 'aaaaaaaa-0000-0000-0000-00000000000a', 'EXPORT');
    raise exception 'client must not write audit events';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Client A logs a workout on their own active program (idempotent).
do $$
declare n int;
begin
  perform public.log_workout(('{"id":"e0000000-0000-0000-0000-00000000000e","program_id":"a0000000-0000-0000-0000-00000000000a","training_day_id":"a2000000-0000-0000-0000-000000000001","name":"Dan A","performed_on":"2026-11-16","status":"completed","device_updated_at":"2026-11-16T10:00:00Z","sets":[{"exercise_id":"' ||
    (select id from public.exercises where name = 'Čučanj sa šipkom') || '","exercise_position":0,"position":0,"set_type":"working","reps":8,"weight_kg":40,"is_completed":true}]}')::jsonb);
  perform public.log_workout(('{"id":"e0000000-0000-0000-0000-00000000000e","program_id":"a0000000-0000-0000-0000-00000000000a","training_day_id":"a2000000-0000-0000-0000-000000000001","name":"Dan A","performed_on":"2026-11-16","status":"completed","device_updated_at":"2026-11-16T10:05:00Z","sets":[{"exercise_id":"' ||
    (select id from public.exercises where name = 'Čučanj sa šipkom') || '","exercise_position":0,"position":0,"set_type":"working","reps":8,"weight_kg":42.5,"is_completed":true}]}')::jsonb);
  select count(*) into n from public.workout_sessions where id = 'e0000000-0000-0000-0000-00000000000e'; assert n = 1, 'retry does not duplicate the session';
  select count(*) into n from public.workout_sets where session_id = 'e0000000-0000-0000-0000-00000000000e'; assert n = 1, 'retry replaces sets';
  assert (select weight_kg from public.workout_sets where session_id = 'e0000000-0000-0000-0000-00000000000e') = 42.5, 'newer version wins';
  -- An older copy arriving late must not overwrite the newer one.
  perform public.log_workout('{"id":"e0000000-0000-0000-0000-00000000000e","name":"Dan A","performed_on":"2026-11-16","status":"completed","device_updated_at":"2026-11-16T09:00:00Z","sets":[]}');
  select count(*) into n from public.workout_sets where session_id = 'e0000000-0000-0000-0000-00000000000e'; assert n = 1, 'stale copy ignored';

  -- Logging against client B's program is rejected.
  begin
    perform public.log_workout('{"id":"e1000000-0000-0000-0000-00000000000e","program_id":"b0000000-0000-0000-0000-00000000000b","name":"x","performed_on":"2026-11-16","status":"completed","sets":[]}');
    raise exception 'client must not log against another client''s program';
  exception when insufficient_privilege then null;
  end;
  -- Contacts expose only name and phone of coaches.
  select count(*) into n from public.coach_contacts(); assert n = 2, 'two coaches listed';
end $$;
reset role;

-- Client B cannot overwrite client A's session by reusing its id.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
do $$ begin
  begin
    perform public.log_workout('{"id":"e0000000-0000-0000-0000-00000000000e","name":"hack","performed_on":"2026-11-16","status":"completed","device_updated_at":"2030-01-01T00:00:00Z","sets":[]}');
  exception when insufficient_privilege or unique_violation then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select name from public.workout_sessions where id = 'e0000000-0000-0000-0000-00000000000e') = 'Dan A', 'session of A untouched';
  assert (select count(*) from public.workout_sets where session_id = 'e0000000-0000-0000-0000-00000000000e') = 1, 'sets of A untouched';
end $$;

-- Coach saves and copies a program tree atomically.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
do $$
declare ex uuid := (select id from public.exercises where name = 'Čučanj sa šipkom'); new_id uuid; n int;
begin
  perform public.save_training_program(jsonb_build_object(
    'id', 'd0000000-0000-0000-0000-00000000000d', 'name', 'Nacrt A v2', 'description', null, 'start_date', '2026-11-16',
    'weeks', jsonb_build_array(
      jsonb_build_object('id', 'd1000000-0000-0000-0000-000000000002', 'week_number', 2, 'is_deload', false, 'days', '[]'::jsonb),
      jsonb_build_object('id', 'd1000000-0000-0000-0000-000000000001', 'week_number', 1, 'is_deload', false, 'days', jsonb_build_array(
        jsonb_build_object('id', 'd2000000-0000-0000-0000-000000000001', 'position', 0, 'name', 'Dan 1', 'exercises', jsonb_build_array(
          jsonb_build_object('id', 'd3000000-0000-0000-0000-000000000001', 'exercise_id', ex, 'position', 0, 'rest_seconds', 120, 'tempo', '3010',
            'sets', jsonb_build_array(jsonb_build_object('id', 'd4000000-0000-0000-0000-000000000001', 'position', 0, 'set_type', 'working', 'reps_min', 8, 'reps_max', 10, 'weight_kg', 40))))))))));
  select count(*) into n from public.training_weeks where program_id = 'd0000000-0000-0000-0000-00000000000d'; assert n = 2, 'two weeks saved';
  -- Swap week numbers in one save (deferred unique constraint).
  perform public.save_training_program(jsonb_build_object('id', 'd0000000-0000-0000-0000-00000000000d', 'name', 'Nacrt A v2', 'weeks', jsonb_build_array(
    jsonb_build_object('id', 'd1000000-0000-0000-0000-000000000001', 'week_number', 2, 'is_deload', true, 'days', jsonb_build_array(
      jsonb_build_object('id', 'd2000000-0000-0000-0000-000000000001', 'position', 0, 'name', 'Dan 1', 'exercises', '[]'::jsonb))),
    jsonb_build_object('id', 'd1000000-0000-0000-0000-000000000002', 'week_number', 1, 'is_deload', false, 'days', '[]'::jsonb))));
  assert (select week_number from public.training_weeks where id = 'd1000000-0000-0000-0000-000000000001') = 2, 'week renumbered';
  select count(*) into n from public.exercise_prescriptions where program_id = 'd0000000-0000-0000-0000-00000000000d'; assert n = 0, 'removed exercise deleted';
  new_id := public.copy_training_program('a0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Kopija', null);
  select count(*) into n from public.exercise_prescriptions where program_id = new_id; assert n = 1, 'copy includes exercises';
  assert (select status from public.training_programs where id = new_id) = 'draft', 'copy starts as draft';
  perform public.log_coach_event('clients', 'aaaaaaaa-0000-0000-0000-00000000000a', 'EXPORT');
end $$;
reset role;

select 'Function tests passed' as result;
