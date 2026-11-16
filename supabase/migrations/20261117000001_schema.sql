-- =============================================================================
-- SVOJA 360 coaching platform - core schema
-- All identifiers in English. User-facing text lives in the app (src/lib/i18n).
-- Access control is enforced in the database with Row Level Security.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- For tables with created_by / updated_by: keep authorship accurate and immutable.
create or replace function public.set_audit_fields()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(auth.uid(), new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    new.updated_at := now();
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Users, roles, clients
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('coach', 'client')),
  full_name   text,
  email       text,
  phone       text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- E-mail addresses that become coach accounts on sign-up. Managed only with SQL.
create table public.coach_allowlist (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references public.profiles(id) on delete set null,
  full_name   text not null check (length(btrim(full_name)) > 0),
  email       text not null check (position('@' in email) > 1),
  phone       text,
  phone_e164  text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  birth_date  date,
  height_cm   numeric(5,1) check (height_cm is null or height_cm between 100 and 250),
  start_date  date not null default current_date,
  status      text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  goal        text,
  avatar_path text,
  archived_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index clients_email_key on public.clients (lower(email));
create index clients_status_idx on public.clients (status);
create trigger clients_audit_fields before insert or update on public.clients
  for each row execute function public.set_audit_fields();

-- Role helpers. SECURITY DEFINER so policies can call them without recursion.
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'
  );
$$;

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from public.clients c
  where c.user_id = auth.uid() and c.status <> 'archived'
  limit 1;
$$;

-- New auth user -> profile. Coaches come from the allowlist; everyone else is a client.
-- An existing client record with the same e-mail is linked to the new account.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  select case when exists (
    select 1 from public.coach_allowlist a where a.email = lower(new.email)
  ) then 'coach' else 'client' end into v_role;

  insert into public.profiles (id, role, email, full_name)
  values (new.id, v_role, lower(new.email), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;

  if v_role = 'client' then
    update public.clients
       set user_id = new.id
     where lower(email) = lower(new.email) and user_id is null;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own name and phone, never their role.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'role_change_not_allowed';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- -----------------------------------------------------------------------------
-- Consent, settings, notes, notifications, audit
-- -----------------------------------------------------------------------------

create table public.client_consents (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  consent_type text not null check (consent_type in ('health_data', 'photos_videos', 'documents')),
  granted      boolean not null,
  decided_at   timestamptz not null default now(),
  unique (client_id, consent_type)
);

create or replace function public.has_consent(p_client uuid, p_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select granted from public.client_consents
    where client_id = p_client and consent_type = p_type
  ), false);
$$;

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  table_name text not null,
  record_id  uuid,
  action     text not null,
  actor_id   uuid,
  changed_at timestamptz not null default now(),
  data       jsonb
);
create index audit_log_record_idx on public.audit_log (table_name, record_id);

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (table_name, record_id, action, actor_id, data)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')::uuid else (to_jsonb(new) ->> 'id')::uuid end,
    lower(tg_op),
    auth.uid(),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

-- -----------------------------------------------------------------------------
-- Questionnaires (initial assessment and weekly check-in share one structure)
-- -----------------------------------------------------------------------------

create table public.questionnaire_templates (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('initial', 'checkin')),
  name       text not null,
  version    int  not null default 1,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index questionnaire_templates_active_kind on public.questionnaire_templates (kind) where is_active;

create table public.questionnaire_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.questionnaire_templates(id) on delete cascade,
  position    int  not null,
  title       text not null,
  description text,
  unique (template_id, position)
);

create table public.questionnaire_questions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.questionnaire_templates(id) on delete cascade,
  section_id  uuid not null references public.questionnaire_sections(id) on delete cascade,
  position    int  not null,
  code        text not null,
  label       text not null,
  help_text   text,
  type        text not null check (type in (
                'text', 'long_text', 'number', 'date', 'single_choice', 'multi_choice',
                'scale', 'yes_no', 'file', 'measurements', 'planned_done')),
  options     jsonb,
  unit        text,
  required    boolean not null default false,
  sensitive   boolean not null default false,
  condition   jsonb,
  unique (template_id, code),
  unique (section_id, position)
);

