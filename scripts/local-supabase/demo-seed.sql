-- DEMO DATA FOR LOCAL DEVELOPMENT ONLY. Never run this in the production project.
-- Expects the clients created by hand: jelena@demo.local (with an account), marija@demo.local, ivana@demo.local.
do $$
declare
  j uuid := (select id from public.clients where email = 'jelena@demo.local');
  m uuid := (select id from public.clients where email = 'marija@demo.local');
  prog uuid := gen_random_uuid(); w uuid; d1 uuid; d2 uuid; e uuid; s uuid; i int; wk int;
  sq uuid := (select id from public.exercises where name ilike 'Čučanj sa šipkom' limit 1);
  rdl uuid := (select id from public.exercises where name ilike 'Rumunsko mrtvo dizanje' limit 1);
  bp uuid := (select id from public.exercises where name ilike 'Potisak sa ravne klupe' limit 1);
  row_ uuid := (select id from public.exercises where name ilike 'Veslanje sa šipkom' limit 1);
  rp uuid := gen_random_uuid(); rw uuid; rwo uuid;
  np uuid := gen_random_uuid(); nd uuid := gen_random_uuid(); nm uuid;
  tpl uuid := (select id from public.questionnaire_templates where kind = 'checkin' limit 1);
  sub uuid; dt date;
