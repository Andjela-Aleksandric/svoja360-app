-- Row Level Security tests. Run with: npm run test:db
-- Each check raises an exception on failure, so psql stops with a non-zero exit code.
\set ON_ERROR_STOP 1

-- ---------------------------------------------------------------------------
-- Fixtures (as table owner)
-- ---------------------------------------------------------------------------
insert into public.coach_allowlist (email) values ('trener1@test.rs'), ('trener2@test.rs');

insert into public.clients (id, full_name, email, phone_e164) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'Klijent A', 'a@test.rs', '+381641234567'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Klijent B', 'b@test.rs', '+381651234567');

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'trener1@test.rs'),
  ('22222222-2222-2222-2222-222222222222', 'Trener2@test.rs'),
  ('a1a1a1a1-0000-0000-0000-0000000000a1', 'a@test.rs'),
  ('b1b1b1b1-0000-0000-0000-0000000000b1', 'B@test.rs');

do $$ begin
  assert (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'coach', 'coach 1 role';
  assert (select role from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'coach', 'coach 2 role (case-insensitive)';
  assert (select role from public.profiles where id = 'a1a1a1a1-0000-0000-0000-0000000000a1') = 'client', 'client role';
  assert (select user_id from public.clients where email = 'a@test.rs') = 'a1a1a1a1-0000-0000-0000-0000000000a1', 'client A linked';
  assert (select user_id from public.clients where email = 'b@test.rs') = 'b1b1b1b1-0000-0000-0000-0000000000b1', 'client B linked case-insensitive';
end $$;

-- Program fixtures for client A (draft + active) and client B (active)
insert into public.training_programs (id, client_id, name, status) values
  ('d0000000-0000-0000-0000-00000000000d', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Nacrt A', 'draft'),
  ('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Program A', 'active'),
  ('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Program B', 'active');
insert into public.training_weeks (id, program_id, week_number) values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 1),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 1);
insert into public.training_days (id, week_id, name, program_id) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Dan A', null),
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Dan B', null);
insert into public.exercise_prescriptions (id, day_id, exercise_id, program_id)
  select 'a3000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', id, null
  from public.exercises where name = 'Čučanj sa šipkom';
do $$ begin
  assert (select program_id from public.exercise_prescriptions where id = 'a3000000-0000-0000-0000-000000000001')
         = 'a0000000-0000-0000-0000-00000000000a', 'program_id filled from parent';
end $$;

insert into public.coach_notes (client_id, body) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'Interna beleška');
insert into storage.objects (bucket_id, name, owner) values
  ('client-files', 'bbbbbbbb-0000-0000-0000-00000000000b/document/x.pdf', 'b1b1b1b1-0000-0000-0000-0000000000b1');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
set role anon;
do $$ begin
  begin
    perform 1 from public.clients;
    raise exception 'anon must not read clients';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Client A
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-0000000000a1","role":"authenticated"}', false);