create table public.questionnaire_submissions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.questionnaire_templates(id),
  client_id    uuid not null references public.clients(id) on delete cascade,
  kind         text not null check (kind in ('initial', 'checkin')),
  status       text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  period_start date,
  period_end   date,
  current_step int  not null default 0,
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((kind = 'checkin') = (period_start is not null and period_end is not null)),
  check (period_end is null or period_end >= period_start)
);
create unique index submissions_one_checkin_per_period on public.questionnaire_submissions (client_id, period_start) where kind = 'checkin';
create unique index submissions_one_initial_draft on public.questionnaire_submissions (client_id) where kind = 'initial' and status = 'draft';
create index submissions_client_idx on public.questionnaire_submissions (client_id, kind, created_at desc);
create index submissions_status_idx on public.questionnaire_submissions (status, kind);
create trigger submissions_audit_fields before insert or update on public.questionnaire_submissions
  for each row execute function public.set_audit_fields();

-- Clients cannot review, re-assign or move their submissions.
create or replace function public.guard_submission_update()
returns trigger language plpgsql as $$
begin
  if public.is_coach() then
    if new.status = 'reviewed' and old.status <> 'reviewed' then
      new.reviewed_at := now();
      new.reviewed_by := auth.uid();
    end if;
    return new;
  end if;
  if new.client_id <> old.client_id or new.template_id <> old.template_id or new.kind <> old.kind
     or new.period_start is distinct from old.period_start or new.period_end is distinct from old.period_end then
    raise exception 'submission_immutable_fields';
  end if;
  if old.status = 'reviewed' or new.status = 'reviewed' then
    raise exception 'submission_reviewed_locked';
  end if;
  new.reviewed_at := old.reviewed_at;
  new.reviewed_by := old.reviewed_by;
  if new.status = 'submitted' and old.status = 'draft' then
    new.submitted_at := now();
  end if;
  return new;
end $$;
create trigger submissions_guard before update on public.questionnaire_submissions
  for each row execute function public.guard_submission_update();

create table public.questionnaire_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.questionnaire_submissions(id) on delete cascade,
  question_id   uuid not null references public.questionnaire_questions(id) on delete cascade,
  value         jsonb,
  updated_at    timestamptz not null default now(),
  unique (submission_id, question_id)
);
create trigger answers_updated_at before update on public.questionnaire_answers
  for each row execute function public.set_updated_at();

create table public.coach_notes (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  submission_id uuid references public.questionnaire_submissions(id) on delete cascade,
  body          text not null check (length(btrim(body)) > 0),
  is_pinned     boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index coach_notes_client_idx on public.coach_notes (client_id, created_at desc);
create trigger coach_notes_audit_fields before insert or update on public.coach_notes
  for each row execute function public.set_audit_fields();

-- -----------------------------------------------------------------------------
-- Three-day nutrition diary
-- -----------------------------------------------------------------------------

create table public.nutrition_diary_days (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  day_index    smallint not null check (day_index between 1 and 3),
  diary_date   date,
  day_type     text check (day_type in ('weekday', 'weekend')),
  notes        text,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id, day_index)
);
create trigger diary_days_updated_at before update on public.nutrition_diary_days
  for each row execute function public.set_updated_at();

create table public.nutrition_diary_items (
  id         uuid primary key default gen_random_uuid(),
  day_id     uuid not null references public.nutrition_diary_days(id) on delete cascade,
  eaten_at   time,
  food_name  text not null check (length(btrim(food_name)) > 0),
  quantity   text,
  is_drink   boolean not null default false,
  notes      text,
  created_at timestamptz not null default now()
);
create index diary_items_day_idx on public.nutrition_diary_items (day_id, eaten_at);

-- -----------------------------------------------------------------------------
-- Files (lab results, photos, videos, documents, activity files)
-- Stored privately in the 'client-files' bucket under '<client_id>/<kind>/<file>'.
-- -----------------------------------------------------------------------------

create table public.client_files (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  kind           text not null check (kind in (
                   'lab_result', 'assessment_photo', 'assessment_video', 'progress_photo',
                   'document', 'meal_photo', 'activity_file', 'avatar')),
  storage_path   text not null unique,
  file_name      text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  taken_on       date,
  photo_angle    text check (photo_angle in ('front', 'side', 'back')),
  submission_id  uuid references public.questionnaire_submissions(id) on delete set null,
  question_id    uuid references public.questionnaire_questions(id) on delete set null,
  diary_day_id   uuid references public.nutrition_diary_days(id) on delete set null,
  uploaded_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  check (storage_path like client_id::text || '/%')
);
create index client_files_client_idx on public.client_files (client_id, kind, created_at desc);

