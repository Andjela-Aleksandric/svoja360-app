# Šema baze

PostgreSQL na Supabase-u. Sve tabele su u šemi `public`, sa uključenim Row Level Security (RLS).
Migracije: `supabase/migrations/`. Testovi bezbednosti: `supabase/tests/`.

## Uloge i pristup

| Uloga | Kako nastaje | Šta vidi |
|---|---|---|
| Trener | mejl je u `coach_allowlist` u trenutku pravljenja naloga | sve klijente i sve podatke (oba trenera isto) |
| Klijent | svaki drugi nalog; povezuje se sa redom u `clients` po mejlu | samo svoje podatke i samo **aktivne/završene** planove |
| Anonimno | – | ništa (sva prava oduzeta) |

Pomoćne funkcije (SECURITY DEFINER, koriste ih pravila): `is_coach()`, `current_client_id()` (vraća null za arhiviranog klijenta),
`has_consent(client, type)`, `client_sees_training_program/running_program/nutrition_plan(id)`,
`client_can_write_answer(submission, question)`, `file_kind_consent(client, kind)`, `client_file_registered(path)`.

## Tabele

### Nalozi i klijenti
| Tabela | Svrha | Ključne kolone |
|---|---|---|
| `profiles` | jedan red po korisniku (pravi ga okidač na `auth.users`) | `role` coach/client (klijent ne može da je menja), `full_name`, `phone` |
| `coach_allowlist` | mejlovi trenera | `email` |
| `clients` | kartoteka klijenata | `user_id` (nalog), `full_name`, `email` (jedinstven), `phone_e164`, `birth_date`, `height_cm`, `start_date`, `status` active/inactive/archived, `goal` |
| `client_consents` | saglasnosti | `consent_type` health_data/photos_videos/documents, `granted`, `decided_at` |
| `coach_notes` | interna zapažanja trenera (klijent ih nikad ne vidi) | `body`, `is_pinned`, `submission_id` |
| `app_settings` | podešavanja | `checkin_deadline` {weekday, hour} |
| `notifications` | rezervisano za obaveštenja u aplikaciji | – |
| `audit_log` | trag izmena osetljivih podataka i izvoza | `table_name`, `record_id`, `action`, `actor_id`, `data` |

### Upitnici i izveštaji
| Tabela | Svrha |
|---|---|
| `questionnaire_templates` / `_sections` / `_questions` | definicija početnog upitnika (6 sekcija) i nedeljnog izveštaja (7 sekcija); pitanja imaju tip, obaveznost, `sensitive`, uslov prikaza |
| `questionnaire_submissions` | jedno popunjavanje: `kind` initial/checkin, `status` draft/submitted/reviewed, `period_start/end` (ponedeljak–nedelja), `current_step`; jedinstveno po klijentu i periodu za izveštaje |
| `questionnaire_answers` | odgovori kao `jsonb`, jedan po pitanju |
| `nutrition_diary_days` / `_items` | trodnevni dnevnik ishrane |
| `client_files` | metapodaci fajlova; sam fajl je u Storage-u na putanji `<client_id>/<vrsta>/<uuid>.<ext>` |
| `body_measurements` | telesna masa i obimi; izvor manual/initial/checkin |

Okidač `guard_submission_update`: klijent ne može da menja period ni pregledan izveštaj; trenerov pregled upisuje `reviewed_at/by`.

### Trening snage
`muscle_groups`, `exercises` (+ `exercise_muscles`, varijacije preko `parent_id`), `training_programs` → `training_weeks`
(`is_deload`) → `training_days` → `exercise_prescriptions` (superserija, odmor, tempo) → `prescription_sets`
(tip serije, ponavljanja od–do, kg, RIR, RPE). Odrađeno: `workout_sessions` → `workout_sets`.
Program bez klijenta je šablon.

### Trčanje
`running_programs` (`zones` jsonb) → `running_weeks` (`target_km`) → `running_workouts` (10 tipova) → `running_segments`
(ponavljanja, trajanje ili distanca, tempo od–do u s/km, puls, snaga, oporavak). Odrađeno: `running_activities`
(ručno, GPX ili FIT, opcioni link na planirani trening i na originalni fajl).

### Ishrana
`foods` (vrednosti na 100 g), `nutrition_plans` (ciljevi kcal/P/UH/M) → `nutrition_plan_days` → `meals` → `meal_items`
(`alternative_to` za zamene). Šabloni obroka: `meals.is_template = true` bez plana.

## Funkcije (RPC)

| Funkcija | Ko | Šta radi |
|---|---|---|
| `save_training_program(jsonb)` | trener | atomski čuva celo stablo programa, zadržava id-jeve (istorija treninga ostaje povezana) |
| `copy_training_program(src, client, name, start)` | trener | kopija programa klijentu ili kao šablon |
| `save_running_program(jsonb)` / `copy_running_program(...)` | trener | isto za trčanje |
| `save_nutrition_plan(jsonb)` / `copy_nutrition_plan(...)` | trener | isto za ishranu, sa zamenama |
| `log_workout(jsonb)` | klijent | čuva trening sa serijama; idempotentno po id-ju sa uređaja, starija kopija ne prepisuje noviju |
| `log_coach_event(table, id, action)` | trener | upis izvoza / otvaranja fajla u audit log |
| `coach_contacts()` | prijavljeni | ime i telefon trenera (bez ostalih podataka) |

Sve funkcije osim pomoćnih rade kao pozivalac (SECURITY INVOKER), pa RLS važi i unutar njih.

## Storage

Jedan privatni bucket `client-files` (50 MB po fajlu, dozvoljeni tipovi slika, PDF, video, GPX/FIT).
Klijent može da otpremi fajl samo na putanju koja je prethodno upisana u `client_files`, a taj upis proverava
saglasnost. Fajlovi se otvaraju potpisanim linkom koji važi 10 minuta.
