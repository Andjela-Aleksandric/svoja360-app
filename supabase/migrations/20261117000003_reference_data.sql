-- =============================================================================
-- Reference data needed in every environment (not demo data):
-- muscle groups, starter exercise library, starter food library,
-- initial questionnaire and weekly check-in templates, default settings.
-- =============================================================================

insert into public.app_settings (key, value) values
  ('checkin_deadline', '{"weekday": 1, "hour": 20}'::jsonb),
  ('checkin_period',   '{"week_starts_on": 1}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Muscle groups
-- -----------------------------------------------------------------------------
insert into public.muscle_groups (slug, name, position) values
  ('chest', 'Grudi', 1), ('lats', 'Široki leđni', 2), ('upper_back', 'Gornja leđa', 3),
  ('lower_back', 'Donja leđa', 4), ('traps', 'Trapez', 5), ('front_delts', 'Prednje rame', 6),
  ('side_delts', 'Bočno rame', 7), ('rear_delts', 'Zadnje rame', 8), ('biceps', 'Biceps', 9),
  ('triceps', 'Triceps', 10), ('forearms', 'Podlaktice', 11), ('quads', 'Kvadriceps', 12),
  ('hamstrings', 'Zadnja loža', 13), ('glutes', 'Gluteus', 14), ('adductors', 'Aduktori', 15),
  ('calves', 'Listovi', 16), ('abs', 'Trbušni mišići', 17), ('obliques', 'Kosi trbušni', 18)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Exercise library: name | equipment | type | pattern | primary | secondary (comma list)
-- -----------------------------------------------------------------------------
do $$
declare
  r text[];
  v_id uuid;
  m text;
  rows text[][] := array[
    array['Čučanj sa šipkom', 'barbell', 'compound', 'squat', 'quads', 'glutes,adductors,lower_back'],
    array['Prednji čučanj sa šipkom', 'barbell', 'compound', 'squat', 'quads', 'glutes,abs'],
    array['Goblet čučanj', 'dumbbell', 'compound', 'squat', 'quads', 'glutes,abs'],
    array['Čučanj na Smit mašini', 'smith', 'compound', 'squat', 'quads', 'glutes'],
    array['Potisak nogama', 'machine', 'compound', 'squat', 'quads', 'glutes,adductors'],
    array['Hack čučanj', 'machine', 'compound', 'squat', 'quads', 'glutes'],
    array['Bugarski čučanj', 'dumbbell', 'compound', 'lunge', 'quads', 'glutes,adductors'],
    array['Iskorak unazad sa bučicama', 'dumbbell', 'compound', 'lunge', 'glutes', 'quads,adductors'],
    array['Hodajući iskoraci', 'dumbbell', 'compound', 'lunge', 'quads', 'glutes'],
    array['Penjanje na klupu', 'dumbbell', 'compound', 'lunge', 'quads', 'glutes'],
    array['Mrtvo dizanje', 'barbell', 'compound', 'hinge', 'glutes', 'hamstrings,lower_back,quads,traps,forearms'],
    array['Rumunsko mrtvo dizanje', 'barbell', 'compound', 'hinge', 'hamstrings', 'glutes,lower_back'],
    array['Rumunsko mrtvo dizanje sa bučicama', 'dumbbell', 'compound', 'hinge', 'hamstrings', 'glutes,lower_back'],
    array['Mrtvo dizanje sa trap šipkom', 'trap_bar', 'compound', 'hinge', 'glutes', 'quads,hamstrings,traps'],
    array['Sumo mrtvo dizanje', 'barbell', 'compound', 'hinge', 'glutes', 'adductors,quads,hamstrings'],
    array['Potisak kukovima sa šipkom (hip thrust)', 'barbell', 'compound', 'hinge', 'glutes', 'hamstrings'],
    array['Most za gluteus', 'bodyweight', 'isolation', 'hinge', 'glutes', 'hamstrings'],
    array['Zamah kettlebellom', 'kettlebell', 'compound', 'hinge', 'glutes', 'hamstrings,lower_back'],
    array['Good morning sa šipkom', 'barbell', 'compound', 'hinge', 'hamstrings', 'lower_back,glutes'],
    array['Hiperekstenzija', 'bodyweight', 'isolation', 'hinge', 'lower_back', 'glutes,hamstrings'],
    array['Nordijski pregib', 'bodyweight', 'isolation', 'isolation', 'hamstrings', ''],
    array['Pregib nogu ležeći', 'machine', 'isolation', 'isolation', 'hamstrings', ''],
    array['Pregib nogu sedeći', 'machine', 'isolation', 'isolation', 'hamstrings', ''],
    array['Opružanje nogu', 'machine', 'isolation', 'isolation', 'quads', ''],
    array['Abdukcija kukova na mašini', 'machine', 'isolation', 'isolation', 'glutes', ''],
    array['Adukcija na mašini', 'machine', 'isolation', 'isolation', 'adductors', ''],
    array['Podizanje na prste stojeći', 'machine', 'isolation', 'isolation', 'calves', ''],
    array['Podizanje na prste sedeći', 'machine', 'isolation', 'isolation', 'calves', ''],
    array['Potisak sa ravne klupe', 'barbell', 'compound', 'push_horizontal', 'chest', 'front_delts,triceps'],
    array['Potisak sa kose klupe', 'barbell', 'compound', 'push_horizontal', 'chest', 'front_delts,triceps'],
    array['Potisak bučicama sa ravne klupe', 'dumbbell', 'compound', 'push_horizontal', 'chest', 'front_delts,triceps'],
    array['Potisak bučicama sa kose klupe', 'dumbbell', 'compound', 'push_horizontal', 'chest', 'front_delts,triceps'],
    array['Sklek', 'bodyweight', 'compound', 'push_horizontal', 'chest', 'triceps,front_delts,abs'],
    array['Sklek sa uzdignutim rukama', 'bodyweight', 'compound', 'push_horizontal', 'chest', 'triceps,front_delts'],
    array['Razvlačenje bučicama na ravnoj klupi', 'dumbbell', 'isolation', 'isolation', 'chest', 'front_delts'],
    array['Ukrštanje na kablovima', 'cable', 'isolation', 'isolation', 'chest', 'front_delts'],
    array['Propadanja na razboju', 'bodyweight', 'compound', 'push_vertical', 'triceps', 'chest,front_delts'],
    array['Vojnički potisak', 'barbell', 'compound', 'push_vertical', 'front_delts', 'triceps,side_delts'],
    array['Potisak bučicama iznad glave sedeći', 'dumbbell', 'compound', 'push_vertical', 'front_delts', 'triceps,side_delts'],
    array['Arnold potisak', 'dumbbell', 'compound', 'push_vertical', 'front_delts', 'side_delts,triceps'],
    array['Landmine potisak', 'barbell', 'compound', 'push_vertical', 'front_delts', 'chest,triceps'],
    array['Bočno odručenje bučicama', 'dumbbell', 'isolation', 'isolation', 'side_delts', ''],
    array['Bočno odručenje na kablu', 'cable', 'isolation', 'isolation', 'side_delts', ''],
    array['Obrnuto razvlačenje na mašini', 'machine', 'isolation', 'isolation', 'rear_delts', 'upper_back'],
    array['Povlačenje užeta ka licu (face pull)', 'cable', 'isolation', 'pull_horizontal', 'rear_delts', 'upper_back,traps'],
    array['Francuski potisak sa EZ šipkom', 'ez_bar', 'isolation', 'isolation', 'triceps', ''],
    array['Opružanje tricepsa na kablu', 'cable', 'isolation', 'isolation', 'triceps', ''],
    array['Opružanje tricepsa bučicom iznad glave', 'dumbbell', 'isolation', 'isolation', 'triceps', ''],
    array['Zgib', 'bodyweight', 'compound', 'pull_vertical', 'lats', 'biceps,upper_back,forearms'],
    array['Zgib uz pomoć gume', 'band', 'compound', 'pull_vertical', 'lats', 'biceps,upper_back'],
    array['Negativni zgib', 'bodyweight', 'compound', 'pull_vertical', 'lats', 'biceps,upper_back'],
    array['Aktivni vis na šipki', 'bodyweight', 'isolation', 'other', 'forearms', 'lats,upper_back'],
    array['Povlačenje na lat mašini', 'cable', 'compound', 'pull_vertical', 'lats', 'biceps,upper_back'],
    array['Veslanje sa šipkom', 'barbell', 'compound', 'pull_horizontal', 'upper_back', 'lats,biceps,rear_delts'],
    array['Veslanje bučicom jednom rukom', 'dumbbell', 'compound', 'pull_horizontal', 'lats', 'upper_back,biceps'],
    array['Veslanje na kablu sedeći', 'cable', 'compound', 'pull_horizontal', 'upper_back', 'lats,biceps,rear_delts'],
    array['Veslanje na mašini sa osloncem za grudi', 'machine', 'compound', 'pull_horizontal', 'upper_back', 'lats,rear_delts'],
    array['Obrnuto veslanje telesnom težinom', 'bodyweight', 'compound', 'pull_horizontal', 'upper_back', 'lats,biceps'],
    array['Pregib sa šipkom', 'barbell', 'isolation', 'isolation', 'biceps', 'forearms'],
    array['Pregib sa bučicama', 'dumbbell', 'isolation', 'isolation', 'biceps', 'forearms'],
    array['Čekić pregib', 'dumbbell', 'isolation', 'isolation', 'biceps', 'forearms'],
    array['Pregib na kablu', 'cable', 'isolation', 'isolation', 'biceps', ''],
    array['Slegovanje ramenima sa bučicama', 'dumbbell', 'isolation', 'isolation', 'traps', 'forearms'],
    array['Plank', 'bodyweight', 'core', 'core', 'abs', 'obliques'],
    array['Bočni plank', 'bodyweight', 'core', 'core', 'obliques', 'abs'],
    array['Mrtva buba (dead bug)', 'bodyweight', 'core', 'core', 'abs', ''],
    array['Palof potisak', 'cable', 'core', 'core', 'obliques', 'abs'],
    array['Podizanje nogu u visu', 'bodyweight', 'core', 'core', 'abs', 'forearms'],
    array['Rolanje točkom za trbušnjake', 'other', 'core', 'core', 'abs', 'lats'],
    array['Farmerov hod', 'dumbbell', 'compound', 'carry', 'forearms', 'traps,abs'],
    array['Nošenje jednom rukom', 'dumbbell', 'compound', 'carry', 'obliques', 'forearms,traps'],
    array['Skok na kutiju', 'bodyweight', 'plyometric', 'squat', 'quads', 'glutes,calves'],
    array['Skok iz čučnja', 'bodyweight', 'plyometric', 'squat', 'quads', 'glutes,calves'],
    array['Bacanje medicinke o zid', 'other', 'plyometric', 'other', 'abs', 'front_delts,chest']
  ];
begin
  foreach r slice 1 in array rows loop
    insert into public.exercises (name, equipment, exercise_type, movement_pattern)
    values (r[1], r[2], r[3], r[4])
    on conflict (lower(name)) do nothing
    returning id into v_id;
    if v_id is null then continue; end if;
    insert into public.exercise_muscles (exercise_id, muscle_group_id, is_primary)
    select v_id, id, true from public.muscle_groups where slug = r[5];
    if r[6] <> '' then
      foreach m in array string_to_array(r[6], ',') loop
        insert into public.exercise_muscles (exercise_id, muscle_group_id, is_primary)
        select v_id, id, false from public.muscle_groups where slug = m
        on conflict do nothing;
      end loop;
    end if;
  end loop;
end $$;

-- Variations (parent exercise)
update public.exercises c set parent_id = p.id
from public.exercises p
where (c.name, p.name) in (
  ('Prednji čučanj sa šipkom', 'Čučanj sa šipkom'),
  ('Čučanj na Smit mašini', 'Čučanj sa šipkom'),
  ('Rumunsko mrtvo dizanje sa bučicama', 'Rumunsko mrtvo dizanje'),
  ('Sumo mrtvo dizanje', 'Mrtvo dizanje'),
  ('Mrtvo dizanje sa trap šipkom', 'Mrtvo dizanje'),
  ('Sklek sa uzdignutim rukama', 'Sklek'),
  ('Zgib uz pomoć gume', 'Zgib'),
  ('Negativni zgib', 'Zgib'),
  ('Potisak bučicama sa ravne klupe', 'Potisak sa ravne klupe'),
  ('Potisak bučicama sa kose klupe', 'Potisak sa kose klupe')
);

-- -----------------------------------------------------------------------------
-- Food library (values per 100 g). Source: USDA FoodData Central, rounded.
-- Items marked 'prosek' are typical market averages: check the product label.
-- name | kcal | protein | carbs | fat | fiber | source
-- -----------------------------------------------------------------------------
do $$
declare r text[];
  rows text[][] := array[
    array['Pileća prsa bez kože, sirova', '120', '22.5', '0', '2.6', '0', 'USDA'],
    array['Pileća prsa, pečena', '165', '31', '0', '3.6', '0', 'USDA'],
    array['Ćureća prsa, sirova', '114', '23.7', '0', '1.5', '0', 'USDA'],
    array['Mlevena junetina 10% masti, sirova', '176', '20', '0', '10', '0', 'USDA'],
    array['Juneći but, posni, sirov', '160', '21', '0', '8', '0', 'USDA'],
    array['Svinjski file, sirov', '120', '21', '0', '3.5', '0', 'USDA'],
    array['Losos, sirov', '208', '20', '0', '13', '0', 'USDA'],
    array['Bakalar, sirov', '82', '17.8', '0', '0.7', '0', 'USDA'],
    array['Tuna u sopstvenom soku, oceđena', '116', '26', '0', '0.8', '0', 'USDA'],
    array['Sardina u ulju, oceđena', '208', '24.6', '0', '11.5', '0', 'USDA'],
    array['Skuša, sirova', '205', '18.6', '0', '13.9', '0', 'USDA'],
    array['Škampi, sirovi', '85', '20.1', '0', '0.5', '0', 'USDA'],
    array['Jaje, celo', '143', '12.6', '0.7', '9.5', '0', 'USDA'],
    array['Belance', '52', '10.9', '0.7', '0.2', '0', 'USDA'],
    array['Tofu', '76', '8.1', '1.9', '4.8', '0.3', 'USDA'],
    array['Grčki jogurt 2%', '73', '10', '3.9', '1.9', '0', 'USDA'],
    array['Skyr', '63', '11', '4', '0.2', '0', 'prosek'],
    array['Posni sir', '81', '10.5', '4.8', '2.3', '0', 'USDA'],
    array['Mleko 2,8% m.m.', '58', '3.2', '4.7', '2.8', '0', 'prosek'],
    array['Jogurt 2,8% m.m.', '58', '3.3', '4.5', '2.8', '0', 'prosek'],
    array['Kefir', '56', '3.4', '4.5', '2.5', '0', 'prosek'],
    array['Sir gauda', '356', '24.9', '2.2', '27.4', '0', 'USDA'],
    array['Feta sir', '264', '14.2', '4.1', '21.3', '0', 'USDA'],
    array['Mocarela', '300', '22.2', '2.2', '22.4', '0', 'USDA'],
    array['Surutka protein (koncentrat)', '400', '78', '8', '6', '0', 'prosek'],
    array['Ovsene pahuljice', '379', '13.2', '67.7', '6.5', '10.1', 'USDA'],
    array['Beli pirinač, sirov', '365', '7.1', '80', '0.7', '1.3', 'USDA'],
    array['Beli pirinač, kuvan', '130', '2.7', '28.2', '0.3', '0.4', 'USDA'],
    array['Integralni pirinač, sirov', '367', '7.5', '76.2', '3.2', '3.6', 'USDA'],
    array['Testenina, sirova', '371', '13', '74.7', '1.5', '3.2', 'USDA'],
    array['Testenina, kuvana', '158', '5.8', '30.9', '0.9', '1.8', 'USDA'],
    array['Krompir, sirov', '77', '2.1', '17.5', '0.1', '2.1', 'USDA'],
    array['Batat, sirov', '86', '1.6', '20.1', '0.1', '3', 'USDA'],
    array['Beli hleb', '266', '7.6', '50.6', '3.3', '2.4', 'USDA'],
    array['Integralni hleb', '252', '12.5', '42.7', '3.5', '6', 'USDA'],
    array['Pšenična tortilja', '304', '8', '50', '7.7', '3', 'prosek'],
    array['Pirinčane galete', '387', '8.2', '81.5', '2.8', '4.2', 'USDA'],
    array['Kinoa, sirova', '368', '14.1', '64.2', '6.1', '7', 'USDA'],
    array['Heljda, sirova', '343', '13.3', '71.5', '3.4', '10', 'USDA'],
    array['Kus-kus, sirov', '376', '12.8', '77.4', '0.6', '5', 'USDA'],
    array['Kukuruzne pahuljice', '357', '7.5', '84.1', '0.4', '3.3', 'USDA'],
    array['Musli bez dodatog šećera', '360', '10', '66', '6', '7', 'prosek'],
    array['Kukuruz šećerac, kuvan', '96', '3.4', '21', '1.5', '2.4', 'USDA'],
    array['Banana', '89', '1.1', '22.8', '0.3', '2.6', 'USDA'],
    array['Jabuka', '52', '0.3', '13.8', '0.2', '2.4', 'USDA'],
    array['Borovnice', '57', '0.7', '14.5', '0.3', '2.4', 'USDA'],
    array['Jagode', '32', '0.7', '7.7', '0.3', '2', 'USDA'],
    array['Pomorandža', '47', '0.9', '11.8', '0.1', '2.4', 'USDA'],
    array['Kivi', '61', '1.1', '14.7', '0.5', '3', 'USDA'],
    array['Grožđe', '69', '0.7', '18.1', '0.2', '0.9', 'USDA'],
    array['Suve urme', '282', '2.5', '75', '0.4', '8', 'USDA'],
    array['Brokoli', '34', '2.8', '6.6', '0.4', '2.6', 'USDA'],
    array['Spanać', '23', '2.9', '3.6', '0.4', '2.2', 'USDA'],
    array['Paradajz', '18', '0.9', '3.9', '0.2', '1.2', 'USDA'],
    array['Krastavac', '15', '0.7', '3.6', '0.1', '0.5', 'USDA'],
    array['Crvena paprika', '31', '1', '6', '0.3', '2.1', 'USDA'],
    array['Šargarepa', '41', '0.9', '9.6', '0.2', '2.8', 'USDA'],
    array['Tikvica', '17', '1.2', '3.1', '0.3', '1', 'USDA'],
    array['Zelena salata', '15', '1.4', '2.9', '0.2', '1.3', 'USDA'],
    array['Šampinjoni', '22', '3.1', '3.3', '0.3', '1', 'USDA'],
    array['Crni luk', '40', '1.1', '9.3', '0.1', '1.7', 'USDA'],
    array['Karfiol', '25', '1.9', '5', '0.3', '2', 'USDA'],
    array['Boranija', '31', '1.8', '7', '0.2', '2.7', 'USDA'],
    array['Grašak, zamrznut', '77', '5.2', '13.6', '0.4', '4.5', 'USDA'],
    array['Sočivo, sirovo', '352', '24.6', '63.4', '1.1', '10.7', 'USDA'],
    array['Leblebija, kuvana', '164', '8.9', '27.4', '2.6', '7.6', 'USDA'],
    array['Crveni pasulj, kuvan', '127', '8.7', '22.8', '0.5', '6.4', 'USDA'],
    array['Humus', '166', '7.9', '14.3', '9.6', '6', 'USDA'],
    array['Avokado', '160', '2', '8.5', '14.7', '6.7', 'USDA'],
    array['Maslinovo ulje', '884', '0', '0', '100', '0', 'USDA'],
    array['Puter', '717', '0.9', '0.1', '81.1', '0', 'USDA'],
    array['Puter od kikirikija', '588', '25', '20', '50', '6', 'USDA'],
    array['Bademi', '579', '21.2', '21.6', '49.9', '12.5', 'USDA'],
    array['Orasi', '654', '15.2', '13.7', '65.2', '6.7', 'USDA'],
    array['Indijski orah', '553', '18.2', '30.2', '43.8', '3.3', 'USDA'],
    array['Čia semenke', '486', '16.5', '42.1', '30.7', '34.4', 'USDA'],
    array['Laneno seme', '534', '18.3', '28.9', '42.2', '27.3', 'USDA'],
    array['Tamna čokolada 70-85%', '598', '7.8', '45.9', '42.6', '10.9', 'USDA'],
    array['Med', '304', '0.3', '82.4', '0', '0.2', 'USDA'],
    array['Šećer', '387', '0', '100', '0', '0', 'USDA'],
    array['Džem', '278', '0.4', '68.9', '0.1', '1.1', 'USDA'],
    array['Sok od pomorandže', '45', '0.7', '10.4', '0.2', '0.2', 'USDA'],
    array['Crno vino', '85', '0.1', '2.6', '0', '0', 'USDA'],
    array['Pivo', '43', '0.5', '3.6', '0', '0', 'USDA']
  ];
begin
  foreach r slice 1 in array rows loop
    insert into public.foods (name, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, source)
    values (r[1], r[2]::numeric, r[3]::numeric, r[4]::numeric, r[5]::numeric, r[6]::numeric,
            case r[7] when 'USDA' then 'USDA FoodData Central, zaokruženo'
                      else 'Prosečna tržišna vrednost, proveriti deklaraciju' end)
    on conflict do nothing;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Questionnaire templates
-- q(section_position, position, code, label, type, required, sensitive, options, unit, help, condition)
-- -----------------------------------------------------------------------------
create or replace function pg_temp.add_question(
  p_template uuid, p_section int, p_pos int, p_code text, p_label text, p_type text,
  p_required boolean default false, p_sensitive boolean default false,
  p_options jsonb default null, p_unit text default null, p_help text default null, p_condition jsonb default null
) returns void language plpgsql as $$
begin
  insert into public.questionnaire_questions
    (template_id, section_id, position, code, label, type, required, sensitive, options, unit, help_text, condition)
  select p_template, s.id, p_pos, p_code, p_label, p_type, p_required, p_sensitive, p_options, p_unit, p_help, p_condition
  from public.questionnaire_sections s where s.template_id = p_template and s.position = p_section;
end $$;

do $$
declare t uuid;
begin
  if exists (select 1 from public.questionnaire_templates where kind = 'initial') then return; end if;

  insert into public.questionnaire_templates (kind, name) values ('initial', 'Početni upitnik') returning id into t;
  insert into public.questionnaire_sections (template_id, position, title, description) values
    (t, 1, 'Osnovne informacije', 'Par osnovnih podataka da bismo plan napravili baš za vas.'),
    (t, 2, 'Trening i fizička aktivnost', 'Šta ste do sada radili i koliko vremena realno imate.'),
    (t, 3, 'Zdravlje i suplementacija', 'Ovi podaci su poverljivi i vide ih samo vaši treneri.'),
    (t, 4, 'Ishrana i životne navike', 'Kako izgleda vaš dan, od doručka do spavanja.'),
    (t, 5, 'Ciljevi i motivacija', 'Šta želite da postignete i zašto baš sada.'),
    (t, 6, 'Početna procena', 'Fotografije i kratak snimak nam pomažu da vidimo držanje i početnu tačku.');

  perform pg_temp.add_question(t, 1, 1, 'full_name', 'Ime i prezime', 'text', true);
  perform pg_temp.add_question(t, 1, 2, 'email', 'Email adresa', 'text', true, false, '{"format":"email"}');
  perform pg_temp.add_question(t, 1, 3, 'birth_date', 'Datum rođenja', 'date', true);
  perform pg_temp.add_question(t, 1, 4, 'height_cm', 'Visina', 'number', true, false, '{"min":120,"max":230,"step":1}', 'cm');
  perform pg_temp.add_question(t, 1, 5, 'weight_kg', 'Trenutna telesna masa', 'number', true, false, '{"min":35,"max":250,"step":0.1}', 'kg');

  perform pg_temp.add_question(t, 2, 1, 'training_history', 'Koliko dugo trenirate? Kada ste poslednji put trenirali?', 'long_text', true);
  perform pg_temp.add_question(t, 2, 2, 'training_type', 'Kakvu vrstu treninga ste do sada radili i kako je izgledao vaš trening split?', 'long_text', true,
    false, null, null, 'Na primer: tri puta nedeljno ceo telo, grupni treninzi, trčanje dva puta nedeljno.');
  perform pg_temp.add_question(t, 2, 3, 'training_days', 'Koliko dana nedeljno možete da trenirate?', 'single_choice', true, false,
    '{"choices":["2","3","4","5","6"]}');
  perform pg_temp.add_question(t, 2, 4, 'equipment_access', 'Kakva vam je dostupnost teretane i opreme?', 'long_text', true, false, null, null,
    'Teretana, kućna oprema, bučice, trake, staza za trčanje...');
  perform pg_temp.add_question(t, 2, 5, 'injuries', 'Da li ste imali povrede, operacije ili trenutno imate bolove i fizička ograničenja?', 'long_text', false, true);
  perform pg_temp.add_question(t, 2, 6, 'painful_exercises', 'Da li postoje vežbe koje vam ne odgovaraju ili izazivaju bol i nelagodnost?', 'long_text', false, true);

  perform pg_temp.add_question(t, 3, 1, 'health_conditions', 'Da li imate dijagnostikovane zdravstvene ili hormonalne probleme? Da li koristite neku terapiju?', 'long_text', false, true,
    null, null, 'Na primer: insulinska rezistencija, Hašimoto, PCOS, terapija koju trenutno koristite.');
  perform pg_temp.add_question(t, 3, 2, 'lab_results', 'Da li imate novije laboratorijske nalaze krvi ili hormona? Možete priložiti više dokumenata.', 'file', false, true,
    '{"kind":"lab_result","multiple":true,"accept":"application/pdf,image/*"}');
  perform pg_temp.add_question(t, 3, 3, 'allergies_medication', 'Da li ste alergični na neke lekove ili namirnice?', 'long_text', false, true);
  perform pg_temp.add_question(t, 3, 4, 'supplements', 'Koje suplemente trenutno koristite? Navedite proizvođača, oblik i dozu.', 'long_text', false);
  perform pg_temp.add_question(t, 3, 5, 'supplement_openness', 'Da li biste bili spremni da uvedete suplementaciju?', 'single_choice', false, false,
    '{"choices":["Da","Možda, ako je zaista potrebno","Ne"]}');
  perform pg_temp.add_question(t, 3, 6, 'supplement_budget', 'Koliki je vaš okvirni mesečni budžet za suplemente?', 'single_choice', false, false,
    '{"choices":["Do 30 €","30–60 €","60–100 €","Više od 100 €","Nisam sigurna"]}', null, null,
    '{"code":"supplement_openness","not_equals":"Ne"}');

  perform pg_temp.add_question(t, 4, 1, 'diet_history', 'Da li ste ranije bili na dijetama? Koliko su trajale, kakve rezultate ste imali i zbog čega eventualno nisu uspele?', 'long_text', false);
  perform pg_temp.add_question(t, 4, 2, 'current_diet', 'Kako trenutno izgleda vaša ishrana? Navedite približan kalorijski i makronutritivni unos ako ga pratite.', 'long_text', true);
  perform pg_temp.add_question(t, 4, 3, 'food_restrictions', 'Da li imate alergije, intolerancije, posebne prehrambene navike ili ograničenja? Da li ste imali probleme sa prejedanjem ili restriktivnom ishranom?', 'long_text', false, true);
  perform pg_temp.add_question(t, 4, 4, 'sleep_energy_stress', 'Opišite svoj san, nivo energije i stres tokom dana. Da li se budite odmorni i imate li padove energije?', 'long_text', true);
  perform pg_temp.add_question(t, 4, 5, 'daily_life', 'Čime se bavite, kako izgledaju vaše svakodnevne obaveze i koliko ste fizički aktivni van treninga?', 'long_text', true);

  perform pg_temp.add_question(t, 5, 1, 'main_goal', 'Koji je vaš glavni cilj i šta konkretno želite da postignete tokom naše saradnje?', 'long_text', true, false, null, null,
    'Što konkretnije, to bolje: „prvi zgib“, „polumaraton ispod 2 sata“, „bolji nalazi“.');
  perform pg_temp.add_question(t, 5, 2, 'motivation', 'Šta vas najviše motiviše za promenu i koliko ste spremni da uložite vremena i truda?', 'long_text', true);
  perform pg_temp.add_question(t, 5, 3, 'collaboration_length', 'Koliko dugo planirate da traje naša saradnja?', 'single_choice', true, false,
    '{"choices":["3 meseca","6 meseci","12 meseci","Još ne znam"]}');

  perform pg_temp.add_question(t, 6, 1, 'assessment_photos', 'Priložite tri fotografije (spreda, sa strane i otpozadi), u odgovarajućoj odeći.', 'file', false, false,
    '{"kind":"assessment_photo","multiple":true,"accept":"image/*","angles":["front","side","back"]}', null,
    'Fotografije vide samo vaši treneri. Ako ne želite da ih pošaljete, ovaj korak možete preskočiti.');
  perform pg_temp.add_question(t, 6, 2, 'assessment_video', 'Priložite kratak video okreta oko svoje ose (10–20 sekundi), u opremi za trening.', 'file', false, false,
    '{"kind":"assessment_video","multiple":false,"accept":"video/*"}', null, 'Služi za početnu procenu držanja tela.');
end $$;

do $$
declare t uuid;
  scale jsonb := '{"min":1,"max":10}';
begin
  if exists (select 1 from public.questionnaire_templates where kind = 'checkin') then return; end if;

  insert into public.questionnaire_templates (kind, name) values ('checkin', 'Nedeljni izveštaj') returning id into t;
  insert into public.questionnaire_sections (template_id, position, title, description) values
    (t, 1, 'Telesna masa i mere', 'Sve se odnosi na prethodnu nedelju.'),
    (t, 2, 'Trening snage', null),
    (t, 3, 'Kardio i fizička aktivnost', null),
    (t, 4, 'Ishrana i glad', null),
    (t, 5, 'San i oporavak', null),
    (t, 6, 'Stres i opšte stanje', null),
    (t, 7, 'Završni osvrt', 'Ukratko, svojim rečima.');

  perform pg_temp.add_question(t, 1, 1, 'avg_weight', 'Kolika je bila vaša prosečna jutarnja telesna masa tokom prethodne nedelje?', 'number', true, false,
    '{"min":35,"max":250,"step":0.1}', 'kg', 'Merite se ujutru, posle toaleta, pre doručka.');
  perform pg_temp.add_question(t, 1, 2, 'has_measurements', 'Da li imate nove telesne mere?', 'yes_no', true);
  perform pg_temp.add_question(t, 1, 3, 'measurements', 'Unesite nove mere', 'measurements', false, false,
    '{"fields":["waist_cm","hips_cm","chest_cm","thigh_cm","arm_cm"]}', 'cm', null, '{"code":"has_measurements","equals":true}');
  perform pg_temp.add_question(t, 1, 4, 'progress_photos', 'Priložite fotografije napretka (opciono)', 'file', false, false,
    '{"kind":"progress_photo","multiple":true,"accept":"image/*","angles":["front","side","back"]}');

  perform pg_temp.add_question(t, 2, 1, 'strength_sessions', 'Koliko treninga snage ste planirali, a koliko realizovali?', 'planned_done', true);
  perform pg_temp.add_question(t, 2, 2, 'strength_quality', 'Kako biste ocenili kvalitet treninga i performanse?', 'scale', true, false,
    scale || '{"minLabel":"Veoma loše","maxLabel":"Odlično"}');
  perform pg_temp.add_question(t, 2, 3, 'strength_trend', 'Da li ste primetili napredak, stagnaciju ili pad performansi?', 'single_choice', true, false,
    '{"choices":["Napredak","Stagnacija","Pad"]}');
  perform pg_temp.add_question(t, 2, 4, 'strength_pain', 'Da li ste imali bolove, nelagodnost ili poteškoće tokom treninga?', 'yes_no', true);
  perform pg_temp.add_question(t, 2, 5, 'strength_pain_details', 'Opišite gde i kada se javlja', 'long_text', false, false, null, null, null,
    '{"code":"strength_pain","equals":true}');

  perform pg_temp.add_question(t, 3, 1, 'cardio_sessions', 'Koliko kardio treninga ste planirali, a koliko realizovali?', 'planned_done', true);
  perform pg_temp.add_question(t, 3, 2, 'cardio_minutes', 'Koliko ste ukupno minuta proveli u kardio aktivnostima?', 'number', false, false,
    '{"min":0,"max":3000,"step":5}', 'min');
  perform pg_temp.add_question(t, 3, 3, 'running_km', 'Ako trčite, navedite ukupnu kilometražu', 'number', false, false,
    '{"min":0,"max":300,"step":0.1}', 'km', 'Ako aktivnosti nisu automatski sinhronizovane, priložite ih u sledećem polju.');
  perform pg_temp.add_question(t, 3, 4, 'running_files', 'Aktivnosti trčanja (opciono)', 'file', false, false,
    '{"kind":"activity_file","multiple":true,"accept":".gpx,.fit,image/*"}');
  perform pg_temp.add_question(t, 3, 5, 'daily_steps', 'Koliko ste u proseku bili fizički aktivni tokom dana?', 'number', false, false,
    '{"min":0,"max":60000,"step":100}', 'koraka dnevno', 'Ako ne pratite korake, slobodno procenite.');

  perform pg_temp.add_question(t, 4, 1, 'nutrition_adherence', 'Koliko ste se pridržavali plana ishrane?', 'scale', true, false,
    scale || '{"minLabel":"Nimalo","maxLabel":"U potpunosti"}');
  perform pg_temp.add_question(t, 4, 2, 'nutrition_deviations', 'Da li ste imali odstupanja od plana? Ako jeste, navedite razloge.', 'long_text', false);
  perform pg_temp.add_question(t, 4, 3, 'hunger', 'Kako biste ocenili nivo gladi tokom nedelje?', 'scale', true, false,
    scale || '{"minLabel":"Bez gladi","maxLabel":"Stalno gladna"}');
  perform pg_temp.add_question(t, 4, 4, 'cravings', 'Da li ste imali pojačanu želju za slatkišima, grickalicama ili određenom hranom?', 'long_text', false);
  perform pg_temp.add_question(t, 4, 5, 'digestion', 'Da li ste imali problema sa varenjem ili nadutošću?', 'long_text', false);

  perform pg_temp.add_question(t, 5, 1, 'sleep_hours', 'Koliko ste u proseku spavali tokom noći?', 'number', true, false,
    '{"min":0,"max":14,"step":0.25}', 'h');
  perform pg_temp.add_question(t, 5, 2, 'sleep_quality', 'Kako biste ocenili kvalitet sna?', 'scale', true, false,
    scale || '{"minLabel":"Veoma loš","maxLabel":"Odličan"}');
  perform pg_temp.add_question(t, 5, 3, 'woke_rested', 'Da li ste se budili odmorni?', 'single_choice', true, false,
    '{"choices":["Uglavnom da","Ponekad","Uglavnom ne"]}');
  perform pg_temp.add_question(t, 5, 4, 'recovery_energy', 'Kako biste ocenili oporavak i nivo energije tokom prethodne nedelje?', 'scale', true, false,
    scale || '{"minLabel":"Veoma loše","maxLabel":"Odlično"}');

  perform pg_temp.add_question(t, 6, 1, 'stress', 'Kako biste ocenili nivo stresa tokom prethodne nedelje?', 'scale', true, false,
    scale || '{"minLabel":"Bez stresa","maxLabel":"Veoma visok"}');
  perform pg_temp.add_question(t, 6, 2, 'stress_sources', 'Koji su bili glavni izvori stresa?', 'long_text', false);
  perform pg_temp.add_question(t, 6, 3, 'mood_motivation', 'Kako biste ocenili svoje raspoloženje i motivaciju?', 'scale', true, false,
    scale || '{"minLabel":"Veoma loše","maxLabel":"Odlično"}');

  perform pg_temp.add_question(t, 7, 1, 'best_thing', 'Šta vam je najbolje išlo tokom prethodne nedelje?', 'long_text', true);
  perform pg_temp.add_question(t, 7, 2, 'biggest_challenge', 'Šta vam je predstavljalo najveći izazov?', 'long_text', true);
  perform pg_temp.add_question(t, 7, 3, 'change_request', 'Da li postoji nešto što biste želeli da promenimo ili prilagodimo u narednoj nedelji?', 'long_text', false);
end $$;