-- -----------------------------------------------------------------------------
-- Body measurements
-- -----------------------------------------------------------------------------

create table public.body_measurements (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  measured_on   date not null,
  weight_kg     numeric(5,2) check (weight_kg is null or weight_kg between 25 and 300),
  waist_cm      numeric(5,1) check (waist_cm is null or waist_cm between 30 and 250),
  hips_cm       numeric(5,1) check (hips_cm is null or hips_cm between 30 and 250),
  chest_cm      numeric(5,1) check (chest_cm is null or chest_cm between 30 and 250),
  thigh_cm      numeric(5,1) check (thigh_cm is null or thigh_cm between 20 and 150),
  arm_cm        numeric(5,1) check (arm_cm is null or arm_cm between 10 and 80),
  body_fat_pct  numeric(4,1) check (body_fat_pct is null or body_fat_pct between 3 and 70),
  source        text not null default 'manual' check (source in ('manual', 'checkin', 'initial')),
  submission_id uuid references public.questionnaire_submissions(id) on delete set null,
  notes         text,
  created_by    uuid references public.profiles(id) on delete set null,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index body_measurements_client_idx on public.body_measurements (client_id, measured_on);
create trigger body_measurements_audit_fields before insert or update on public.body_measurements
  for each row execute function public.set_audit_fields();

-- -----------------------------------------------------------------------------
-- Strength: exercise library
-- -----------------------------------------------------------------------------

create table public.muscle_groups (
  id       smallint generated always as identity primary key,
  slug     text not null unique,
  name     text not null,
  position smallint not null default 0
);

create table public.exercises (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  equipment        text not null check (equipment in (
                     'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'bodyweight',
                     'band', 'smith', 'trap_bar', 'ez_bar', 'bench', 'other')),
  exercise_type    text not null check (exercise_type in ('compound', 'isolation', 'plyometric', 'core', 'mobility', 'cardio')),
  movement_pattern text not null check (movement_pattern in (
                     'squat', 'hinge', 'lunge', 'push_horizontal', 'push_vertical',
                     'pull_horizontal', 'pull_vertical', 'carry', 'core', 'isolation', 'other')),
  instructions     text,
  media_url        text check (media_url is null or media_url ~ '^https://'),
  parent_id        uuid references public.exercises(id) on delete set null,
  is_custom        boolean not null default false,
  is_archived      boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  updated_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index exercises_name_key on public.exercises (lower(name));
create trigger exercises_audit_fields before insert or update on public.exercises
  for each row execute function public.set_audit_fields();

create table public.exercise_muscles (
  exercise_id     uuid not null references public.exercises(id) on delete cascade,
  muscle_group_id smallint not null references public.muscle_groups(id) on delete cascade,
  is_primary      boolean not null,
  primary key (exercise_id, muscle_group_id)
);
create unique index exercise_one_primary_muscle on public.exercise_muscles (exercise_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Strength: programs. client_id null = reusable template.
-- program_id is denormalised on child rows to keep RLS checks simple and fast.
-- -----------------------------------------------------------------------------

create table public.training_programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  description text,
  start_date  date,
  status      text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (client_id is not null or status in ('draft', 'archived'))
);
create index training_programs_client_idx on public.training_programs (client_id, status);
create trigger training_programs_audit_fields before insert or update on public.training_programs
  for each row execute function public.set_audit_fields();

create table public.training_weeks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.training_programs(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  is_deload   boolean not null default false,
  notes       text,
  unique (program_id, week_number)
);

create table public.training_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.training_programs(id) on delete cascade,
  week_id     uuid not null references public.training_weeks(id) on delete cascade,
  day_of_week smallint check (day_of_week between 1 and 7),
  position    smallint not null default 0,
  name        text not null,
  notes       text
);
create index training_days_week_idx on public.training_days (week_id, position);

create table public.exercise_prescriptions (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.training_programs(id) on delete cascade,
  day_id         uuid not null references public.training_days(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id),
  position       smallint not null default 0,
  superset_group text check (superset_group is null or superset_group ~ '^[A-Z]$'),
  rest_seconds   int check (rest_seconds is null or rest_seconds between 0 and 900),
  tempo          text check (tempo is null or tempo ~ '^[0-9X]{4}$'),
  notes          text
);
create index prescriptions_day_idx on public.exercise_prescriptions (day_id, position);

create table public.prescription_sets (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.training_programs(id) on delete cascade,
  prescription_id uuid not null references public.exercise_prescriptions(id) on delete cascade,
  position        smallint not null default 0,
  set_type        text not null default 'working' check (set_type in ('warmup', 'working', 'dropset')),
  reps_min        smallint check (reps_min is null or reps_min between 0 and 100),
  reps_max        smallint check (reps_max is null or reps_max between 0 and 100),
  weight_kg       numeric(6,2) check (weight_kg is null or weight_kg between 0 and 500),
  rir             numeric(3,1) check (rir is null or rir between 0 and 10),
  rpe             numeric(3,1) check (rpe is null or rpe between 1 and 10),
  check (reps_max is null or reps_min is null or reps_max >= reps_min)
);
create index prescription_sets_idx on public.prescription_sets (prescription_id, position);

-- Fill program_id from the parent row so clients can never point a child at another program.
create or replace function public.fill_training_program_id()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'training_days' then
    select program_id into new.program_id from public.training_weeks where id = new.week_id;
  elsif tg_table_name = 'exercise_prescriptions' then
    select program_id into new.program_id from public.training_days where id = new.day_id;
  elsif tg_table_name = 'prescription_sets' then
    select program_id into new.program_id from public.exercise_prescriptions where id = new.prescription_id;
  end if;
  if new.program_id is null then raise exception 'parent_not_found'; end if;
  return new;
end $$;
create trigger training_days_program before insert or update on public.training_days
  for each row execute function public.fill_training_program_id();
create trigger prescriptions_program before insert or update on public.exercise_prescriptions
  for each row execute function public.fill_training_program_id();
create trigger prescription_sets_program before insert or update on public.prescription_sets
  for each row execute function public.fill_training_program_id();

create or replace function public.client_sees_training_program(p_program uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.training_programs tp
    where tp.id = p_program
      and tp.client_id = public.current_client_id()
      and tp.status in ('active', 'completed')
  );
$$;

-- Logged workouts. ids may be generated on the device so offline retries stay idempotent.
create table public.workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  program_id       uuid references public.training_programs(id) on delete set null,
  training_day_id  uuid references public.training_days(id) on delete set null,
  name             text not null,
  performed_on     date not null default current_date,
  started_at       timestamptz,
  finished_at      timestamptz,
  status           text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  notes            text,
  device_updated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index workout_sessions_client_idx on public.workout_sessions (client_id, performed_on desc);
create trigger workout_sessions_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table public.workout_sets (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id         uuid not null references public.exercises(id),
  prescription_set_id uuid references public.prescription_sets(id) on delete set null,
  exercise_position   smallint not null default 0,
  position            smallint not null default 0,
  set_type            text not null default 'working' check (set_type in ('warmup', 'working', 'dropset')),
  reps                smallint check (reps is null or reps between 0 and 200),
  weight_kg           numeric(6,2) check (weight_kg is null or weight_kg between 0 and 500),
  rir                 numeric(3,1) check (rir is null or rir between 0 and 10),
  is_completed        boolean not null default false,
  is_skipped          boolean not null default false,
  notes               text,
  completed_at        timestamptz,
  updated_at          timestamptz not null default now()
);
create index workout_sets_session_idx on public.workout_sets (session_id, exercise_position, position);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);
create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Running
-- -----------------------------------------------------------------------------

