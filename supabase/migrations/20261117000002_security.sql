-- =============================================================================
-- Row Level Security. Rule of thumb:
--   * Coaches (profiles.role = 'coach') have equal, full access to all client data.
--   * Clients see only their own rows. Programs and plans only once active.
--   * Anonymous users see nothing.
-- =============================================================================

-- Anonymous visitors never read or write application tables.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Profiles: only safe columns are editable by their owner.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;
revoke all on public.coach_allowlist from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'coach_allowlist', 'clients', 'client_consents', 'app_settings', 'notifications',
    'audit_log', 'questionnaire_templates', 'questionnaire_sections', 'questionnaire_questions',
    'questionnaire_submissions', 'questionnaire_answers', 'coach_notes', 'nutrition_diary_days',
    'nutrition_diary_items', 'client_files', 'body_measurements', 'muscle_groups', 'exercises',
    'exercise_muscles', 'training_programs', 'training_weeks', 'training_days',
    'exercise_prescriptions', 'prescription_sets', 'workout_sessions', 'workout_sets',
    'running_programs', 'running_weeks', 'running_workouts', 'running_segments',
    'running_activities', 'foods', 'nutrition_plans', 'nutrition_plan_days', 'meals', 'meal_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Coaches: full access on every client-data table (one policy per table).
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'client_consents', 'questionnaire_submissions', 'questionnaire_answers',
    'coach_notes', 'nutrition_diary_days', 'nutrition_diary_items', 'client_files',
    'body_measurements', 'training_programs', 'training_weeks', 'training_days',
    'exercise_prescriptions', 'prescription_sets', 'workout_sessions', 'workout_sets',
    'running_programs', 'running_weeks', 'running_workouts', 'running_segments',
    'running_activities', 'nutrition_plans', 'nutrition_plan_days', 'meals', 'meal_items',
    'questionnaire_templates', 'questionnaire_sections', 'questionnaire_questions',
    'muscle_groups', 'exercises', 'exercise_muscles', 'foods', 'app_settings'
  ] loop
    execute format(
      'create policy coach_all on public.%I for all to authenticated using (public.is_coach()) with check (public.is_coach())', t);
  end loop;
end $$;

-- Reference data readable by every signed-in user.
create policy read_authenticated on public.questionnaire_templates for select to authenticated using (true);
create policy read_authenticated on public.questionnaire_sections  for select to authenticated using (true);
create policy read_authenticated on public.questionnaire_questions for select to authenticated using (true);
create policy read_authenticated on public.muscle_groups            for select to authenticated using (true);
create policy read_authenticated on public.exercises                for select to authenticated using (true);
create policy read_authenticated on public.exercise_muscles         for select to authenticated using (true);
create policy read_authenticated on public.foods                    for select to authenticated using (true);
create policy read_authenticated on public.app_settings             for select to authenticated using (true);

-- Profiles
create policy own_or_coach_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_coach() or role = 'coach');
create policy own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Clients: a client reads only their own record.
create policy client_own_select on public.clients for select to authenticated
  using (user_id = auth.uid() and status <> 'archived');

-- Consents: the client decides, the coach can read.
create policy client_own_select on public.client_consents for select to authenticated
  using (client_id = public.current_client_id());
create policy client_own_insert on public.client_consents for insert to authenticated
  with check (client_id = public.current_client_id());
create policy client_own_update on public.client_consents for update to authenticated
  using (client_id = public.current_client_id()) with check (client_id = public.current_client_id());

-- Notifications
create policy own_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy coach_insert on public.notifications for insert to authenticated with check (public.is_coach());

-- Audit log: coaches can read it, nobody can write it directly.
create policy coach_select on public.audit_log for select to authenticated using (public.is_coach());

-- Questionnaire submissions
create policy client_own_select on public.questionnaire_submissions for select to authenticated
  using (client_id = public.current_client_id());
create policy client_own_insert on public.questionnaire_submissions for insert to authenticated
  with check (client_id = public.current_client_id() and status in ('draft', 'submitted') and reviewed_at is null);
create policy client_own_update on public.questionnaire_submissions for update to authenticated
  using (client_id = public.current_client_id() and status <> 'reviewed')
  with check (client_id = public.current_client_id());

-- Answers: own submission, not yet reviewed, health questions only with consent.
create or replace function public.client_can_write_answer(p_submission uuid, p_question uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.questionnaire_submissions s
    join public.questionnaire_questions q on q.id = p_question and q.template_id = s.template_id
    where s.id = p_submission
      and s.client_id = public.current_client_id()
      and s.status <> 'reviewed'
      and (not q.sensitive or public.has_consent(s.client_id, 'health_data'))
  );
$$;

create policy client_own_select on public.questionnaire_answers for select to authenticated
  using (exists (select 1 from public.questionnaire_submissions s
                 where s.id = submission_id and s.client_id = public.current_client_id()));
create policy client_own_insert on public.questionnaire_answers for insert to authenticated
  with check (public.client_can_write_answer(submission_id, question_id));
create policy client_own_update on public.questionnaire_answers for update to authenticated
  using (public.client_can_write_answer(submission_id, question_id))
  with check (public.client_can_write_answer(submission_id, question_id));