begin
  -- Measurements
  for i in 0..10 loop
    insert into public.body_measurements (client_id, measured_on, weight_kg, waist_cm, source)
    values (j, date '2026-09-07' + i * 7, 72.4 - i * 0.22 + (i % 3) * 0.15, 81 - i * 0.3, 'manual');
  end loop;
  insert into public.body_measurements (client_id, measured_on, weight_kg) values (m, '2026-10-05', 66.1), (m, '2026-11-02', 65.4);

  -- Strength program (4 weeks, 2 days)
  insert into public.training_programs (id, client_id, name, start_date, status) values (prog, j, 'Snaga i oblikovanje, blok 1', '2026-11-02', 'active');
  for wk in 1..4 loop
    w := gen_random_uuid();
    insert into public.training_weeks (id, program_id, week_number, is_deload) values (w, prog, wk, wk = 4);
    d1 := gen_random_uuid(); d2 := gen_random_uuid();
    insert into public.training_days (id, program_id, week_id, day_of_week, position, name) values (d1, prog, w, 1, 0, 'Donji deo'), (d2, prog, w, 4, 1, 'Gornji deo');
    foreach e in array array[sq, rdl] loop
      s := gen_random_uuid();
      insert into public.exercise_prescriptions (id, program_id, day_id, exercise_id, position, rest_seconds) values (s, prog, d1, e, case when e = sq then 0 else 1 end, 120);
      insert into public.prescription_sets (program_id, prescription_id, position, set_type, reps_min, reps_max, weight_kg, rir)
      select prog, s, g, 'working', 8, 10, case when e = sq then 40 else 45 end + (wk - 1) * 2.5, 2 from generate_series(0, 2) g;
    end loop;
    foreach e in array array[bp, row_] loop
      s := gen_random_uuid();
      insert into public.exercise_prescriptions (id, program_id, day_id, exercise_id, position, rest_seconds) values (s, prog, d2, e, case when e = bp then 0 else 1 end, 90);
      insert into public.prescription_sets (program_id, prescription_id, position, set_type, reps_min, reps_max, weight_kg, rir)
      select prog, s, g, 'working', 8, 10, case when e = bp then 30 else 32.5 end + (wk - 1) * 2.5, 2 from generate_series(0, 2) g;
    end loop;
  end loop;

  -- Logged workouts over 8 weeks
  for i in 0..7 loop
    dt := date '2026-09-21' + i * 7;
    s := gen_random_uuid();
    insert into public.workout_sessions (id, client_id, name, performed_on, started_at, finished_at, status) values (s, j, 'Donji deo', dt, dt + time '18:00', dt + time '19:05', 'completed');
    insert into public.workout_sets (session_id, exercise_id, exercise_position, position, set_type, reps, weight_kg, is_completed)
    select s, sq, 0, g, 'working', 8, 32.5 + i * 2.5, true from generate_series(0, 2) g;
    insert into public.workout_sets (session_id, exercise_id, exercise_position, position, set_type, reps, weight_kg, is_completed)
    select s, rdl, 1, g, 'working', 10, 40 + i * 2.5, true from generate_series(0, 2) g;
  end loop;

  -- Running
  insert into public.running_programs (id, client_id, name, start_date, status, zones) values (rp, j, 'Polumaraton – osnova', '2026-11-02', 'active',
    '[{"name":"Z2","pace_min":375,"pace_max":405,"hr_min":130,"hr_max":145}]');
  for wk in 1..4 loop
    rw := gen_random_uuid();
    insert into public.running_weeks (id, program_id, week_number, target_km) values (rw, rp, wk, 14 + wk * 2);
    rwo := gen_random_uuid();
    insert into public.running_workouts (id, program_id, week_id, day_of_week, workout_type, title, position) values (rwo, rp, rw, 3, 'easy', 'Lagano trčanje', 0);
    insert into public.running_segments (program_id, workout_id, position, segment_type, duration_s, pace_min_s_km, pace_max_s_km) values (rp, rwo, 0, 'main', 2400, 375, 405);
    rwo := gen_random_uuid();
    insert into public.running_workouts (id, program_id, week_id, day_of_week, workout_type, title, position) values (rwo, rp, rw, 6, 'vo2max_intervals', 'Intervali 5 × 800 m', 1);
    insert into public.running_segments (program_id, workout_id, position, segment_type, duration_s) values (rp, rwo, 0, 'warmup', 600);
    insert into public.running_segments (program_id, workout_id, position, segment_type, repeat_count, distance_m, pace_min_s_km, pace_max_s_km, recovery_s) values (rp, rwo, 1, 'interval', 5, 800, 290, 300, 90);
  end loop;
  for i in 0..15 loop
    insert into public.running_activities (client_id, performed_on, distance_m, duration_s, avg_hr, source, title)
    values (j, date '2026-09-10' + i * 4, 5000 + (i % 4) * 1500, (5000 + (i % 4) * 1500) * (0.4 - i * 0.003), 140 + i % 6, 'manual', case when i % 4 = 3 then 'Dugo trčanje' else 'Lagano trčanje' end);
  end loop;

  -- Nutrition
  insert into public.nutrition_plans (id, client_id, name, kcal_target, protein_g, carbs_g, fat_g, status, notes) values (np, j, 'Osnovni plan', 1900, 130, 200, 65, 'active', 'Voda 2-2,5 l dnevno. Obroci su smernica, ne pravilo.');
  insert into public.nutrition_plan_days (id, plan_id, position, name) values (nd, np, 0, 'Dan sa treningom');
  nm := gen_random_uuid();
  insert into public.meals (id, plan_id, plan_day_id, position, name, meal_time) values (nm, np, nd, 0, 'Doručak', '08:00');
  insert into public.meal_items (meal_id, plan_id, food_id, quantity_g, position) select nm, np, id, 60, 0 from public.foods where name ilike 'Ovsene%' limit 1;
  insert into public.meal_items (meal_id, plan_id, food_id, quantity_g, position) select nm, np, id, 200, 1 from public.foods where name ilike 'Grčki jogurt%' limit 1;
  nm := gen_random_uuid();
  insert into public.meals (id, plan_id, plan_day_id, position, name, meal_time) values (nm, np, nd, 1, 'Ručak', '13:30');
  insert into public.meal_items (meal_id, plan_id, food_id, quantity_g, position) select nm, np, id, 150, 0 from public.foods where name ilike 'Pileće%' limit 1;
  insert into public.meal_items (meal_id, plan_id, food_id, quantity_g, position) select nm, np, id, 180, 1 from public.foods where name ilike '%pirinač%' limit 1;

  -- Check-ins (weekly, scale answers trending up)
  for i in 0..7 loop
    sub := gen_random_uuid();
    insert into public.questionnaire_submissions (id, template_id, client_id, kind, status, period_start, period_end, submitted_at, reviewed_at)
    values (sub, tpl, j, 'checkin', case when i = 7 then 'submitted' else 'reviewed' end, date '2026-09-21' + i * 7, date '2026-09-27' + i * 7, now() - (7 - i) * interval '7 days', case when i = 7 then null else now() end);
    insert into public.questionnaire_answers (submission_id, question_id, value)
    select sub, q.id, case q.code
      when 'avg_weight' then to_jsonb(71.8 - i * 0.2)
      when 'nutrition_adherence' then to_jsonb(6 + (i % 4))
      when 'sleep_quality' then to_jsonb(5 + (i % 5))
      when 'recovery_energy' then to_jsonb(6 + (i % 3))
      when 'stress' then to_jsonb(case when i = 7 then 8 else 4 + (i % 3) end)
      when 'mood_motivation' then to_jsonb(7 + (i % 3))
      when 'sleep_hours' then to_jsonb(6.5 + (i % 3) * 0.5)
      when 'strength_sessions' then '{"planned":2,"done":2}'::jsonb
      when 'strength_pain' then 'false'::jsonb
      when 'best_thing' then '"Odradila sam sve treninge."'::jsonb
      end
    from public.questionnaire_questions q where q.template_id = tpl and q.code in ('avg_weight','nutrition_adherence','sleep_quality','recovery_energy','stress','mood_motivation','sleep_hours','strength_sessions','strength_pain','best_thing');
  end loop;
  insert into public.coach_notes (client_id, body, is_pinned) values (j, 'Blaga nelagodnost u levom kolenu kod dubokih čučnjeva. Krećemo sa box čučnjem.', true);
end $$;