create table public.running_programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  description text,
  start_date  date,
  status      text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  -- Individual training zones, e.g. [{"name":"Z2","pace_min":360,"pace_max":400,"hr_min":130,"hr_max":145}]
  zones       jsonb not null default '[]'::jsonb,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (client_id is not null or status in ('draft', 'archived'))
);
create index running_programs_client_idx on public.running_programs (client_id, status);
create trigger running_programs_audit_fields before insert or update on public.running_programs
  for each row execute function public.set_audit_fields();

create table public.running_weeks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.running_programs(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  target_km   numeric(5,1) check (target_km is null or target_km between 0 and 300),
  notes       text,
  unique (program_id, week_number)
);

create table public.running_workouts (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.running_programs(id) on delete cascade,
  week_id        uuid not null references public.running_weeks(id) on delete cascade,
  day_of_week    smallint check (day_of_week between 1 and 7),
  scheduled_date date,
  workout_type   text not null check (workout_type in (
                   'easy', 'recovery', 'long', 'progression', 'tempo', 'threshold_intervals',
                   'vo2max_intervals', 'hill_repeats', 'race_pace', 'fartlek')),
  title          text not null,
  notes          text,
  position       smallint not null default 0
);
create index running_workouts_week_idx on public.running_workouts (week_id, day_of_week, position);