create policy client_own_delete on public.questionnaire_answers for delete to authenticated
  using (public.client_can_write_answer(submission_id, question_id));

-- Nutrition diary
create policy client_own_all on public.nutrition_diary_days for all to authenticated
  using (client_id = public.current_client_id()) with check (client_id = public.current_client_id());
create policy client_own_all on public.nutrition_diary_items for all to authenticated
  using (exists (select 1 from public.nutrition_diary_days d where d.id = day_id and d.client_id = public.current_client_id()))
  with check (exists (select 1 from public.nutrition_diary_days d where d.id = day_id and d.client_id = public.current_client_id()));

-- Files: own files only; photos/videos and lab results require consent.
create or replace function public.file_kind_consent(p_client uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_kind in ('assessment_photo', 'assessment_video', 'progress_photo') then public.has_consent(p_client, 'photos_videos')
    when p_kind = 'lab_result' then public.has_consent(p_client, 'health_data')
    when p_kind = 'document' then public.has_consent(p_client, 'documents')
    else true
  end;
$$;

create policy client_own_select on public.client_files for select to authenticated
  using (client_id = public.current_client_id());
create policy client_own_insert on public.client_files for insert to authenticated
  with check (client_id = public.current_client_id()
              and uploaded_by = auth.uid()
              and public.file_kind_consent(client_id, kind));
create policy client_own_delete on public.client_files for delete to authenticated
  using (client_id = public.current_client_id() and uploaded_by = auth.uid());

-- Body measurements
create policy client_own_select on public.body_measurements for select to authenticated
  using (client_id = public.current_client_id());
create policy client_own_insert on public.body_measurements for insert to authenticated
  with check (client_id = public.current_client_id());
create policy client_own_update on public.body_measurements for update to authenticated
  using (client_id = public.current_client_id() and created_by = auth.uid())
  with check (client_id = public.current_client_id());
create policy client_own_delete on public.body_measurements for delete to authenticated
  using (client_id = public.current_client_id() and created_by = auth.uid());

-- Training programs: clients read active/completed programs assigned to them.
create policy client_visible on public.training_programs for select to authenticated
  using (public.client_sees_training_program(id));
create policy client_visible on public.training_weeks for select to authenticated
  using (public.client_sees_training_program(program_id));
create policy client_visible on public.training_days for select to authenticated
  using (public.client_sees_training_program(program_id));
create policy client_visible on public.exercise_prescriptions for select to authenticated
  using (public.client_sees_training_program(program_id));
create policy client_visible on public.prescription_sets for select to authenticated
  using (public.client_sees_training_program(program_id));

-- Workout logging
create policy client_own_all on public.workout_sessions for all to authenticated
  using (client_id = public.current_client_id())
  with check (
    client_id = public.current_client_id()
    and (program_id is null or public.client_sees_training_program(program_id))
  );
create policy client_own_all on public.workout_sets for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = public.current_client_id()))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.client_id = public.current_client_id()));

-- Running
create policy client_visible on public.running_programs for select to authenticated
  using (public.client_sees_running_program(id));
create policy client_visible on public.running_weeks for select to authenticated
  using (public.client_sees_running_program(program_id));
create policy client_visible on public.running_workouts for select to authenticated
  using (public.client_sees_running_program(program_id));
create policy client_visible on public.running_segments for select to authenticated
  using (public.client_sees_running_program(program_id));
create policy client_own_all on public.running_activities for all to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Nutrition plans
create policy client_visible on public.nutrition_plans for select to authenticated
  using (public.client_sees_nutrition_plan(id));
create policy client_visible on public.nutrition_plan_days for select to authenticated
  using (public.client_sees_nutrition_plan(plan_id));
create policy client_visible on public.meals for select to authenticated
  using (plan_id is not null and public.client_sees_nutrition_plan(plan_id));
create policy client_visible on public.meal_items for select to authenticated
  using (plan_id is not null and public.client_sees_nutrition_plan(plan_id));

-- =============================================================================
-- Storage: one private bucket. Path: <client_id>/<kind>/<uuid>.<ext>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files', 'client-files', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
        'application/pdf', 'video/mp4', 'video/quicktime', 'video/webm',
        'application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream', 'application/vnd.ant.fit']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy client_files_coach_all on storage.objects for all to authenticated
  using (bucket_id = 'client-files' and public.is_coach())
  with check (bucket_id = 'client-files' and public.is_coach());

create policy client_files_client_select on storage.objects for select to authenticated
  using (bucket_id = 'client-files'
         and (storage.foldername(name))[1] = public.current_client_id()::text);

-- A client may only upload to a path that was registered first in client_files.
-- That insert is where consent is checked, so storage cannot be used to bypass it.
create or replace function public.client_file_registered(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.client_files f
    where f.storage_path = p_path and f.client_id = public.current_client_id()
  );
$$;

create policy client_files_client_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files'
              and (storage.foldername(name))[1] = public.current_client_id()::text
              and public.client_file_registered(name));

create policy client_files_client_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-files'
         and (storage.foldername(name))[1] = public.current_client_id()::text
         and owner = auth.uid());
