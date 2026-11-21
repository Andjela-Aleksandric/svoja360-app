-- Daily food tracking (Lifesum style) and water, logged by the client, visible to coaches.
create table if not exists public.food_log_entries (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  logged_on   date not null,
  meal_slot   text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id     uuid references public.foods(id) on delete set null,
  name        text not null check (char_length(name) between 1 and 120),
  quantity_g  numeric(6,1) check (quantity_g is null or quantity_g between 0 and 5000),
  kcal        numeric(6,1) not null check (kcal between 0 and 10000),
  protein_g   numeric(6,1) not null default 0 check (protein_g between 0 and 1000),
  carbs_g     numeric(6,1) not null default 0 check (carbs_g between 0 and 1000),
  fat_g       numeric(6,1) not null default 0 check (fat_g between 0 and 1000),
  created_at  timestamptz not null default now()
);
create index if not exists food_log_entries_client_day_idx on public.food_log_entries (client_id, logged_on);

create table if not exists public.water_logs (
  client_id  uuid not null references public.clients(id) on delete cascade,
  logged_on  date not null,
  ml         int not null default 0 check (ml between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (client_id, logged_on)
);

alter table public.food_log_entries enable row level security;
alter table public.water_logs enable row level security;

drop policy if exists coach_all on public.food_log_entries;
drop policy if exists client_own on public.food_log_entries;
drop policy if exists coach_all on public.water_logs;
drop policy if exists client_own on public.water_logs;

create policy coach_all on public.food_log_entries for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy client_own on public.food_log_entries for all to authenticated
  using (client_id = public.current_client_id()) with check (client_id = public.current_client_id());
create policy coach_all on public.water_logs for all to authenticated
  using (public.is_coach()) with check (public.is_coach());
create policy client_own on public.water_logs for all to authenticated
  using (client_id = public.current_client_id()) with check (client_id = public.current_client_id());

revoke all on public.food_log_entries from anon;
grant all on public.food_log_entries to service_role;
grant all on public.water_logs to service_role;
revoke all on public.water_logs from anon;
grant select, insert, update, delete on public.food_log_entries to authenticated;
grant select, insert, update, delete on public.water_logs to authenticated;

notify pgrst, 'reload schema';