create table public.running_segments (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.running_programs(id) on delete cascade,
  workout_id      uuid not null references public.running_workouts(id) on delete cascade,
  position        smallint not null default 0,
  segment_type    text not null check (segment_type in ('warmup', 'main', 'interval', 'recovery', 'cooldown')),
  repeat_count    smallint not null default 1 check (repeat_count between 1 and 50),
  duration_s      int check (duration_s is null or duration_s between 1 and 36000),
  distance_m      int check (distance_m is null or distance_m between 1 and 100000),
  pace_min_s_km   int check (pace_min_s_km is null or pace_min_s_km between 120 and 1200),
  pace_max_s_km   int check (pace_max_s_km is null or pace_max_s_km between 120 and 1200),
  hr_min          smallint check (hr_min is null or hr_min between 40 and 230),
  hr_max          smallint check (hr_max is null or hr_max between 40 and 230),
  power_min       smallint check (power_min is null or power_min between 0 and 1000),
  power_max       smallint check (power_max is null or power_max between 0 and 1000),
  recovery_s      int check (recovery_s is null or recovery_s between 0 and 3600),
  instructions    text
);
create index running_segments_workout_idx on public.running_segments (workout_id, position);

create or replace function public.fill_running_program_id()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'running_workouts' then
    select program_id into new.program_id from public.running_weeks where id = new.week_id;
  elsif tg_table_name = 'running_segments' then
    select program_id into new.program_id from public.running_workouts where id = new.workout_id;
  end if;
  if new.program_id is null then raise exception 'parent_not_found'; end if;
  return new;
end $$;
create trigger running_workouts_program before insert or update on public.running_workouts
  for each row execute function public.fill_running_program_id();
create trigger running_segments_program before insert or update on public.running_segments
  for each row execute function public.fill_running_program_id();

create or replace function public.client_sees_running_program(p_program uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.running_programs rp
    where rp.id = p_program
      and rp.client_id = public.current_client_id()
      and rp.status in ('active', 'completed')
  );
$$;