do $$
declare n int; v_sub uuid; v_q uuid; v_tpl uuid;
begin
  assert public.current_client_id() = 'aaaaaaaa-0000-0000-0000-00000000000a', 'current_client_id';
  assert not public.is_coach(), 'client is not coach';

  select count(*) into n from public.clients;               assert n = 1, 'client sees only own client row';
  select count(*) into n from public.profiles;              assert n = 3, 'client sees own profile + coach profiles';
  select count(*) into n from public.coach_notes;           assert n = 0, 'client cannot see coach notes';
  select count(*) into n from public.audit_log;             assert n = 0, 'client cannot see audit log';

  -- Programs: draft hidden, other client hidden, active visible incl. children
  select count(*) into n from public.training_programs;     assert n = 1, 'only own active program visible';
  select count(*) into n from public.training_days;         assert n = 1, 'only own days visible';
  select count(*) into n from public.exercise_prescriptions; assert n = 1, 'own prescriptions visible';

  -- Cannot create clients or change role
  begin
    insert into public.clients (full_name, email) values ('X', 'x@test.rs');
    raise exception 'client must not insert clients';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'coach' where id = auth.uid();
    raise exception 'client must not change role';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set full_name = 'Ana A' where id = auth.uid();
  assert (select full_name from public.profiles where id = auth.uid()) = 'Ana A', 'client updates own name';

  -- Updates on other client's rows silently affect nothing
  update public.clients set goal = 'hack' where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  get diagnostics n = row_count; assert n = 0, 'cannot update other client';

  -- Check-in submissions
  select id into v_tpl from public.questionnaire_templates where kind = 'checkin';
  insert into public.questionnaire_submissions (template_id, client_id, kind, period_start, period_end)
  values (v_tpl, public.current_client_id(), 'checkin', '2026-11-09', '2026-11-15') returning id into v_sub;

  begin
    insert into public.questionnaire_submissions (template_id, client_id, kind, period_start, period_end)
    values (v_tpl, 'bbbbbbbb-0000-0000-0000-00000000000b', 'checkin', '2026-11-09', '2026-11-15');
    raise exception 'client must not create submission for another client';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.questionnaire_submissions (template_id, client_id, kind, period_start, period_end)
    values (v_tpl, public.current_client_id(), 'checkin', '2026-11-09', '2026-11-15');
    raise exception 'duplicate period must fail';
  exception when unique_violation then null;
  end;

  -- Non-sensitive answer works
  select id into v_q from public.questionnaire_questions where template_id = v_tpl and code = 'avg_weight';
  insert into public.questionnaire_answers (submission_id, question_id, value) values (v_sub, v_q, '68.4');

  -- Submit; reviewing is coach-only
  update public.questionnaire_submissions set status = 'submitted' where id = v_sub;
  assert (select submitted_at from public.questionnaire_submissions where id = v_sub) is not null, 'submitted_at set';
  begin
    update public.questionnaire_submissions set status = 'reviewed' where id = v_sub;
    raise exception 'client must not review';
  exception when raise_exception then
    if sqlerrm <> 'submission_reviewed_locked' then raise; end if;
  end;

  -- Sensitive answer needs health consent
  select id into v_tpl from public.questionnaire_templates where kind = 'initial';
  insert into public.questionnaire_submissions (template_id, client_id, kind)
  values (v_tpl, public.current_client_id(), 'initial') returning id into v_sub;
  select id into v_q from public.questionnaire_questions where template_id = v_tpl and code = 'health_conditions';
  begin
    insert into public.questionnaire_answers (submission_id, question_id, value) values (v_sub, v_q, '"Hašimoto"');
    raise exception 'sensitive answer without consent must fail';
  exception when insufficient_privilege then null;
  end;
  insert into public.client_consents (client_id, consent_type, granted) values (public.current_client_id(), 'health_data', true);
  insert into public.questionnaire_answers (submission_id, question_id, value) values (v_sub, v_q, '"Hašimoto"');

  -- Second initial draft is blocked
  begin
    insert into public.questionnaire_submissions (template_id, client_id, kind)
    values (v_tpl, public.current_client_id(), 'initial');
    raise exception 'second initial draft must fail';
  exception when unique_violation then null;
  end;

  -- Workouts: own only, only on visible programs
  insert into public.workout_sessions (client_id, program_id, name) values (public.current_client_id(), 'a0000000-0000-0000-0000-00000000000a', 'Trening A');
  begin
    insert into public.workout_sessions (client_id, name) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'Tuđi');
    raise exception 'workout for other client must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workout_sessions (client_id, program_id, name) values (public.current_client_id(), 'd0000000-0000-0000-0000-00000000000d', 'Nacrt');
    raise exception 'workout on hidden draft program must fail';
  exception when insufficient_privilege then null;
  end;

  -- Files: progress photo needs photo consent
  begin
    insert into public.client_files (client_id, kind, storage_path, file_name, mime_type, size_bytes)
    values (public.current_client_id(), 'progress_photo', 'aaaaaaaa-0000-0000-0000-00000000000a/progress_photo/1.jpg', '1.jpg', 'image/jpeg', 1000);
    raise exception 'photo without consent must fail';
  exception when insufficient_privilege then null;
  end;
  insert into public.client_consents (client_id, consent_type, granted) values (public.current_client_id(), 'photos_videos', true);
  insert into public.client_files (client_id, kind, storage_path, file_name, mime_type, size_bytes)
  values (public.current_client_id(), 'progress_photo', 'aaaaaaaa-0000-0000-0000-00000000000a/progress_photo/1.jpg', '1.jpg', 'image/jpeg', 1000);
  begin
    insert into public.client_files (client_id, kind, storage_path, file_name, mime_type, size_bytes)
    values (public.current_client_id(), 'meal_photo', 'bbbbbbbb-0000-0000-0000-00000000000b/meal_photo/1.jpg', '1.jpg', 'image/jpeg', 1000);
    raise exception 'path into other client folder must fail';
  exception when check_violation then null;
  end;

  -- Storage objects
  insert into storage.objects (bucket_id, name) values ('client-files', 'aaaaaaaa-0000-0000-0000-00000000000a/progress_photo/1.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('client-files', 'bbbbbbbb-0000-0000-0000-00000000000b/progress_photo/evil.jpg');
    raise exception 'storage upload into other client folder must fail';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects; assert n = 1, 'client sees only own stored files';

  -- Measurements
  insert into public.body_measurements (client_id, measured_on, weight_kg) values (public.current_client_id(), '2026-11-15', 68.4);
  select count(*) into n from public.body_measurements; assert n = 1, 'own measurement visible';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Client B cannot see anything of client A
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-0000000000b1","role":"authenticated"}', false);
do $$
declare n int;
begin
  select count(*) into n from public.questionnaire_submissions; assert n = 0, 'B sees no submissions of A';
  select count(*) into n from public.questionnaire_answers;     assert n = 0, 'B sees no answers of A';
  select count(*) into n from public.workout_sessions;          assert n = 0, 'B sees no workouts of A';
  select count(*) into n from public.body_measurements;         assert n = 0, 'B sees no measurements of A';
  select count(*) into n from public.client_files;              assert n = 0, 'B sees no files of A';
  select count(*) into n from public.client_consents;           assert n = 0, 'B sees no consents of A';
  select count(*) into n from storage.objects;                  assert n = 1, 'B sees only own storage object';
  select count(*) into n from public.training_programs;         assert n = 1, 'B sees only own program';
end $$;
reset role;

-- ---------------------------------------------------------------------------
-- Coach
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
do $$
declare n int; v_sub uuid;
begin
  assert public.is_coach(), 'coach helper';
  select count(*) into n from public.clients;               assert n = 2, 'coach sees all clients';
  select count(*) into n from public.training_programs;     assert n = 3, 'coach sees all programs incl. drafts';
  select count(*) into n from public.coach_notes;           assert n = 1, 'coach sees notes';
  select count(*) into n from storage.objects;              assert n = 2, 'coach sees all stored files';

  select id into v_sub from public.questionnaire_submissions where kind = 'checkin' limit 1;
  update public.questionnaire_submissions set status = 'reviewed' where id = v_sub;
  assert (select reviewed_by from public.questionnaire_submissions where id = v_sub) = auth.uid(), 'reviewed_by set';

  insert into public.clients (full_name, email) values ('Nova klijentkinja', 'nova@test.rs');
  assert (select created_by from public.clients where email = 'nova@test.rs') = auth.uid(), 'created_by tracked';
  select count(*) into n from public.audit_log where table_name = 'clients'; assert n >= 3, 'audit log written';
end $$;
reset role;

-- After review the client can no longer edit that check-in
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-0000000000a1","role":"authenticated"}', false);
do $$
declare n int;
begin
  update public.questionnaire_submissions set current_step = 3 where kind = 'checkin';
  get diagnostics n = row_count; assert n = 0, 'reviewed check-in is locked for client';
end $$;
reset role;

select 'RLS tests passed' as result;