create table public.running_activities (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  workout_id       uuid references public.running_workouts(id) on delete set null,
  performed_on     date not null,
  started_at       timestamptz,
  distance_m       int not null check (distance_m between 1 and 400000),
  duration_s       int not null check (duration_s between 1 and 172800),
  avg_hr           smallint check (avg_hr is null or avg_hr between 40 and 230),
  max_hr           smallint check (max_hr is null or max_hr between 40 and 240),
  avg_power        smallint check (avg_power is null or avg_power between 0 and 1000),
  elevation_gain_m int check (elevation_gain_m is null or elevation_gain_m between 0 and 20000),
  source           text not null default 'manual' check (source in ('manual', 'gpx', 'fit')),
  file_id          uuid references public.client_files(id) on delete set null,
  title            text,
  notes            text,
  rpe              smallint check (rpe is null or rpe between 1 and 10),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index running_activities_client_idx on public.running_activities (client_id, performed_on desc);
create trigger running_activities_updated_at before update on public.running_activities
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Nutrition
-- -----------------------------------------------------------------------------

create table public.foods (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  brand          text,
  serving_size_g numeric(6,1) check (serving_size_g is null or serving_size_g > 0),
  kcal_100g      numeric(6,1) not null check (kcal_100g between 0 and 900),
  protein_100g   numeric(5,1) not null check (protein_100g between 0 and 100),
  carbs_100g     numeric(5,1) not null check (carbs_100g between 0 and 100),
  fat_100g       numeric(5,1) not null check (fat_100g between 0 and 100),
  fiber_100g     numeric(5,1) check (fiber_100g is null or fiber_100g between 0 and 100),
  source         text,
  is_custom      boolean not null default false,
  is_archived    boolean not null default false,
  created_by     uuid references public.profiles(id) on delete set null,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index foods_name_brand_key on public.foods (lower(name), lower(coalesce(brand, '')));
create trigger foods_audit_fields before insert or update on public.foods
  for each row execute function public.set_audit_fields();

create table public.nutrition_plans (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete cascade,
  name        text not null check (length(btrim(name)) > 0),
  kcal_target int check (kcal_target is null or kcal_target between 800 and 6000),
  protein_g   int check (protein_g is null or protein_g between 0 and 500),
  carbs_g     int check (carbs_g is null or carbs_g between 0 and 1000),
  fat_g       int check (fat_g is null or fat_g between 0 and 400),
  notes       text,
  status      text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  start_date  date,
  created_by  uuid references public.profiles(id) on delete set null,
  updated_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (client_id is not null or status in ('draft', 'archived'))
);
create index nutrition_plans_client_idx on public.nutrition_plans (client_id, status);
create trigger nutrition_plans_audit_fields before insert or update on public.nutrition_plans
  for each row execute function public.set_audit_fields();

create table public.nutrition_plan_days (
  id       uuid primary key default gen_random_uuid(),
  plan_id  uuid not null references public.nutrition_plans(id) on delete cascade,
  position smallint not null default 0,
  name     text not null,
  notes    text
);
create index nutrition_plan_days_idx on public.nutrition_plan_days (plan_id, position);

-- plan_id null + is_template = reusable meal template owned by the coaches.
create table public.meals (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid references public.nutrition_plans(id) on delete cascade,
  plan_day_id  uuid references public.nutrition_plan_days(id) on delete cascade,
  is_template  boolean not null default false,
  position     smallint not null default 0,
  name         text not null,
  meal_time    time,
  instructions text,
  created_by   uuid references public.profiles(id) on delete set null,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((is_template and plan_day_id is null) or (not is_template and plan_day_id is not null))
);
create index meals_day_idx on public.meals (plan_day_id, position);
create trigger meals_audit_fields before insert or update on public.meals
  for each row execute function public.set_audit_fields();

create table public.meal_items (
  id             uuid primary key default gen_random_uuid(),
  meal_id        uuid not null references public.meals(id) on delete cascade,
  plan_id        uuid references public.nutrition_plans(id) on delete cascade,
  food_id        uuid not null references public.foods(id),
  quantity_g     numeric(6,1) not null check (quantity_g > 0 and quantity_g <= 3000),
  alternative_to uuid references public.meal_items(id) on delete cascade,
  position       smallint not null default 0,
  notes          text
);
create index meal_items_meal_idx on public.meal_items (meal_id, position);

create or replace function public.fill_nutrition_plan_id()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'meals' then
    if new.plan_day_id is not null then
      select plan_id into new.plan_id from public.nutrition_plan_days where id = new.plan_day_id;
      if new.plan_id is null then raise exception 'parent_not_found'; end if;
    else
      new.plan_id := null;
    end if;
  elsif tg_table_name = 'meal_items' then
    if not exists (select 1 from public.meals where id = new.meal_id) then raise exception 'parent_not_found'; end if;
    select plan_id into new.plan_id from public.meals where id = new.meal_id;
  end if;
  return new;
end $$;
create trigger meals_plan before insert or update on public.meals
  for each row execute function public.fill_nutrition_plan_id();
create trigger meal_items_plan before insert or update on public.meal_items
  for each row execute function public.fill_nutrition_plan_id();

create or replace function public.client_sees_nutrition_plan(p_plan uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.nutrition_plans np
    where np.id = p_plan
      and np.client_id = public.current_client_id()
      and np.status in ('active', 'completed')
  );
$$;

-- -----------------------------------------------------------------------------
-- Audit triggers on the records that matter most
-- -----------------------------------------------------------------------------

create trigger audit_clients after insert or update or delete on public.clients
  for each row execute function public.write_audit_log();
create trigger audit_submissions after insert or update or delete on public.questionnaire_submissions
  for each row execute function public.write_audit_log();
create trigger audit_training_programs after insert or update or delete on public.training_programs
  for each row execute function public.write_audit_log();
create trigger audit_running_programs after insert or update or delete on public.running_programs
  for each row execute function public.write_audit_log();
create trigger audit_nutrition_plans after insert or update or delete on public.nutrition_plans
  for each row execute function public.write_audit_log();
create trigger audit_client_files after insert or update or delete on public.client_files
  for each row execute function public.write_audit_log();
create trigger audit_coach_notes after insert or update or delete on public.coach_notes
  for each row execute function public.write_audit_log();
create trigger audit_consents after insert or update or delete on public.client_consents
  for each row execute function public.write_audit_log();
